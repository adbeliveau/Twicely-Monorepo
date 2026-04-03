/**
 * D3-S2: Subscription Webhook Handler
 *
 * Processes Stripe subscription lifecycle events and updates the database.
 * This is SEPARATE from the marketplace webhook handler (webhooks.ts).
 */

import type Stripe from 'stripe';
import { logger } from '@twicely/logger';
import { stripe } from './server';
import { notify } from '@twicely/notifications/service';
import { isWebhookDuplicate, markWebhookProcessed } from './webhook-idempotency';
import { resolveStripePriceId } from '@twicely/subscriptions/price-map';
import {
  findSellerByStripeCustomerId,
  findSubscriptionByStripeId,
} from '@twicely/subscriptions/queries';
import {
  upsertStoreSubscription,
  upsertListerSubscription,
  upsertAutomationSubscription,
  upsertFinanceSubscription,
  upsertBundleSubscription,
  cancelSubscription,
} from '@twicely/subscriptions/mutations';
import { applyPendingDowngradeIfNeeded } from '@twicely/subscriptions/apply-pending-downgrade';
import type { StoreTier, ListerTier, FinanceTier, BundleTier, SubscriptionStatus } from '@twicely/db/types';

// ─── Stripe Status → Twicely Status Mapping ─────────────────────────────────

export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    case 'paused':
      return 'PAUSED';
    case 'trialing':
      return 'TRIALING';
    case 'incomplete':
      return 'PENDING';
    case 'incomplete_expired':
      return 'CANCELED';
    case 'unpaid':
      return 'PAST_DUE';
    default:
      return 'PENDING';
  }
}

// ─── Event Handlers ─────────────────────────────────────────────────────────

/**
 * Handle customer.subscription.created and customer.subscription.updated.
 * Both events have the same shape — a full Subscription object.
 */
export async function handleSubscriptionUpsert(
  subscription: Stripe.Subscription
): Promise<void> {
  // 1. Extract metadata
  const metadata = subscription.metadata || {};
  let sellerProfileId = metadata.sellerProfileId;
  let product = metadata.product as 'store' | 'lister' | 'automation' | 'finance' | 'bundle' | undefined;
  let tier = metadata.tier;

  // 2. Fallback: find seller by Stripe Customer ID if metadata missing
  if (!sellerProfileId) {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    const seller = await findSellerByStripeCustomerId(customerId);
    if (!seller) {
      logger.error('Subscription webhook: seller not found for customer', { customerId });
      return;
    }
    sellerProfileId = seller.sellerProfileId;
  }

  // 3. Get the first line item's price
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    logger.error('Subscription webhook: no price ID found');
    return;
  }

  // 4. Resolve price ID to product + tier + interval
  const resolved = resolveStripePriceId(priceId);
  if (!resolved) {
    logger.error('Subscription webhook: unknown price ID', { priceId });
    return;
  }

  // Use resolved values if metadata was missing
  if (!product) {
    product = resolved.product as 'store' | 'lister' | 'automation' | 'finance' | 'bundle';
  }
  if (!tier) {
    tier = resolved.tier;
  }

  // 5. Map Stripe status
  const status = mapStripeStatus(subscription.status);

  // 6. Extract dates from the first subscription item (new API version)
  const firstItem = subscription.items.data[0];
  if (!firstItem) {
    logger.error('Subscription webhook: no subscription items found');
    return;
  }
  const currentPeriodStart = new Date(firstItem.current_period_start * 1000);
  const currentPeriodEnd = new Date(firstItem.current_period_end * 1000);
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;
  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;

  // 7. Route to correct upsert function
  switch (product) {
    case 'store':
      await upsertStoreSubscription({
        sellerProfileId,
        tier: tier as StoreTier,
        status,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        trialEndsAt,
      });
      break;

    case 'lister':
      // F4-S2: upsertListerSubscription handles rollover credit wiring internally
      await upsertListerSubscription({
        sellerProfileId,
        tier: tier as ListerTier,
        status,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      });
      break;

    case 'automation':
      // Automation has no tier enum — just status
      await upsertAutomationSubscription({
        sellerProfileId,
        status,
        stripeSubscriptionId: subscription.id,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      });
      break;

    case 'finance':
      await upsertFinanceSubscription({
        sellerProfileId,
        tier: tier as FinanceTier,
        status,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      });
      break;

    case 'bundle':
      await upsertBundleSubscription({
        sellerProfileId,
        tier: tier as BundleTier,
        status,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        trialEndsAt,
      });
      break;

    default:
      logger.error('Subscription webhook: unknown product type', { product });
  }
}

/**
 * Handle customer.subscription.deleted.
 * Stripe sends this when a subscription is fully canceled (not just cancel_at_period_end).
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  // Look up which product this subscription belongs to
  const result = await findSubscriptionByStripeId(subscription.id);
  if (!result) {
    // Subscription not in our DB — possibly already cleaned up or never synced
    logger.warn('Subscription webhook: deleted subscription not found', { subscriptionId: subscription.id });
    return;
  }

  // F4-S2: cancelSubscription handles rollover credit forfeiture internally for lister
  await cancelSubscription({
    product: result.product,
    sellerProfileId: result.sellerProfileId,
    stripeSubscriptionId: subscription.id,
  });
}

/**
 * Handle invoice.payment_failed — notify the subscriber of a failed charge.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const seller = await findSellerByStripeCustomerId(customerId);
  if (!seller) {
    logger.warn('[subscription] invoice.payment_failed: no user for customer', { customerId });
    return;
  }

  void notify(seller.userId, 'subscription.payment_failed', {
    invoiceId: invoice.id,
    amountDue: `$${((invoice.amount_due ?? 0) / 100).toFixed(2)}`,
  }).catch(() => {});

  logger.info('[subscription] invoice.payment_failed — notified user', { userId: seller.userId });
}

/**
 * Main webhook dispatcher for subscription events.
 * Called from the API route after signature verification.
 */
export async function handleSubscriptionWebhook(event: Stripe.Event): Promise<void> {
  // Durable two-layer dedup: Valkey (fast) + DB stripe_event_log (durable)
  if (await isWebhookDuplicate(event.id)) {
    logger.info('[subscription-webhook] Duplicate event skipped', { eventId: event.id });
    return;
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpsert(sub);
      // D3-S4: After processing the upsert, check if a pending downgrade should be applied
      if (event.type === 'customer.subscription.updated') {
        await applyPendingDowngradeIfNeeded(sub.id, sub,
          (subId, params) => stripe.subscriptions.update(subId, params)
        );
      }
      break;
    }

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      break;
  }

  // Mark as processed in both Valkey + DB
  await markWebhookProcessed(event.id, event.type, event.data.object);
}
