/**
 * Publish metering service — checks a seller's publish allowance using the
 * credit ledger. Credits are consumed via rollover-manager (FIFO by expiresAt).
 * Source: Lister Canonical Section 7.1, 7.3; Pricing Canonical Section 6
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { sellerProfile, platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getAvailableCredits } from './rollover-manager';

export interface PublishAllowance {
  tier: string;
  monthlyLimit: number;
  usedThisMonth: number;
  remaining: number;
  rolloverBalance: number;
}

/** Map ListerTier to its crosslister.publishes.* platformSetting key. */
function publishLimitKey(tier: string): string | null {
  switch (tier) {
    case 'FREE': return 'crosslister.publishes.FREE';
    case 'LITE': return 'crosslister.publishes.LITE';
    case 'PRO':  return 'crosslister.publishes.PRO';
    default:     return null;
  }
}

async function getListerTier(sellerId: string): Promise<string> {
  const [row] = await db
    .select({ listerTier: sellerProfile.listerTier })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, sellerId))
    .limit(1);
  return row?.listerTier ?? 'NONE';
}

async function getMonthlyLimit(tier: string): Promise<number> {
  if (tier === 'NONE') return 0;
  const key = publishLimitKey(tier);
  if (!key) return 0;

  const [row] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, key))
    .limit(1);

  if (!row) {
    // Fallback defaults (Pricing Canonical Section 6)
    if (tier === 'FREE') return 25;
    if (tier === 'LITE') return 200;
    if (tier === 'PRO') return 2000;
    return 0;
  }
  const val = Number(row.value);
  return isFinite(val) && val >= 0 ? Math.floor(val) : 0;
}

/**
 * Get publish allowance state for a seller from the credit ledger.
 * rolloverBalance = credits from prior periods (non-current MONTHLY + OVERAGE + BONUS).
 */
export async function getPublishAllowance(sellerId: string): Promise<PublishAllowance> {
  const tier = await getListerTier(sellerId);
  if (tier === 'NONE') {
    return { tier, monthlyLimit: 0, usedThisMonth: 0, remaining: 0, rolloverBalance: 0 };
  }

  const [monthlyLimit, credits] = await Promise.all([
    getMonthlyLimit(tier),
    getAvailableCredits(sellerId),
  ]);

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // Current-period MONTHLY bucket: periodStart >= start of this calendar month
  let currentMonthTotal = 0;
  let currentMonthUsedEstimate = 0;
  let rolloverBalance = 0;

  for (const bucket of credits.breakdown) {
    if (bucket.creditType === 'MONTHLY' && bucket.periodStart >= startOfMonth) {
      // This is the current billing period's monthly allocation
      currentMonthTotal += bucket.remaining;
    } else {
      // Prior-period MONTHLY credits still valid (rollover) or OVERAGE/BONUS
      rolloverBalance += bucket.remaining;
    }
  }

  // usedThisMonth is estimated from the current month bucket's gap vs monthlyLimit
  // (actual consumption is in the ledger; this is an approximation for display)
  currentMonthUsedEstimate = Math.max(0, monthlyLimit - currentMonthTotal);

  const remaining = credits.total;

  return {
    tier,
    monthlyLimit,
    usedThisMonth: currentMonthUsedEstimate,
    remaining,
    rolloverBalance,
  };
}

/**
 * Check if seller can publish N listings (does NOT consume credits).
 */
export async function canPublish(sellerId: string, count: number): Promise<boolean> {
  const tier = await getListerTier(sellerId);
  if (tier === 'NONE') return false;
  const credits = await getAvailableCredits(sellerId);
  return credits.total >= count;
}

/**
 * No-op — usage is recorded by consumeCredits() in rollover-manager, called
 * by the publish queue worker (F4-S2). Creating a crossJob IS the work; credit
 * deduction happens at enqueue time.
 */
export async function recordPublishes(_sellerId: string, _count: number): Promise<void> {
  // intentional no-op
}
