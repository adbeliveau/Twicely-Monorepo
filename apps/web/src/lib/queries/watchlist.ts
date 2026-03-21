import { db } from '@twicely/db';
import { watchlistItem, listing, listingImage } from '@twicely/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';

export interface WatchlistItemSummary {
  listingId: string;
  title: string;
  slug: string;
  priceCents: number;
  condition: string;
  imageUrl: string | null;
  watchedAt: Date;
}

/**
 * Get all listings a user is watching.
 */
export async function getWatchlistItems(userId: string): Promise<WatchlistItemSummary[]> {
  const rows = await db
    .select({
      listingId: watchlistItem.listingId,
      title: listing.title,
      slug: listing.slug,
      priceCents: listing.priceCents,
      condition: listing.condition,
      imageUrl: listingImage.url,
      watchedAt: watchlistItem.createdAt,
    })
    .from(watchlistItem)
    .innerJoin(listing, eq(watchlistItem.listingId, listing.id))
    .leftJoin(
      listingImage,
      and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true))
    )
    .where(eq(watchlistItem.userId, userId))
    .orderBy(desc(watchlistItem.createdAt));

  return rows.map((row) => ({
    listingId: row.listingId,
    title: row.title ?? 'Untitled',
    slug: row.slug ?? row.listingId,
    priceCents: row.priceCents ?? 0,
    condition: row.condition ?? 'GOOD',
    imageUrl: row.imageUrl,
    watchedAt: row.watchedAt,
  }));
}

/**
 * Check if a user is watching a specific listing.
 */
export async function isWatching(userId: string, listingId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: watchlistItem.id })
    .from(watchlistItem)
    .where(and(eq(watchlistItem.userId, userId), eq(watchlistItem.listingId, listingId)))
    .limit(1);

  return !!row;
}

/**
 * Get the number of users watching a listing.
 */
export async function getWatcherCount(listingId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(watchlistItem)
    .where(eq(watchlistItem.listingId, listingId));

  return result?.count ?? 0;
}

export interface WatchStatus {
  isWatching: boolean;
  notifyPriceDrop: boolean;
}

/**
 * Get watching status and price drop notification preference for a listing.
 */
export async function getWatchStatus(userId: string, listingId: string): Promise<WatchStatus> {
  const [row] = await db
    .select({ notifyPriceDrop: watchlistItem.notifyPriceDrop })
    .from(watchlistItem)
    .where(and(eq(watchlistItem.userId, userId), eq(watchlistItem.listingId, listingId)))
    .limit(1);

  return {
    isWatching: !!row,
    notifyPriceDrop: row?.notifyPriceDrop ?? false,
  };
}
