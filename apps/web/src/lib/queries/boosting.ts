/**
 * D2.4: Boosting / Promoted Listings Queries
 */

import { db } from '@twicely/db';
import { promotedListing } from '@twicely/db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PromotedListingRow {
  id: string;
  listingId: string;
  sellerId: string;
  boostPercent: number;
  isActive: boolean;
  impressions: number;
  clicks: number;
  sales: number;
  totalFeeCents: number;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Get the active promoted listing record for a listing.
 */
export async function getPromotedListingByListingId(
  listingId: string
): Promise<PromotedListingRow | null> {
  const [row] = await db
    .select()
    .from(promotedListing)
    .where(and(eq(promotedListing.listingId, listingId), eq(promotedListing.isActive, true)))
    .limit(1);

  return row ?? null;
}

/**
 * Get all promoted listings for a seller (active and ended).
 */
export async function getSellerPromotedListings(
  sellerId: string
): Promise<PromotedListingRow[]> {
  const rows = await db
    .select()
    .from(promotedListing)
    .where(eq(promotedListing.sellerId, sellerId))
    .orderBy(desc(promotedListing.createdAt))
    .limit(200);

  return rows;
}

/**
 * Count active boosts for a seller.
 */
export async function countActiveBoosts(sellerId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promotedListing)
    .where(and(eq(promotedListing.sellerId, sellerId), eq(promotedListing.isActive, true)));

  return result?.count ?? 0;
}

/**
 * Get boost info for a list of listing IDs.
 * Returns a Map of listingId → boostPercent for all boosted listings.
 * Used by search to determine which results are boosted.
 */
export async function getActiveBoostedListingIds(
  listingIds: string[]
): Promise<Map<string, number>> {
  if (listingIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      listingId: promotedListing.listingId,
      boostPercent: promotedListing.boostPercent,
    })
    .from(promotedListing)
    .where(and(inArray(promotedListing.listingId, listingIds), eq(promotedListing.isActive, true)));

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.listingId, row.boostPercent);
  }

  return map;
}
