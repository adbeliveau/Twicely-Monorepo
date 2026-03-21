/**
 * F4-S4: Lister Subscription Snapshot Query
 *
 * Assembles publish allowance + lister subscription state for the
 * lister subscription card on /my/selling/subscription.
 */

import { db } from '@twicely/db';
import { sellerProfile } from '@/lib/db/schema/identity';
import { listerSubscription } from '@/lib/db/schema/subscriptions';
import { crosslisterAccount } from '@/lib/db/schema/crosslister';
import { eq, and } from 'drizzle-orm';
import { getPublishAllowance } from '@twicely/crosslister/services/publish-meter';
import type { ListerTier } from '@/types/enums';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListerSubscriptionSnapshot {
  listerTier: ListerTier;
  publishAllowance: {
    tier: ListerTier;
    monthlyLimit: number;
    usedThisMonth: number;
    remaining: number;
    rolloverBalance: number;
  };
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    pendingTier: ListerTier | null;
  } | null;
  connectedPlatformCount: number;
}

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * Get lister subscription snapshot for a user.
 * @internal — userId must come from session, NEVER from request body.
 */
export async function getListerSubscriptionSnapshot(
  userId: string
): Promise<ListerSubscriptionSnapshot> {
  // 1. Get seller profile — listerTier and sellerProfileId
  const [profile] = await db
    .select({
      id: sellerProfile.id,
      listerTier: sellerProfile.listerTier,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  const listerTier: ListerTier = (profile?.listerTier as ListerTier) ?? 'NONE';
  const sellerProfileId = profile?.id ?? null;

  // 2. Get publish allowance from credit ledger
  const rawAllowance = await getPublishAllowance(userId);
  const publishAllowance = {
    tier: rawAllowance.tier as ListerTier,
    monthlyLimit: rawAllowance.monthlyLimit,
    usedThisMonth: rawAllowance.usedThisMonth,
    remaining: rawAllowance.remaining,
    rolloverBalance: rawAllowance.rolloverBalance,
  };

  // 3. Get lister subscription row (may be null for FREE/NONE tiers with no Stripe sub)
  let subscription: ListerSubscriptionSnapshot['subscription'] = null;
  if (sellerProfileId) {
    const [sub] = await db
      .select({
        id: listerSubscription.id,
        status: listerSubscription.status,
        currentPeriodEnd: listerSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: listerSubscription.cancelAtPeriodEnd,
        pendingTier: listerSubscription.pendingTier,
      })
      .from(listerSubscription)
      .where(eq(listerSubscription.sellerProfileId, sellerProfileId))
      .limit(1);

    if (sub) {
      subscription = {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        pendingTier: (sub.pendingTier as ListerTier | null) ?? null,
      };
    }
  }

  // 4. Count active crosslister accounts for this user
  const accountRows = await db
    .select({ id: crosslisterAccount.id })
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.sellerId, userId),
        eq(crosslisterAccount.status, 'ACTIVE')
      )
    );
  const connectedPlatformCount = accountRows.length;

  return {
    listerTier,
    publishAllowance,
    subscription,
    connectedPlatformCount,
  };
}
