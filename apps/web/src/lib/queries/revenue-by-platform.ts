/**
 * Cross-platform revenue aggregation query.
 * Source: F5-S2 install prompt §1.4; Financial Center Canonical §2 (auto-populated data).
 *
 * Groups ledger entries by channel to produce per-platform P&L.
 *   TWICELY:  ORDER_PAYMENT_CAPTURED (revenue) + ORDER_TF_FEE + ORDER_STRIPE_PROCESSING_FEE (fees)
 *   External: CROSSLISTER_SALE_REVENUE (revenue) + CROSSLISTER_PLATFORM_FEE (fees)
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { ledgerEntry } from '@twicely/db/schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';

export interface PlatformRevenue {
  /** Channel name: 'TWICELY' | 'EBAY' | 'POSHMARK' | 'MERCARI' | etc. */
  channel: string;
  /** Gross sales in cents */
  revenueCents: number;
  /** Platform fees in cents (absolute value) */
  feesCents: number;
  /** revenue - fees */
  netCents: number;
  /** Number of sale events */
  orderCount: number;
}

// Entry types that represent off-platform revenue
const OFF_PLATFORM_TYPES = [
  'CROSSLISTER_SALE_REVENUE',
  'CROSSLISTER_PLATFORM_FEE',
] as const;

// Entry types that represent Twicely-native revenue and fees
const TWICELY_TYPES = [
  'ORDER_PAYMENT_CAPTURED',
  'ORDER_TF_FEE',
  'ORDER_STRIPE_PROCESSING_FEE',
] as const;

const ALL_TRACKED_TYPES = [...OFF_PLATFORM_TYPES, ...TWICELY_TYPES] as const;

/**
 * Get per-platform revenue, fees, and net earnings for a user in a date range.
 * Returns one row per channel that had activity.
 */
export async function getRevenueByPlatform(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<PlatformRevenue[]> {
  const rows = await db
    .select({
      channel: ledgerEntry.channel,
      type: ledgerEntry.type,
      total: sql<number>`coalesce(sum(${ledgerEntry.amountCents}), 0)::int`,
      cnt: sql<number>`count(*)::int`,
    })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, userId),
        gte(ledgerEntry.createdAt, startDate),
        lte(ledgerEntry.createdAt, endDate),
        inArray(ledgerEntry.type, [...ALL_TRACKED_TYPES]),
      ),
    )
    .groupBy(ledgerEntry.channel, ledgerEntry.type);

  // Aggregate by channel
  const channelMap = new Map<
    string,
    { revenueCents: number; feesCents: number; orderCount: number }
  >();

  for (const row of rows) {
    const ch = row.channel ?? 'TWICELY';
    if (!channelMap.has(ch)) {
      channelMap.set(ch, { revenueCents: 0, feesCents: 0, orderCount: 0 });
    }
    const entry = channelMap.get(ch)!;

    if (row.type === 'ORDER_PAYMENT_CAPTURED' || row.type === 'CROSSLISTER_SALE_REVENUE') {
      entry.revenueCents += row.total;
      entry.orderCount += row.cnt;
    } else if (
      row.type === 'ORDER_TF_FEE' ||
      row.type === 'ORDER_STRIPE_PROCESSING_FEE' ||
      row.type === 'CROSSLISTER_PLATFORM_FEE'
    ) {
      // Fees are stored as negative amountCents — use absolute value
      entry.feesCents += Math.abs(row.total);
    }
  }

  if (channelMap.size === 0) {
    return [];
  }

  const result: PlatformRevenue[] = [];
  for (const [channel, data] of channelMap.entries()) {
    result.push({
      channel,
      revenueCents: data.revenueCents,
      feesCents: data.feesCents,
      netCents: data.revenueCents - data.feesCents,
      orderCount: data.orderCount,
    });
  }

  // Sort by revenue descending
  result.sort((a, b) => b.revenueCents - a.revenueCents);

  return result;
}
