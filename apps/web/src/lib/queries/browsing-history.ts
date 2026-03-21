import { db } from '@twicely/db';
import { browsingHistory, listing, listingImage, user } from '@twicely/db/schema';
import { eq, and, desc, ne } from 'drizzle-orm';

export interface BrowsingHistoryItem {
  listingId: string;
  title: string;
  slug: string;
  priceCents: number;
  condition: string;
  imageUrl: string | null;
  sellerName: string | null;
  viewCount: number;
  lastViewedAt: Date;
  didAddToCart: boolean;
  didAddToWatchlist: boolean;
  didMakeOffer: boolean;
  didPurchase: boolean;
}

export type HistorySortBy = 'recent' | 'most_viewed';

interface GetHistoryOptions {
  limit?: number;
  offset?: number;
  sortBy?: HistorySortBy;
}

/**
 * Get a user's browsing history with engagement data.
 * Returns listings they've viewed, excludes deleted/removed listings.
 */
export async function getBrowsingHistory(
  userId: string,
  options: GetHistoryOptions = {}
): Promise<BrowsingHistoryItem[]> {
  const { limit = 50, offset = 0, sortBy = 'recent' } = options;

  const orderByColumn = sortBy === 'most_viewed'
    ? desc(browsingHistory.viewCount)
    : desc(browsingHistory.lastViewedAt);

  const rows = await db
    .select({
      listingId: browsingHistory.listingId,
      title: listing.title,
      slug: listing.slug,
      priceCents: listing.priceCents,
      condition: listing.condition,
      imageUrl: listingImage.url,
      sellerName: user.name,
      viewCount: browsingHistory.viewCount,
      lastViewedAt: browsingHistory.lastViewedAt,
      didAddToCart: browsingHistory.didAddToCart,
      didAddToWatchlist: browsingHistory.didAddToWatchlist,
      didMakeOffer: browsingHistory.didMakeOffer,
      didPurchase: browsingHistory.didPurchase,
    })
    .from(browsingHistory)
    .innerJoin(listing, eq(browsingHistory.listingId, listing.id))
    .innerJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(
      listingImage,
      and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true))
    )
    .where(
      and(
        eq(browsingHistory.userId, userId),
        ne(listing.status, 'REMOVED')
      )
    )
    .orderBy(orderByColumn)
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    listingId: row.listingId,
    title: row.title ?? 'Untitled',
    slug: row.slug ?? row.listingId,
    priceCents: row.priceCents ?? 0,
    condition: row.condition ?? 'GOOD',
    imageUrl: row.imageUrl,
    sellerName: row.sellerName,
    viewCount: row.viewCount,
    lastViewedAt: row.lastViewedAt,
    didAddToCart: row.didAddToCart,
    didAddToWatchlist: row.didAddToWatchlist,
    didMakeOffer: row.didMakeOffer,
    didPurchase: row.didPurchase,
  }));
}

/**
 * Get recently viewed items for carousel display.
 * Returns last 10 items, excluding a specific listing if provided.
 */
export async function getRecentlyViewed(
  userId: string,
  excludeListingId?: string
): Promise<BrowsingHistoryItem[]> {
  const items = await getBrowsingHistory(userId, {
    limit: excludeListingId ? 11 : 10,
    sortBy: 'recent',
  });

  if (excludeListingId) {
    return items.filter((item) => item.listingId !== excludeListingId).slice(0, 10);
  }

  return items;
}
