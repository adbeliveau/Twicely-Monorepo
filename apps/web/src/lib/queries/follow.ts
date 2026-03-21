import { db } from '@twicely/db';
import {
  follow,
  user,
  sellerProfile,
  sellerPerformance,
  listing,
  listingImage,
} from '@twicely/db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { mapToListingCard } from './shared';
import type { ListingCardData } from '@/types/listings';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FollowedSellerData {
  userId: string;
  storeName: string | null;
  storeSlug: string | null;
  avatarUrl: string | null;
  performanceBand: string;
  memberSince: Date;
  listingCount: number;
  followerCount: number;
  lastListedAt: Date | null;
  followedAt: Date;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Get all sellers the user follows, with profile info.
 * Ordered by follow.createdAt DESC (most recently followed first).
 */
export async function getFollowedSellers(userId: string): Promise<FollowedSellerData[]> {
  const rows = await db
    .select({
      userId: user.id,
      storeName: sellerProfile.storeName,
      storeSlug: sellerProfile.storeSlug,
      avatarUrl: user.avatarUrl,
      performanceBand: sellerProfile.performanceBand,
      memberSince: user.createdAt,
      followedAt: follow.createdAt,
      listingCount: sql<number>`
        (SELECT count(*)::int FROM listing
         WHERE listing.owner_user_id = ${user.id} AND listing.status = 'ACTIVE')
      `,
      followerCount: sql<number>`
        (SELECT count(*)::int FROM follow
         WHERE follow.followed_id = ${user.id})
      `,
      lastListedAt: sql<Date | null>`
        (SELECT max(listing.created_at) FROM listing
         WHERE listing.owner_user_id = ${user.id} AND listing.status = 'ACTIVE')
      `,
    })
    .from(follow)
    .innerJoin(user, eq(follow.followedId, user.id))
    .innerJoin(sellerProfile, eq(sellerProfile.userId, user.id))
    .where(eq(follow.followerId, userId))
    .orderBy(desc(follow.createdAt));

  return rows.map((row) => ({
    userId: row.userId,
    storeName: row.storeName,
    storeSlug: row.storeSlug,
    avatarUrl: row.avatarUrl,
    performanceBand: row.performanceBand,
    memberSince: row.memberSince,
    listingCount: row.listingCount,
    followerCount: row.followerCount,
    lastListedAt: row.lastListedAt,
    followedAt: row.followedAt,
  }));
}

/**
 * Get recent ACTIVE listings from all sellers the user follows.
 * Ordered by listing.createdAt DESC. Used in feed Section 1.
 */
export async function getFollowedSellerNewListings(
  userId: string,
  limit = 20,
): Promise<ListingCardData[]> {
  const rows = await db
    .select({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      priceCents: listing.priceCents,
      originalPriceCents: listing.originalPriceCents,
      condition: listing.condition,
      brand: listing.brand,
      freeShipping: listing.freeShipping,
      shippingCents: listing.shippingCents,
      primaryImageUrl: listingImage.url,
      primaryImageAlt: listingImage.altText,
      sellerName: user.displayName,
      sellerUsername: user.username,
      sellerAvatarUrl: user.avatarUrl,
      sellerAverageRating: sellerPerformance.averageRating,
      sellerTotalReviews: sellerPerformance.totalReviews,
      sellerShowStars: sellerPerformance.showStars,
    })
    .from(follow)
    .innerJoin(listing, and(
      eq(listing.ownerUserId, follow.followedId),
      eq(listing.status, 'ACTIVE'),
    ))
    .leftJoin(listingImage, and(
      eq(listingImage.listingId, listing.id),
      eq(listingImage.isPrimary, true),
    ))
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(sellerProfile.userId, listing.ownerUserId))
    .leftJoin(sellerPerformance, eq(sellerPerformance.sellerProfileId, sellerProfile.id))
    .where(eq(follow.followerId, userId))
    .orderBy(desc(listing.createdAt))
    .limit(limit);

  return rows.map(mapToListingCard);
}

/**
 * Count of sellers the user follows.
 */
export async function getFollowingCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(follow)
    .where(eq(follow.followerId, userId));
  return row?.count ?? 0;
}

/**
 * Count of followers for a user (how many people follow them).
 */
export async function getFollowerCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(follow)
    .where(eq(follow.followedId, userId));
  return row?.count ?? 0;
}
