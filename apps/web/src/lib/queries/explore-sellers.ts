import { db } from '@twicely/db';
import {
  listing,
  user,
  sellerProfile,
  order,
  follow,
} from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type { RisingSellerData } from './explore-shared';

// Rising seller qualification criteria — move to platform_settings if tuning needed
const RISING_SELLER_JOIN_DAYS = 90;
const RISING_SELLER_MIN_ACTIVE_LISTINGS = 3;
const RISING_SELLER_MIN_COMPLETED_ORDERS = 1;

/**
 * Rising Sellers: new sellers with early traction.
 * Criteria: joined < 90 days, 3+ active listings, 1+ completed orders.
 * Per Personalization Canonical §5.
 */
export async function getRisingSellers(limit?: number): Promise<RisingSellerData[]> {
  const risingLimit = await getPlatformSetting<number>('discovery.explore.risingSellerLimit', 8);
  const effectiveLimit = limit ?? risingLimit;

  const activeListingCountCte = db
    .$with('active_listing_counts')
    .as(
      db
        .select({
          ownerUserId: listing.ownerUserId,
          cnt: sql<number>`count(*)::int`.as('cnt'),
        })
        .from(listing)
        .where(eq(listing.status, 'ACTIVE'))
        .groupBy(listing.ownerUserId),
    );

  const completedOrderCountCte = db
    .$with('completed_order_counts')
    .as(
      db
        .select({
          sellerId: order.sellerId,
          cnt: sql<number>`count(*)::int`.as('cnt'),
        })
        .from(order)
        .where(eq(order.status, 'COMPLETED'))
        .groupBy(order.sellerId),
    );

  const followerCountCte = db
    .$with('follower_counts')
    .as(
      db
        .select({
          followedId: follow.followedId,
          cnt: sql<number>`count(*)::int`.as('cnt'),
        })
        .from(follow)
        .groupBy(follow.followedId),
    );

  const rows = await db
    .with(activeListingCountCte, completedOrderCountCte, followerCountCte)
    .select({
      userId: user.id,
      storeName: sellerProfile.storeName,
      storeSlug: sellerProfile.storeSlug,
      avatarUrl: user.avatarUrl,
      performanceBand: sellerProfile.performanceBand,
      listingCount: sql<number>`coalesce(active_listing_counts.cnt, 0)`.as('listing_count'),
      followerCount: sql<number>`coalesce(follower_counts.cnt, 0)`.as('follower_count'),
      memberSince: user.createdAt,
    })
    .from(user)
    .innerJoin(sellerProfile, eq(sellerProfile.userId, user.id))
    .leftJoin(sql`active_listing_counts`, sql`active_listing_counts.owner_user_id = ${user.id}`)
    .leftJoin(sql`completed_order_counts`, sql`completed_order_counts.seller_id = ${user.id}`)
    .leftJoin(sql`follower_counts`, sql`follower_counts.followed_id = ${user.id}`)
    .where(
      and(
        sql`${user.createdAt} > now() - (${RISING_SELLER_JOIN_DAYS} || ' days')::interval`,
        sql`coalesce(active_listing_counts.cnt, 0) >= ${RISING_SELLER_MIN_ACTIVE_LISTINGS}`,
        sql`coalesce(completed_order_counts.cnt, 0) >= ${RISING_SELLER_MIN_COMPLETED_ORDERS}`,
      ),
    )
    .orderBy(sql`listing_count DESC`)
    .limit(effectiveLimit);

  return rows.map((row) => ({
    userId: row.userId,
    storeName: row.storeName ?? null,
    storeSlug: row.storeSlug ?? null,
    avatarUrl: row.avatarUrl ?? null,
    performanceBand: row.performanceBand,
    listingCount: row.listingCount,
    followerCount: row.followerCount,
    memberSince: row.memberSince,
  }));
}
