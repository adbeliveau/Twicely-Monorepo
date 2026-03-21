import { db } from '@twicely/db';
import {
  listing,
  listingImage,
  user,
  sellerProfile,
  sellerPerformance,
  watchlistItem,
  browsingHistory,
  orderItem,
  order,
  promotedListing,
} from '@twicely/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { mapToListingCard } from './shared';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { listingCardFields } from './explore-shared';
import type { ListingCardData } from '@/types/listings';

// V1 trending weights — move to platform_settings in Phase H if tuning is needed
const TRENDING_WEIGHT_SALE = 10;
const TRENDING_WEIGHT_WATCHLIST = 3;
const TRENDING_WEIGHT_VIEW = 1;

/**
 * Trending Now: highest velocity listings across all categories.
 * Velocity = (orders * 10) + (watchlist adds * 3) + (browsing views * 1)
 * within the configured window. Per Personalization Canonical §5.
 */
export async function getTrendingListings(limit?: number): Promise<ListingCardData[]> {
  const [windowDays, trendingLimit] = await Promise.all([
    getPlatformSetting<number>('discovery.explore.trendingWindowDays', 7),
    getPlatformSetting<number>('discovery.explore.trendingLimit', 24),
  ]);
  const effectiveLimit = limit ?? trendingLimit;

  const orderCountCte = db
    .$with('order_counts')
    .as(
      db
        .select({
          listingId: orderItem.listingId,
          cnt: sql<number>`count(*)::int`.as('cnt'),
        })
        .from(orderItem)
        .innerJoin(order, eq(orderItem.orderId, order.id))
        .where(sql`${order.createdAt} > now() - (${windowDays} || ' days')::interval`)
        .groupBy(orderItem.listingId),
    );

  const watchlistCountCte = db
    .$with('watchlist_counts')
    .as(
      db
        .select({
          listingId: watchlistItem.listingId,
          cnt: sql<number>`count(*)::int`.as('cnt'),
        })
        .from(watchlistItem)
        .where(sql`${watchlistItem.createdAt} > now() - (${windowDays} || ' days')::interval`)
        .groupBy(watchlistItem.listingId),
    );

  const viewCountCte = db
    .$with('view_counts')
    .as(
      db
        .select({
          listingId: browsingHistory.listingId,
          cnt: sql<number>`count(*)::int`.as('cnt'),
        })
        .from(browsingHistory)
        .where(sql`${browsingHistory.lastViewedAt} > now() - (${windowDays} || ' days')::interval`)
        .groupBy(browsingHistory.listingId),
    );

  const rows = await db
    .with(orderCountCte, watchlistCountCte, viewCountCte)
    .select({
      ...listingCardFields,
      velocityScore: sql<number>`
        (coalesce(order_counts.cnt, 0) * ${TRENDING_WEIGHT_SALE})
        + (coalesce(watchlist_counts.cnt, 0) * ${TRENDING_WEIGHT_WATCHLIST})
        + (coalesce(view_counts.cnt, 0) * ${TRENDING_WEIGHT_VIEW})
      `.as('velocity_score'),
    })
    .from(listing)
    .leftJoin(sql`order_counts`, sql`order_counts.listing_id = ${listing.id}`)
    .leftJoin(sql`watchlist_counts`, sql`watchlist_counts.listing_id = ${listing.id}`)
    .leftJoin(sql`view_counts`, sql`view_counts.listing_id = ${listing.id}`)
    .leftJoin(listingImage, and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true)))
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(sellerProfile.userId, listing.ownerUserId))
    .leftJoin(sellerPerformance, eq(sellerPerformance.sellerProfileId, sellerProfile.id))
    .where(eq(listing.status, 'ACTIVE'))
    .orderBy(sql`velocity_score DESC`, desc(listing.createdAt))
    .limit(effectiveLimit);

  return rows.map((row) => mapToListingCard(row));
}

/**
 * Promoted listings on Explore: ALL active boosts, not interest-filtered.
 * Per Personalization Canonical §10.
 */
export async function getExplorePromotedListings(limit = 12): Promise<ListingCardData[]> {
  const rows = await db
    .select({ ...listingCardFields })
    .from(promotedListing)
    .innerJoin(listing, eq(promotedListing.listingId, listing.id))
    .leftJoin(listingImage, and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true)))
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(sellerProfile.userId, listing.ownerUserId))
    .leftJoin(sellerPerformance, eq(sellerPerformance.sellerProfileId, sellerProfile.id))
    .where(
      and(
        eq(promotedListing.isActive, true),
        sql`(${promotedListing.endedAt} IS NULL OR ${promotedListing.endedAt} > now())`,
        eq(listing.status, 'ACTIVE'),
      ),
    )
    .orderBy(desc(promotedListing.startedAt))
    .limit(limit);

  return rows.map((row) => mapToListingCard(row));
}
