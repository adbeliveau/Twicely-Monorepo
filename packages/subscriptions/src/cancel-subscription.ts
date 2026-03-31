/**
 * D3-S2: Cancel Subscription + Stripe Customer ID
 *
 * Extracted from subscriptions.ts to stay under 300 lines.
 */

import { db } from '@twicely/db';
import {
  sellerProfile,
  storeSubscription,
  listerSubscription,
  automationSubscription,
  financeSubscription,
  bundleSubscription,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { forfeitAllCredits } from '@twicely/crosslister/services/rollover-manager';
import { getUserIdFromSellerProfileId } from './queries';
import { cascadeProjectionsToUnmanaged } from '@twicely/crosslister/services/projection-cascade';

// ─── Cancel Subscription ────────────────────────────────────────────────────

/**
 * Handle subscription cancellation.
 * Sets subscription status = 'CANCELED', canceledAt = now.
 * Reverts sellerProfile tier to free/none.
 *
 * Note: lister reverts to 'FREE' (not 'NONE') — FREE is the default crosslister tier.
 * Note: automationSubscription has no canceledAt column — only status is updated.
 */
export async function cancelSubscription(params: {
  product: 'store' | 'lister' | 'automation' | 'finance' | 'bundle';
  sellerProfileId: string;
  stripeSubscriptionId: string;
}): Promise<void> {
  const now = new Date();

  await db.transaction(async (tx) => {
    switch (params.product) {
      case 'store':
        await tx
          .update(storeSubscription)
          .set({
            status: 'CANCELED',
            canceledAt: now,
            pendingTier: null,
            pendingBillingInterval: null,
            pendingChangeAt: null,
            updatedAt: now,
          })
          .where(eq(storeSubscription.stripeSubscriptionId, params.stripeSubscriptionId));
        await tx
          .update(sellerProfile)
          .set({ storeTier: 'NONE', updatedAt: now })
          .where(eq(sellerProfile.id, params.sellerProfileId));
        break;

      case 'lister':
        await tx
          .update(listerSubscription)
          .set({
            status: 'CANCELED',
            canceledAt: now,
            pendingTier: null,
            pendingBillingInterval: null,
            pendingChangeAt: null,
            updatedAt: now,
          })
          .where(eq(listerSubscription.stripeSubscriptionId, params.stripeSubscriptionId));
        // FREE is the default crosslister tier, not NONE
        await tx
          .update(sellerProfile)
          .set({ listerTier: 'FREE', updatedAt: now })
          .where(eq(sellerProfile.id, params.sellerProfileId));
        break;

      case 'automation':
        // FIX 1: automationSubscription has no canceledAt column
        // Only update status (not cancelAtPeriodEnd — that's for pending cancellation)
        await tx
          .update(automationSubscription)
          .set({ status: 'CANCELED', updatedAt: now })
          .where(eq(automationSubscription.stripeSubscriptionId, params.stripeSubscriptionId));
        await tx
          .update(sellerProfile)
          .set({ hasAutomation: false, updatedAt: now })
          .where(eq(sellerProfile.id, params.sellerProfileId));
        break;

      case 'finance':
        await tx
          .update(financeSubscription)
          .set({
            status: 'CANCELED',
            canceledAt: now,
            pendingTier: null,
            pendingBillingInterval: null,
            pendingChangeAt: null,
            updatedAt: now,
          })
          .where(eq(financeSubscription.stripeSubscriptionId, params.stripeSubscriptionId));
        await tx
          .update(sellerProfile)
          .set({ financeTier: 'FREE', updatedAt: now })
          .where(eq(sellerProfile.id, params.sellerProfileId));
        break;

      case 'bundle':
        await tx
          .update(bundleSubscription)
          .set({
            status: 'CANCELED',
            pendingTier: null,
            pendingBillingInterval: null,
            pendingChangeAt: null,
            updatedAt: now,
          })
          .where(eq(bundleSubscription.stripeSubscriptionId, params.stripeSubscriptionId));
        await tx.update(sellerProfile).set({
          bundleTier: 'NONE',
          storeTier: 'NONE',
          listerTier: 'FREE', // FREE is the default crosslister tier, not NONE
          financeTier: 'FREE',
          hasAutomation: false,
          updatedAt: now,
        }).where(eq(sellerProfile.id, params.sellerProfileId));
        break;
    }
  });

  // F4-S2: Forfeit all rollover credits on lister cancellation
  // Called on customer.subscription.deleted — seller keeps credits until period ends
  if (params.product === 'lister') {
    const userId = await getUserIdFromSellerProfileId(params.sellerProfileId);
    if (userId) {
      await forfeitAllCredits(userId);
    }
  }

  // Projection lifecycle: cascade ACTIVE → UNMANAGED when lister/bundle ends
  if (params.product === 'lister' || params.product === 'bundle') {
    const userId = await getUserIdFromSellerProfileId(params.sellerProfileId);
    if (userId) {
      await cascadeProjectionsToUnmanaged(userId);
    }
  }
}

// ─── Stripe Customer ID ─────────────────────────────────────────────────────

/**
 * Store Stripe Customer ID on seller profile (first-time subscription).
 */
export async function setStripeCustomerId(
  sellerProfileId: string,
  stripeCustomerId: string
): Promise<void> {
  await db
    .update(sellerProfile)
    .set({ stripeCustomerId, updatedAt: new Date() })
    .where(eq(sellerProfile.id, sellerProfileId));
}
