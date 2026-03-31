/**
 * D3-S2: Subscription Mutations
 *
 * Write operations for subscription tables. Called by webhook handler.
 * All functions use transactions to ensure atomicity between subscription
 * table updates and sellerProfile tier changes.
 */

import { db } from '@twicely/db';
import {
  sellerProfile,
  storeSubscription,
  listerSubscription,
  publishCreditLedger,
} from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import type { StoreTier, ListerTier, SubscriptionStatus } from '@twicely/db/types';
import { addMonthlyCredits } from '@twicely/crosslister/services/rollover-manager';
import { reactivateUnmanagedProjections } from '@twicely/crosslister/services/projection-cascade';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get user ID from seller profile ID.
 * Used by webhook handlers to resolve userId for credit operations.
 */
async function getUserIdFromSellerProfileId(
  sellerProfileId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: sellerProfile.userId })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);
  return row?.userId ?? null;
}

// ─── Store Subscription ─────────────────────────────────────────────────────

export async function upsertStoreSubscription(params: {
  sellerProfileId: string;
  tier: StoreTier;
  status: SubscriptionStatus;
  stripeSubscriptionId: string;
  stripePriceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: Date | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    // Check if subscription exists
    const [existing] = await tx
      .select({ id: storeSubscription.id })
      .from(storeSubscription)
      .where(eq(storeSubscription.sellerProfileId, params.sellerProfileId))
      .limit(1);

    if (existing) {
      // Update existing subscription
      await tx
        .update(storeSubscription)
        .set({
          tier: params.tier,
          status: params.status,
          stripeSubscriptionId: params.stripeSubscriptionId,
          stripePriceId: params.stripePriceId,
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
          cancelAtPeriodEnd: params.cancelAtPeriodEnd,
          trialEndsAt: params.trialEndsAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(storeSubscription.id, existing.id));
    } else {
      // Insert new subscription
      await tx.insert(storeSubscription).values({
        sellerProfileId: params.sellerProfileId,
        tier: params.tier,
        status: params.status,
        stripeSubscriptionId: params.stripeSubscriptionId,
        stripePriceId: params.stripePriceId,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
        trialEndsAt: params.trialEndsAt ?? null,
      });
    }

    // Always update sellerProfile.storeTier
    await tx
      .update(sellerProfile)
      .set({ storeTier: params.tier, updatedAt: new Date() })
      .where(eq(sellerProfile.id, params.sellerProfileId));
  });
}

// ─── Lister Subscription ────────────────────────────────────────────────────

export async function upsertListerSubscription(params: {
  sellerProfileId: string;
  tier: ListerTier;
  status: SubscriptionStatus;
  stripeSubscriptionId: string;
  stripePriceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}): Promise<void> {
  // Read current listerTier before any update so we can detect FREE → paid upgrade
  const [currentProfile] = await db
    .select({ listerTier: sellerProfile.listerTier })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, params.sellerProfileId))
    .limit(1);
  const existingTier: ListerTier = currentProfile?.listerTier ?? 'FREE';

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: listerSubscription.id })
      .from(listerSubscription)
      .where(eq(listerSubscription.sellerProfileId, params.sellerProfileId))
      .limit(1);

    if (existing) {
      await tx
        .update(listerSubscription)
        .set({
          tier: params.tier,
          status: params.status,
          stripeSubscriptionId: params.stripeSubscriptionId,
          stripePriceId: params.stripePriceId,
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
          cancelAtPeriodEnd: params.cancelAtPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(listerSubscription.id, existing.id));
    } else {
      await tx.insert(listerSubscription).values({
        sellerProfileId: params.sellerProfileId,
        tier: params.tier,
        status: params.status,
        stripeSubscriptionId: params.stripeSubscriptionId,
        stripePriceId: params.stripePriceId,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      });
    }

    await tx
      .update(sellerProfile)
      .set({ listerTier: params.tier, updatedAt: new Date() })
      .where(eq(sellerProfile.id, params.sellerProfileId));
  });

  // F4-S2: Add monthly credits on period renewal (idempotent via periodStart check)
  // Only for ACTIVE/TRIALING statuses — no credits on PAST_DUE/CANCELED/etc.
  if (params.status === 'ACTIVE' || params.status === 'TRIALING') {
    const userId = await getUserIdFromSellerProfileId(params.sellerProfileId);
    if (userId) {
      // Idempotency check: only add credits if no MONTHLY row exists for this periodStart
      const [creditExists] = await db
        .select({ id: publishCreditLedger.id })
        .from(publishCreditLedger)
        .where(and(
          eq(publishCreditLedger.userId, userId),
          eq(publishCreditLedger.creditType, 'MONTHLY'),
          eq(publishCreditLedger.periodStart, params.currentPeriodStart),
        ))
        .limit(1);

      if (!creditExists) {
        // Fetch the lister subscription ID for credit linkage
        const [listerSub] = await db
          .select({ id: listerSubscription.id })
          .from(listerSubscription)
          .where(eq(listerSubscription.sellerProfileId, params.sellerProfileId))
          .limit(1);

        if (listerSub) {
          await addMonthlyCredits(
            userId,
            params.tier,
            params.currentPeriodStart,
            params.currentPeriodEnd,
            listerSub.id,
          );
        }
      }

      // Projection lifecycle: reactivate UNMANAGED projections on upgrade from FREE
      if (existingTier === 'FREE' && params.tier !== 'FREE' && params.tier !== 'NONE') {
        await reactivateUnmanagedProjections(userId);
      }
    }
  }
}

// Re-export add-on mutations for backward compatibility
export {
  upsertAutomationSubscription,
  upsertFinanceSubscription,
  upsertBundleSubscription,
} from './subscriptions-addons';

// Re-export from split file for backward compatibility
export { cancelSubscription, setStripeCustomerId } from './cancel-subscription';
