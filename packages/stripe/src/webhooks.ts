/**
 * Stripe Webhook Handlers
 *
 * Handles both platform webhooks and Connect webhooks.
 * Webhook signature verification is done in the route handlers.
 */

import type Stripe from 'stripe';
import { db } from '@twicely/db';
import { order, sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { syncAccountStatus } from './connect';
import { handleTrialWillEnd, handleSubscriptionUpdated } from './webhook-trial-handlers';
import { handleChargebackWebhook, handleChargebackResolution } from './chargebacks';
import { handleCheckoutSessionCompleted } from './checkout-webhooks';
import { handleChargeRefunded } from './webhook-refund-handler';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { getValkeyClient } from '@twicely/db/cache';

export type WebhookResult = {
  handled: boolean;
  error?: string;
};

/**
 * M3 Security: Deduplicate webhook events via Valkey (24h TTL).
 * Prevents duplicate processing from Stripe retries.
 */
async function isWebhookDuplicate(eventId: string): Promise<boolean> {
  try {
    const valkey = getValkeyClient();
    const result = await valkey.set(`stripe-webhook:${eventId}`, '1', 'EX', 86400, 'NX');
    return result === null; // NX returns null if key already existed
  } catch {
    return false; // Valkey down — fail open, allow processing
  }
}

/**
 * Handle platform webhook events (payment_intent, customer, etc.).
 */
export async function handlePlatformWebhook(event: Stripe.Event): Promise<WebhookResult> {
  if (await isWebhookDuplicate(event.id)) {
    logger.info('[webhook] Duplicate event skipped', { eventId: event.id, type: event.type });
    return { handled: true };
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);

    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);

    case 'customer.subscription.trial_will_end':
      return handleTrialWillEnd(event.data.object as Stripe.Subscription);

    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(event.data.object as Stripe.Subscription);

    case 'charge.refunded':
      return handleChargeRefunded(event.data.object as Stripe.Charge);

    case 'charge.dispute.created':
      return handleChargeDispute(event.data.object as Stripe.Dispute);

    case 'charge.dispute.updated':
    case 'charge.dispute.closed':
      return handleChargeDisputeResolution(event.data.object as Stripe.Dispute);

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      // Only handle one-time payments here — subscriptions are handled by the subscriptions webhook
      if (session.mode === 'payment') {
        await handleCheckoutSessionCompleted(session);
      }
      return { handled: true };
    }

    case 'payment_intent.canceled':
      return handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);

    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);

    default:
      // Unhandled event type — not an error, just not processed
      return { handled: false };
  }
}

/**
 * Handle Connect webhook events (account.updated, etc.).
 */
export async function handleConnectWebhook(event: Stripe.Event): Promise<WebhookResult> {
  if (await isWebhookDuplicate(event.id)) {
    logger.info('[webhook] Duplicate connect event skipped', { eventId: event.id, type: event.type });
    return { handled: true };
  }

  switch (event.type) {
    case 'account.updated':
      return handleAccountUpdated(event.data.object as Stripe.Account);

    case 'payout.paid':
      return handlePayoutPaid(event.data.object as Stripe.Payout, event.account);

    case 'payout.failed':
      return handlePayoutFailed(event.data.object as Stripe.Payout, event.account);

    default:
      return { handled: false };
  }
}

/**
 * PaymentIntent succeeded — mark orders as PAID.
 * This is the webhook-based confirmation (backup to client-side finalizeOrder).
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<WebhookResult> {
  try {
    const paymentIntentId = paymentIntent.id;

    // Find orders with this paymentIntentId that aren't already PAID
    const orders = await db
      .select({
        id: order.id,
        status: order.status,
        orderNumber: order.orderNumber,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        totalCents: order.totalCents,
      })
      .from(order)
      .where(eq(order.paymentIntentId, paymentIntentId));

    if (orders.length === 0) {
      // No orders found — might be an offer payment or other flow
      return { handled: true };
    }

    const now = new Date();
    for (const ord of orders) {
      if (ord.status === 'CREATED' || ord.status === 'PAYMENT_PENDING') {
        await db
          .update(order)
          .set({
            status: 'PAID',
            paidAt: now,
            updatedAt: now,
          })
          .where(eq(order.id, ord.id));

        // Notify buyer of order confirmation
        const totalFormatted = `$${(ord.totalCents / 100).toFixed(2)}`;
        await notify(ord.buyerId, 'order.confirmed', {
          orderNumber: ord.orderNumber,
          totalFormatted,
        });
      }
    }

    return { handled: true };
  } catch (error) {
    logger.error('Error handling payment_intent.succeeded', { error });
    return {
      handled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * PaymentIntent failed — mark orders as failed.
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<WebhookResult> {
  try {
    const paymentIntentId = paymentIntent.id;

    // Find orders with this paymentIntentId
    const orders = await db
      .select({ id: order.id, status: order.status, orderNumber: order.orderNumber, buyerId: order.buyerId })
      .from(order)
      .where(eq(order.paymentIntentId, paymentIntentId));

    if (orders.length === 0) {
      return { handled: true };
    }

    const now = new Date();
    for (const ord of orders) {
      // Only mark as canceled if not already in a terminal state
      if (ord.status === 'CREATED' || ord.status === 'PAYMENT_PENDING') {
        await db
          .update(order)
          .set({
            status: 'CANCELED',
            cancelReason: `Payment failed: ${paymentIntent.last_payment_error?.message ?? 'Unknown error'}`,
            cancelInitiator: 'SYSTEM',
            canceledAt: now,
            updatedAt: now,
          })
          .where(eq(order.id, ord.id));

        void notify(ord.buyerId, 'order.canceled', {
          orderNumber: ord.orderNumber,
          cancelReason: paymentIntent.last_payment_error?.message ?? 'Unable to process payment',
        }).catch(() => {});
      }
    }

    return { handled: true };
  } catch (error) {
    logger.error('Error handling payment_intent.payment_failed', { error });
    return {
      handled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Connect account updated — sync status to seller profile.
 */
async function handleAccountUpdated(account: Stripe.Account): Promise<WebhookResult> {
  try {
    await syncAccountStatus(account.id);
    return { handled: true };
  } catch (error) {
    logger.error('Error handling account.updated', { error });
    return {
      handled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Chargeback created — handle via chargebacks module.
 */
async function handleChargeDispute(dispute: Stripe.Dispute): Promise<WebhookResult> {
  try {
    const result = await handleChargebackWebhook(dispute);
    return { handled: result.success, error: result.error };
  } catch (error) {
    logger.error('Error handling charge.dispute.created', { error });
    return {
      handled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Chargeback updated/closed — handle resolution.
 */
async function handleChargeDisputeResolution(dispute: Stripe.Dispute): Promise<WebhookResult> {
  try {
    await handleChargebackResolution(dispute);
    return { handled: true };
  } catch (error) {
    logger.error('Error handling charge.dispute resolution', { error });
    return {
      handled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * PaymentIntent canceled — Stripe auto-cancels stale PIs after 24h.
 * Cancel any CREATED/PAYMENT_PENDING orders to prevent ghost orders.
 */
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<WebhookResult> {
  try {
    const orders = await db
      .select({ id: order.id, status: order.status, orderNumber: order.orderNumber, buyerId: order.buyerId })
      .from(order)
      .where(eq(order.paymentIntentId, paymentIntent.id));

    if (orders.length === 0) {
      return { handled: true };
    }

    const now = new Date();
    for (const ord of orders) {
      if (ord.status === 'CREATED' || ord.status === 'PAYMENT_PENDING') {
        await db
          .update(order)
          .set({
            status: 'CANCELED',
            cancelReason: 'Payment intent canceled by Stripe',
            cancelInitiator: 'SYSTEM',
            canceledAt: now,
            updatedAt: now,
          })
          .where(eq(order.id, ord.id));

        void notify(ord.buyerId, 'order.canceled', {
          orderNumber: ord.orderNumber,
          cancelReason: 'Your payment session expired. Please place a new order.',
        }).catch(() => {});
      }
    }

    return { handled: true };
  } catch (error) {
    logger.error('Error handling payment_intent.canceled', { error });
    return { handled: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Payout paid — Stripe successfully sent funds to the seller's bank account.
 */
async function handlePayoutPaid(payout: Stripe.Payout, stripeAccountId: string | undefined): Promise<WebhookResult> {
  if (!stripeAccountId) {
    return { handled: true };
  }
  try {
    const [seller] = await db
      .select({ userId: sellerProfile.userId })
      .from(sellerProfile)
      .where(eq(sellerProfile.stripeAccountId, stripeAccountId))
      .limit(1);

    if (!seller) {
      return { handled: true };
    }

    const amountFormatted = `$${(payout.amount / 100).toFixed(2)}`;
    void notify(seller.userId, 'seller.payout.paid', { amountFormatted }).catch(() => {});

    logger.info('[webhook] payout.paid — seller notified', {
      stripeAccountId,
      payoutId: payout.id,
      amountCents: payout.amount,
    });

    return { handled: true };
  } catch (error) {
    logger.error('Error handling payout.paid', { error });
    return { handled: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Payout failed — bank rejected or Stripe failed the payout to the seller's account.
 */
async function handlePayoutFailed(payout: Stripe.Payout, stripeAccountId: string | undefined): Promise<WebhookResult> {
  if (!stripeAccountId) {
    return { handled: true };
  }
  try {
    const [seller] = await db
      .select({ userId: sellerProfile.userId })
      .from(sellerProfile)
      .where(eq(sellerProfile.stripeAccountId, stripeAccountId))
      .limit(1);

    if (!seller) {
      return { handled: true };
    }

    const amountFormatted = `$${(payout.amount / 100).toFixed(2)}`;
    const failureReason = payout.failure_message ?? 'Unknown error — please check your bank account details.';

    void notify(seller.userId, 'seller.payout.failed', { amountFormatted, failureReason }).catch(() => {});

    logger.warn('[webhook] payout.failed — seller notified', {
      stripeAccountId,
      payoutId: payout.id,
      amountCents: payout.amount,
      failureCode: payout.failure_code,
    });

    return { handled: true };
  } catch (error) {
    logger.error('Error handling payout.failed', { error });
    return { handled: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Handle invoice.payment_failed — subscription renewal hard-failure (dunning).
 * Notifies the seller that their subscription payment failed.
 * Stripe's native dunning will also email the customer, but we add an
 * in-app notification so it surfaces in the Twicely dashboard.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<WebhookResult> {
  try {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return { handled: true };

    // Find the seller by Stripe customer ID
    const [seller] = await db
      .select({ userId: sellerProfile.userId })
      .from(sellerProfile)
      .where(eq(sellerProfile.stripeCustomerId, customerId))
      .limit(1);

    if (!seller) {
      logger.warn('[webhook] invoice.payment_failed: no seller found for customer', { customerId });
      return { handled: true };
    }

    await notify(seller.userId, 'subscription.payment_failed', {
      invoiceId: invoice.id,
      amountDue: String(invoice.amount_due),
      currency: invoice.currency ?? 'usd',
      attemptCount: String(invoice.attempt_count),
      nextAttemptAt: invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000).toISOString()
        : '',
    });

    logger.info('[webhook] invoice.payment_failed processed', {
      userId: seller.userId,
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count,
    });

    return { handled: true };
  } catch (error) {
    logger.error('[webhook] Error handling invoice.payment_failed', { error });
    return { handled: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Verify webhook signature and construct event.
 * Use appropriate secret based on webhook type.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string,
  stripe: Stripe
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
