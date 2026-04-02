/**
 * D3-S4: Apply Pending Downgrade at Renewal
 *
 * Called by the subscription webhook handler after processing a
 * customer.subscription.updated event. If a pending tier/interval
 * change is stored and the change date has arrived, applies it
 * via Stripe and updates the local DB.
 */

import type Stripe from 'stripe';
import { logger } from '@twicely/logger';
import { db } from '@twicely/db';
import {
  sellerProfile,
  storeSubscription,
  listerSubscription,
  financeSubscription,
  bundleSubscription,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getStripePriceId } from './price-map';
import { getBillingIntervalFromPriceId } from './subscription-engine';
import { resolveBundleComponents } from './bundle-resolution';
import type { StoreTier, ListerTier, FinanceTier, BundleTier } from '@twicely/db/types';
import type { BillingInterval } from './price-map';

// ─── Callback Types (DI to avoid circular dep on @twicely/stripe) ────────────

export type StripeSubscriptionUpdater = (
  subId: string,
  params: { items: Array<{ id: string; price: string }>; proration_behavior: 'none' }
) => Promise<unknown>;

// ─── Types ──────────────────────────────────────────────────────────────────

interface PendingSubscription {
  product: 'store' | 'lister' | 'finance' | 'bundle';
  subscriptionId: string;
  sellerProfileId: string;
  currentTier: string;
  stripePriceId: string | null;
  pendingTier: string | null;
  pendingBillingInterval: string | null;
  pendingChangeAt: Date | null;
}

// ─── Lookup ─────────────────────────────────────────────────────────────────

async function findPendingSubscription(
  stripeSubId: string
): Promise<PendingSubscription | null> {
  const [storeRow] = await db
    .select({
      subscriptionId: storeSubscription.id,
      sellerProfileId: storeSubscription.sellerProfileId,
      currentTier: storeSubscription.tier,
      stripePriceId: storeSubscription.stripePriceId,
      pendingTier: storeSubscription.pendingTier,
      pendingBillingInterval: storeSubscription.pendingBillingInterval,
      pendingChangeAt: storeSubscription.pendingChangeAt,
    })
    .from(storeSubscription)
    .where(eq(storeSubscription.stripeSubscriptionId, stripeSubId))
    .limit(1);
  if (storeRow) return { product: 'store', ...storeRow };

  const [listerRow] = await db
    .select({
      subscriptionId: listerSubscription.id,
      sellerProfileId: listerSubscription.sellerProfileId,
      currentTier: listerSubscription.tier,
      stripePriceId: listerSubscription.stripePriceId,
      pendingTier: listerSubscription.pendingTier,
      pendingBillingInterval: listerSubscription.pendingBillingInterval,
      pendingChangeAt: listerSubscription.pendingChangeAt,
    })
    .from(listerSubscription)
    .where(eq(listerSubscription.stripeSubscriptionId, stripeSubId))
    .limit(1);
  if (listerRow) return { product: 'lister', ...listerRow };

  const [financeRow] = await db
    .select({
      subscriptionId: financeSubscription.id,
      sellerProfileId: financeSubscription.sellerProfileId,
      currentTier: financeSubscription.tier,
      stripePriceId: financeSubscription.stripePriceId,
      pendingTier: financeSubscription.pendingTier,
      pendingBillingInterval: financeSubscription.pendingBillingInterval,
      pendingChangeAt: financeSubscription.pendingChangeAt,
    })
    .from(financeSubscription)
    .where(eq(financeSubscription.stripeSubscriptionId, stripeSubId))
    .limit(1);
  if (financeRow) return { product: 'finance', ...financeRow };

  const [bundleRow] = await db
    .select({
      subscriptionId: bundleSubscription.id,
      sellerProfileId: bundleSubscription.sellerProfileId,
      currentTier: bundleSubscription.tier,
      stripePriceId: bundleSubscription.stripePriceId,
      pendingTier: bundleSubscription.pendingTier,
      pendingBillingInterval: bundleSubscription.pendingBillingInterval,
      pendingChangeAt: bundleSubscription.pendingChangeAt,
    })
    .from(bundleSubscription)
    .where(eq(bundleSubscription.stripeSubscriptionId, stripeSubId))
    .limit(1);
  if (bundleRow) return { product: 'bundle', ...bundleRow };

  return null;
}

// ─── Apply ──────────────────────────────────────────────────────────────────

/**
 * Check if a pending downgrade/interval change should be applied now.
 * Called after handleSubscriptionUpsert on customer.subscription.updated.
 */
export async function applyPendingDowngradeIfNeeded(
  stripeSubscriptionId: string,
  stripeSubscription: Stripe.Subscription,
  updateSubscription: StripeSubscriptionUpdater
): Promise<void> {
  const pending = await findPendingSubscription(stripeSubscriptionId);
  if (!pending) return;

  // No pending change stored
  if (!pending.pendingTier && !pending.pendingBillingInterval) return;

  // Not yet time — pendingChangeAt is in the future
  if (pending.pendingChangeAt && pending.pendingChangeAt > new Date()) return;

  // Resolve current interval from stored price ID
  const currentInterval = pending.stripePriceId
    ? getBillingIntervalFromPriceId(pending.stripePriceId)
    : null;

  const newTier = pending.pendingTier ?? pending.currentTier;
  const newInterval: BillingInterval =
    (pending.pendingBillingInterval as BillingInterval) ?? currentInterval ?? 'monthly';

  const newPriceId = getStripePriceId(pending.product, newTier, newInterval);
  if (!newPriceId) {
    logger.error('applyPendingDowngrade: could not resolve price ID', { product: pending.product, tier: newTier, interval: newInterval });
    return;
  }

  // Apply via Stripe — no proration since this is a new billing period
  const itemId = stripeSubscription.items.data[0]?.id;
  if (!itemId) {
    logger.error('applyPendingDowngrade: no subscription item found');
    return;
  }

  try {
    await updateSubscription(stripeSubscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'none',
    });
  } catch (err) {
    logger.error('applyPendingDowngrade: Stripe update failed', { error: err });
    throw err; // Let webhook return 500 so Stripe retries
  }

  // Update local DB: apply the change and clear pending fields
  const now = new Date();

  await db.transaction(async (tx) => {
    switch (pending.product) {
      case 'store':
        await tx.update(storeSubscription).set({
          tier: newTier as StoreTier,
          stripePriceId: newPriceId,
          pendingTier: null,
          pendingBillingInterval: null,
          pendingChangeAt: null,
          updatedAt: now,
        }).where(eq(storeSubscription.id, pending.subscriptionId));
        await tx.update(sellerProfile).set({
          storeTier: newTier as StoreTier,
          updatedAt: now,
        }).where(eq(sellerProfile.id, pending.sellerProfileId));
        break;

      case 'lister':
        await tx.update(listerSubscription).set({
          tier: newTier as ListerTier,
          stripePriceId: newPriceId,
          pendingTier: null,
          pendingBillingInterval: null,
          pendingChangeAt: null,
          updatedAt: now,
        }).where(eq(listerSubscription.id, pending.subscriptionId));
        await tx.update(sellerProfile).set({
          listerTier: newTier as ListerTier,
          updatedAt: now,
        }).where(eq(sellerProfile.id, pending.sellerProfileId));
        break;

      case 'finance':
        await tx.update(financeSubscription).set({
          tier: newTier as FinanceTier,
          stripePriceId: newPriceId,
          pendingTier: null,
          pendingBillingInterval: null,
          pendingChangeAt: null,
          updatedAt: now,
        }).where(eq(financeSubscription.id, pending.subscriptionId));
        await tx.update(sellerProfile).set({
          financeTier: newTier as FinanceTier,
          updatedAt: now,
        }).where(eq(sellerProfile.id, pending.sellerProfileId));
        break;

      case 'bundle': {
        const components = resolveBundleComponents(newTier as BundleTier);
        await tx.update(bundleSubscription).set({
          tier: newTier as BundleTier,
          stripePriceId: newPriceId,
          pendingTier: null,
          pendingBillingInterval: null,
          pendingChangeAt: null,
          updatedAt: now,
        }).where(eq(bundleSubscription.id, pending.subscriptionId));
        await tx.update(sellerProfile).set({
          bundleTier: newTier as BundleTier,
          storeTier: components.storeTier,
          listerTier: components.listerTier,
          financeTier: components.financeTier,
          hasAutomation: components.hasAutomation,
          updatedAt: now,
        }).where(eq(sellerProfile.id, pending.sellerProfileId));
        break;
      }
    }
  });
}
