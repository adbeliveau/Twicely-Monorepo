/**
 * Rollover manager — manages publish credit ledger for Crosslister publish allowances.
 * Credits are consumed FIFO (soonest-to-expire first).
 * Source: Pricing Canonical §6.2, §6.4; Lister Canonical §7.3
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { publishCreditLedger, platformSetting } from '@twicely/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreditBucket {
  id: string;
  creditType: 'MONTHLY' | 'OVERAGE' | 'BONUS';
  remaining: number;
  expiresAt: Date;
  periodStart: Date;
  periodEnd: Date;
}

export interface AvailableCredits {
  total: number;
  breakdown: CreditBucket[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getNumericSetting(key: string, fallback: number): Promise<number> {
  const [row] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, key))
    .limit(1);
  if (!row) return fallback;
  const val = Number(row.value);
  return isFinite(val) && val >= 0 ? Math.floor(val) : fallback;
}

function publishLimitSettingKey(tier: string): string {
  return `crosslister.publishes.${tier}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add monthly credits when a billing period renews.
 * FREE tier credits expire at periodEnd (no rollover).
 * LITE/PRO tier credits expire at NOW() + rolloverDays, capped at maxStockpile.
 */
export async function addMonthlyCredits(
  userId: string,
  tier: string,
  periodStart: Date,
  periodEnd: Date,
  listerSubscriptionId: string,
): Promise<void> {
  const limitKey = publishLimitSettingKey(tier);
  const [monthlyLimit, rolloverDays, rolloverMaxMultiplier] = await Promise.all([
    getNumericSetting(limitKey, tier === 'FREE' ? 25 : tier === 'LITE' ? 200 : 2000),
    getNumericSetting('crosslister.rolloverDays', 60),
    getNumericSetting('crosslister.rolloverMaxMultiplier', 3),
  ]);

  if (monthlyLimit === 0) return;

  const maxStockpile = monthlyLimit * rolloverMaxMultiplier;

  // Get current available total
  const current = await getAvailableCredits(userId);
  const currentTotal = current.total;

  // Cap new credits so total does not exceed maxStockpile
  const creditsToAdd = Math.max(0, Math.min(monthlyLimit, maxStockpile - currentTotal));
  if (creditsToAdd === 0) return;

  // FREE tier: expires at periodEnd (no rollover)
  // LITE/PRO tier: expires at NOW() + rolloverDays
  let expiresAt: Date;
  if (tier === 'FREE') {
    expiresAt = periodEnd;
  } else {
    const now = new Date();
    expiresAt = new Date(now.getTime() + rolloverDays * 24 * 60 * 60 * 1000);
  }

  await db.insert(publishCreditLedger).values({
    userId,
    creditType: 'MONTHLY',
    totalCredits: creditsToAdd,
    usedCredits: 0,
    expiresAt,
    periodStart,
    periodEnd,
    listerSubscriptionId,
  });
}

/**
 * Add overage pack credits. These expire at the current period end.
 * No stockpile cap on overage credits.
 */
export async function addOverageCredits(
  userId: string,
  quantity: number,
  periodEnd: Date,
): Promise<void> {
  const now = new Date();
  await db.insert(publishCreditLedger).values({
    userId,
    creditType: 'OVERAGE',
    totalCredits: quantity,
    usedCredits: 0,
    expiresAt: periodEnd,
    periodStart: now,
    periodEnd,
    listerSubscriptionId: null,
  });
}

/**
 * Get total available credits, excluding expired and fully-consumed rows.
 * Ordered soonest-to-expire first (FIFO consumption order).
 */
export async function getAvailableCredits(userId: string): Promise<AvailableCredits> {
  const now = new Date();
  const rows = await db
    .select({
      id: publishCreditLedger.id,
      creditType: publishCreditLedger.creditType,
      totalCredits: publishCreditLedger.totalCredits,
      usedCredits: publishCreditLedger.usedCredits,
      expiresAt: publishCreditLedger.expiresAt,
      periodStart: publishCreditLedger.periodStart,
      periodEnd: publishCreditLedger.periodEnd,
    })
    .from(publishCreditLedger)
    .where(
      and(
        eq(publishCreditLedger.userId, userId),
        gt(publishCreditLedger.expiresAt, now),
        sql`${publishCreditLedger.usedCredits} < ${publishCreditLedger.totalCredits}`,
      ),
    )
    .orderBy(publishCreditLedger.expiresAt);

  let total = 0;
  const breakdown: CreditBucket[] = [];

  for (const row of rows) {
    const remaining = row.totalCredits - row.usedCredits;
    total += remaining;
    breakdown.push({
      id: row.id,
      creditType: row.creditType,
      remaining,
      expiresAt: row.expiresAt,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
    });
  }

  return { total, breakdown };
}

/**
 * Consume N credits in soonest-to-expire order (FIFO).
 * Uses SELECT FOR UPDATE inside a transaction for concurrency safety.
 * Returns false if insufficient credits — no partial consumption.
 */
export async function consumeCredits(userId: string, count: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date();

    // Lock rows FOR UPDATE to prevent concurrent double-spend
    const rows = await tx
      .select({
        id: publishCreditLedger.id,
        totalCredits: publishCreditLedger.totalCredits,
        usedCredits: publishCreditLedger.usedCredits,
      })
      .from(publishCreditLedger)
      .where(
        and(
          eq(publishCreditLedger.userId, userId),
          gt(publishCreditLedger.expiresAt, now),
          sql`${publishCreditLedger.usedCredits} < ${publishCreditLedger.totalCredits}`,
        ),
      )
      .orderBy(publishCreditLedger.expiresAt)
      .for('update');

    const available = rows.reduce((sum, r) => sum + (r.totalCredits - r.usedCredits), 0);
    if (available < count) return false;

    let remaining = count;
    for (const row of rows) {
      if (remaining <= 0) break;
      const canTake = row.totalCredits - row.usedCredits;
      const toTake = Math.min(canTake, remaining);
      await tx
        .update(publishCreditLedger)
        .set({ usedCredits: row.usedCredits + toTake })
        .where(eq(publishCreditLedger.id, row.id));
      remaining -= toTake;
    }

    return true;
  });
}

/**
 * Forfeit excess credits on downgrade, keeping up to newMaxStockpile.
 * Forfeits newest credits first (keep newest, discard oldest) by ordering DESC.
 * Returns the count of forfeited credits.
 */
export async function forfeitExcessRollover(
  userId: string,
  newMaxStockpile: number,
): Promise<number> {
  const now = new Date();
  const rows = await db
    .select({
      id: publishCreditLedger.id,
      totalCredits: publishCreditLedger.totalCredits,
      usedCredits: publishCreditLedger.usedCredits,
    })
    .from(publishCreditLedger)
    .where(
      and(
        eq(publishCreditLedger.userId, userId),
        gt(publishCreditLedger.expiresAt, now),
        sql`${publishCreditLedger.usedCredits} < ${publishCreditLedger.totalCredits}`,
      ),
    )
    .orderBy(sql`${publishCreditLedger.expiresAt} DESC`);

  const total = rows.reduce((sum, r) => sum + (r.totalCredits - r.usedCredits), 0);
  if (total <= newMaxStockpile) return 0;

  let toKeep = newMaxStockpile;
  let forfeited = 0;

  for (const row of rows) {
    const remaining = row.totalCredits - row.usedCredits;
    if (toKeep >= remaining) {
      toKeep -= remaining;
      continue;
    }
    // Partially or fully forfeit this row
    const keepFromRow = toKeep;
    const forfeitFromRow = remaining - keepFromRow;
    toKeep = 0;
    await db
      .update(publishCreditLedger)
      .set({ usedCredits: row.totalCredits - keepFromRow })
      .where(eq(publishCreditLedger.id, row.id));
    forfeited += forfeitFromRow;
  }

  return forfeited;
}

/**
 * Forfeit all non-expired credits for a user (on cancel/downgrade to FREE/NONE).
 * Sets usedCredits = totalCredits on all active rows.
 * Returns the total count of forfeited credits.
 */
export async function forfeitAllCredits(userId: string): Promise<number> {
  const now = new Date();
  const rows = await db
    .select({
      id: publishCreditLedger.id,
      totalCredits: publishCreditLedger.totalCredits,
      usedCredits: publishCreditLedger.usedCredits,
    })
    .from(publishCreditLedger)
    .where(
      and(
        eq(publishCreditLedger.userId, userId),
        gt(publishCreditLedger.expiresAt, now),
        sql`${publishCreditLedger.usedCredits} < ${publishCreditLedger.totalCredits}`,
      ),
    );

  if (rows.length === 0) return 0;

  let forfeited = 0;
  for (const row of rows) {
    const remaining = row.totalCredits - row.usedCredits;
    await db
      .update(publishCreditLedger)
      .set({ usedCredits: row.totalCredits })
      .where(eq(publishCreditLedger.id, row.id));
    forfeited += remaining;
  }

  return forfeited;
}
