/**
 * D3-S1: Subscription Queries
 *
 * Read-only queries for subscription data. No mutations here.
 */

import { db } from '@twicely/db';
import {
  storeSubscription,
  listerSubscription,
  automationSubscription,
  financeSubscription,
  bundleSubscription,
} from '@twicely/db/schema/subscriptions';
import { sellerProfile } from '@twicely/db/schema/identity';
import { eq } from 'drizzle-orm';
import type { StoreTier, ListerTier, FinanceTier, BundleTier } from '@/types/enums';
import { getBillingIntervalFromPriceId } from '@twicely/subscriptions/subscription-engine';

// Re-export profile ID helpers (moved to subscription-profile.ts to keep this file ≤300 lines)
export { getSellerProfileIdByUserId, getUserIdFromSellerProfileId } from './subscription-profile';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SubscriptionSnapshot {
  storeTier: StoreTier;
  listerTier: ListerTier;
  financeTier: FinanceTier;
  hasAutomation: boolean;
  // D3-S4: Pending downgrade info per product
  storePendingTier: StoreTier | null;
  storePendingChangeAt: Date | null;
  storePendingBillingInterval: 'monthly' | 'annual' | null;
  listerPendingTier: ListerTier | null;
  listerPendingChangeAt: Date | null;
  listerPendingBillingInterval: 'monthly' | 'annual' | null;
  financePendingTier: 'FREE' | 'PRO' | null;
  financePendingChangeAt: Date | null;
  financePendingBillingInterval: 'monthly' | 'annual' | null;
  // D3-S4: Current billing intervals (derived from stripePriceId)
  storeBillingInterval: 'monthly' | 'annual' | null;
  listerBillingInterval: 'monthly' | 'annual' | null;
  financeBillingInterval: 'monthly' | 'annual' | null;
  storeSubscription: {
    id: string;
    status: string;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  listerSubscription: {
    id: string;
    status: string;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  automationSubscription: {
    id: string;
    status: string;
    stripeSubscriptionId: string | null;
    creditsIncluded: number;
    creditsUsed: number;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  financeSubscription: {
    id: string;
    status: string;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  // D3-S5: Bundle subscription info
  bundleTier: BundleTier;
  bundleSubscription: { id: string; status: string; stripeSubscriptionId: string | null; stripePriceId: string | null; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean } | null;
  bundlePendingTier: BundleTier | null;
  bundlePendingChangeAt: Date | null;
  bundlePendingBillingInterval: 'monthly' | 'annual' | null;
  bundleBillingInterval: 'monthly' | 'annual' | null;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Get full subscription snapshot for a seller profile.
 * @internal — sellerProfileId must be derived from session via getSellerProfileIdByUserId.
 * NEVER accept from request body.
 */
export async function getSubscriptionSnapshot(
  sellerProfileId: string
): Promise<SubscriptionSnapshot | null> {
  // Get profile tiers first (must succeed before other queries)
  const [profile] = await db
    .select({
      storeTier: sellerProfile.storeTier,
      listerTier: sellerProfile.listerTier,
      financeTier: sellerProfile.financeTier,
      hasAutomation: sellerProfile.hasAutomation,
      bundleTier: sellerProfile.bundleTier,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);

  if (!profile) return null;

  // Fetch all 4 subscription types in parallel (independent queries)
  const [storeResults, listerResults, autoResults, financeResults, bundleResults] = await Promise.all([
    db
      .select({
        id: storeSubscription.id,
        status: storeSubscription.status,
        stripeSubscriptionId: storeSubscription.stripeSubscriptionId,
        stripePriceId: storeSubscription.stripePriceId,
        currentPeriodEnd: storeSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: storeSubscription.cancelAtPeriodEnd,
        pendingTier: storeSubscription.pendingTier,
        pendingBillingInterval: storeSubscription.pendingBillingInterval,
        pendingChangeAt: storeSubscription.pendingChangeAt,
      })
      .from(storeSubscription)
      .where(eq(storeSubscription.sellerProfileId, sellerProfileId))
      .limit(1),
    db
      .select({
        id: listerSubscription.id,
        status: listerSubscription.status,
        stripeSubscriptionId: listerSubscription.stripeSubscriptionId,
        stripePriceId: listerSubscription.stripePriceId,
        currentPeriodEnd: listerSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: listerSubscription.cancelAtPeriodEnd,
        pendingTier: listerSubscription.pendingTier,
        pendingBillingInterval: listerSubscription.pendingBillingInterval,
        pendingChangeAt: listerSubscription.pendingChangeAt,
      })
      .from(listerSubscription)
      .where(eq(listerSubscription.sellerProfileId, sellerProfileId))
      .limit(1),
    db
      .select({
        id: automationSubscription.id,
        status: automationSubscription.status,
        stripeSubscriptionId: automationSubscription.stripeSubscriptionId,
        creditsIncluded: automationSubscription.creditsIncluded,
        creditsUsed: automationSubscription.creditsUsed,
        currentPeriodEnd: automationSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: automationSubscription.cancelAtPeriodEnd,
      })
      .from(automationSubscription)
      .where(eq(automationSubscription.sellerProfileId, sellerProfileId))
      .limit(1),
    db
      .select({
        id: financeSubscription.id,
        status: financeSubscription.status,
        stripeSubscriptionId: financeSubscription.stripeSubscriptionId,
        stripePriceId: financeSubscription.stripePriceId,
        currentPeriodEnd: financeSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: financeSubscription.cancelAtPeriodEnd,
        pendingTier: financeSubscription.pendingTier,
        pendingBillingInterval: financeSubscription.pendingBillingInterval,
        pendingChangeAt: financeSubscription.pendingChangeAt,
      })
      .from(financeSubscription)
      .where(eq(financeSubscription.sellerProfileId, sellerProfileId))
      .limit(1),
    db.select({
      id: bundleSubscription.id, status: bundleSubscription.status,
      stripeSubscriptionId: bundleSubscription.stripeSubscriptionId,
      stripePriceId: bundleSubscription.stripePriceId,
      currentPeriodEnd: bundleSubscription.currentPeriodEnd,
      cancelAtPeriodEnd: bundleSubscription.cancelAtPeriodEnd,
      pendingTier: bundleSubscription.pendingTier,
      pendingBillingInterval: bundleSubscription.pendingBillingInterval,
      pendingChangeAt: bundleSubscription.pendingChangeAt,
    }).from(bundleSubscription)
      .where(eq(bundleSubscription.sellerProfileId, sellerProfileId)).limit(1),
  ]);

  const storeSub = storeResults[0] ?? null;
  const listerSub = listerResults[0] ?? null;
  const financeSub = financeResults[0] ?? null;
  const bundleSub = bundleResults[0] ?? null;

  return {
    storeTier: profile.storeTier,
    listerTier: profile.listerTier,
    financeTier: profile.financeTier,
    hasAutomation: profile.hasAutomation,
    // D3-S4: Pending downgrade info
    storePendingTier: storeSub?.pendingTier ?? null,
    storePendingChangeAt: storeSub?.pendingChangeAt ?? null,
    storePendingBillingInterval: (storeSub?.pendingBillingInterval as 'monthly' | 'annual' | null) ?? null,
    listerPendingTier: listerSub?.pendingTier ?? null,
    listerPendingChangeAt: listerSub?.pendingChangeAt ?? null,
    listerPendingBillingInterval: (listerSub?.pendingBillingInterval as 'monthly' | 'annual' | null) ?? null,
    financePendingTier: (financeSub?.pendingTier as 'FREE' | 'PRO' | null) ?? null,
    financePendingChangeAt: financeSub?.pendingChangeAt ?? null,
    financePendingBillingInterval: (financeSub?.pendingBillingInterval as 'monthly' | 'annual' | null) ?? null,
    // D3-S4: Billing intervals (derived from stripePriceId)
    storeBillingInterval: storeSub?.stripePriceId ? getBillingIntervalFromPriceId(storeSub.stripePriceId) : null,
    listerBillingInterval: listerSub?.stripePriceId ? getBillingIntervalFromPriceId(listerSub.stripePriceId) : null,
    financeBillingInterval: financeSub?.stripePriceId ? getBillingIntervalFromPriceId(financeSub.stripePriceId) : null,
    // Subscription sub-objects (original shape preserved)
    storeSubscription: storeSub,
    listerSubscription: listerSub,
    automationSubscription: autoResults[0] ?? null,
    financeSubscription: financeSub,
    bundleTier: profile.bundleTier,
    bundlePendingTier: bundleSub?.pendingTier ?? null,
    bundlePendingChangeAt: bundleSub?.pendingChangeAt ?? null,
    bundlePendingBillingInterval: (bundleSub?.pendingBillingInterval as 'monthly' | 'annual' | null) ?? null,
    bundleBillingInterval: bundleSub?.stripePriceId ? getBillingIntervalFromPriceId(bundleSub.stripePriceId) : null,
    bundleSubscription: bundleSub,
  };
}

/**
 * Get just the current tier values for a seller profile (lightweight query).
 * @internal — sellerProfileId must be derived from session via getSellerProfileIdByUserId.
 * NEVER accept from request body.
 */
export async function getProfileTiers(sellerProfileId: string): Promise<{
  storeTier: StoreTier;
  listerTier: ListerTier;
  financeTier: FinanceTier;
  hasAutomation: boolean;
} | null> {
  const [row] = await db
    .select({
      storeTier: sellerProfile.storeTier,
      listerTier: sellerProfile.listerTier,
      financeTier: sellerProfile.financeTier,
      hasAutomation: sellerProfile.hasAutomation,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);
  return row ?? null;
}

/**
 * Get Stripe subscription ID for a given subscription type.
 * @internal — sellerProfileId must be derived from session via getSellerProfileIdByUserId.
 * NEVER accept from request body.
 */
export async function getStripeSubscriptionId(
  sellerProfileId: string,
  subscriptionType: 'store' | 'lister' | 'automation' | 'finance'
): Promise<string | null> {
  let result: { stripeSubscriptionId: string | null }[] = [];

  switch (subscriptionType) {
    case 'store':
      result = await db
        .select({ stripeSubscriptionId: storeSubscription.stripeSubscriptionId })
        .from(storeSubscription)
        .where(eq(storeSubscription.sellerProfileId, sellerProfileId))
        .limit(1);
      break;
    case 'lister':
      result = await db
        .select({ stripeSubscriptionId: listerSubscription.stripeSubscriptionId })
        .from(listerSubscription)
        .where(eq(listerSubscription.sellerProfileId, sellerProfileId))
        .limit(1);
      break;
    case 'automation':
      result = await db
        .select({ stripeSubscriptionId: automationSubscription.stripeSubscriptionId })
        .from(automationSubscription)
        .where(eq(automationSubscription.sellerProfileId, sellerProfileId))
        .limit(1);
      break;
    case 'finance':
      result = await db
        .select({ stripeSubscriptionId: financeSubscription.stripeSubscriptionId })
        .from(financeSubscription)
        .where(eq(financeSubscription.sellerProfileId, sellerProfileId))
        .limit(1);
      break;
  }

  return result[0]?.stripeSubscriptionId ?? null;
}
