import { db } from '@twicely/db';
import { priceHistory, listing } from '@twicely/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { PriceStats } from './types';

/**
 * Record a price change for a listing.
 * Only records if the change exceeds the minimum threshold in basis points.
 */
export async function recordPriceChange(
  listingId: string,
  priceCents: number
): Promise<void> {
  const minChangeBps = await getPlatformSetting<number>('buyer.priceHistory.minChangeBps', 100);

  // Get current price from listing
  const [current] = await db
    .select({ priceCents: listing.priceCents })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  const previousCents = current?.priceCents ?? null;

  // Determine change type and basis points
  let changeType: string;
  let changeBps: number | null = null;

  if (previousCents === null || previousCents === 0) {
    changeType = 'INITIAL';
  } else {
    changeBps = Math.round(((priceCents - previousCents) / previousCents) * 10000);
    if (Math.abs(changeBps) < minChangeBps) {
      return; // Below threshold, skip recording
    }
    changeType = changeBps > 0 ? 'INCREASE' : 'DECREASE';
  }

  await db.insert(priceHistory).values({
    id: createId(),
    listingId,
    priceCents,
    previousCents,
    changeType,
    changeBps,
    source: 'listing_update',
    snapshotDate: new Date(),
    recordedAt: new Date(),
  });
}

/**
 * Get price history for a listing within a given number of days.
 */
export async function getPriceHistory(
  listingId: string,
  days: number = 90
): Promise<Array<{ id: string; priceCents: number; recordedAt: Date }>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      id: priceHistory.id,
      priceCents: priceHistory.priceCents,
      recordedAt: priceHistory.recordedAt,
    })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.listingId, listingId),
        gte(priceHistory.recordedAt, since)
      )
    )
    .orderBy(desc(priceHistory.recordedAt));

  return rows;
}

/**
 * Get aggregated price statistics for a listing.
 * Returns min, max, avg, current price, and 30-day percent change.
 */
export async function getPriceStats(listingId: string): Promise<PriceStats | null> {
  // Get current listing price
  const [currentListing] = await db
    .select({ priceCents: listing.priceCents })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!currentListing || currentListing.priceCents === null) {
    return null;
  }

  const currentCents = currentListing.priceCents;

  // Aggregate from price history
  const [stats] = await db
    .select({
      minCents: sql<number>`COALESCE(MIN(${priceHistory.priceCents}), ${currentCents})`,
      maxCents: sql<number>`COALESCE(MAX(${priceHistory.priceCents}), ${currentCents})`,
      avgCents: sql<number>`COALESCE(AVG(${priceHistory.priceCents})::integer, ${currentCents})`,
    })
    .from(priceHistory)
    .where(eq(priceHistory.listingId, listingId));

  // Get price from 30 days ago for percent change calculation
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [oldestInWindow] = await db
    .select({ priceCents: priceHistory.priceCents })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.listingId, listingId),
        gte(priceHistory.recordedAt, thirtyDaysAgo)
      )
    )
    .orderBy(priceHistory.recordedAt)
    .limit(1);

  let percentChange30d: number | null = null;
  if (oldestInWindow && oldestInWindow.priceCents > 0) {
    percentChange30d = Math.round(
      ((currentCents - oldestInWindow.priceCents) / oldestInWindow.priceCents) * 10000
    ) / 100;
  }

  return {
    minCents: stats?.minCents ?? currentCents,
    maxCents: stats?.maxCents ?? currentCents,
    avgCents: stats?.avgCents ?? currentCents,
    currentCents,
    percentChange30d,
  };
}
