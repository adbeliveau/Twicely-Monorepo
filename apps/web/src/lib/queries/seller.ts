import { db } from '@twicely/db';
import { sellerProfile, sellerPerformance, listing, listingImage, user, follow } from '@twicely/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { mapToListingCard } from './shared';

/**
 * Get seller profile for a user.
 * Returns null if user is not a seller.
 */
export async function getSellerProfile(userId: string) {
  const rows = await db
    .select()
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export interface StorefrontData {
  seller: {
    id: string;
    userId: string;
    storeName: string | null;
    storeSlug: string | null;
    storeDescription: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    performanceBand: string;
    memberSince: Date;
    vacationMode: boolean;
    vacationMessage: string | null;
  };
  stats: {
    listingCount: number;
    followerCount: number;
    averageRating: number | null;
    totalReviews: number;
  };
  listings: ReturnType<typeof mapToListingCard>[];
}

/**
 * Get storefront data by store slug.
 * Returns seller info, stats, and active listings.
 * @deprecated TODO: remove after D1b — superseded by storefront.ts
 */
export async function getStorefrontBySlug(storeSlug: string): Promise<StorefrontData | null> {
  // Get seller profile with user info
  const [sellerRow] = await db
    .select({
      id: sellerProfile.id,
      userId: sellerProfile.userId,
      storeName: sellerProfile.storeName,
      storeSlug: sellerProfile.storeSlug,
      storeDescription: sellerProfile.storeDescription,
      performanceBand: sellerProfile.performanceBand,
      vacationMode: sellerProfile.vacationMode,
      vacationMessage: sellerProfile.vacationMessage,
      avatarUrl: user.avatarUrl,
      memberSince: user.createdAt,
    })
    .from(sellerProfile)
    .innerJoin(user, eq(sellerProfile.userId, user.id))
    .where(eq(sellerProfile.storeSlug, storeSlug))
    .limit(1);

  if (!sellerRow) return null;

  // Get performance stats
  const [perfRow] = await db
    .select({
      averageRating: sellerPerformance.averageRating,
      totalReviews: sellerPerformance.totalReviews,
    })
    .from(sellerPerformance)
    .where(eq(sellerPerformance.sellerProfileId, sellerRow.id))
    .limit(1);

  // Get listing count
  const [listingCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listing)
    .where(and(eq(listing.ownerUserId, sellerRow.userId), eq(listing.status, 'ACTIVE')));

  // Get follower count
  const [followerCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follow)
    .where(eq(follow.followedId, sellerRow.userId));

  // Get active listings (24 most recent)
  const listingRows = await db
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
      sellerName: user.name,
      sellerUsername: user.username,
      sellerAvatarUrl: user.avatarUrl,
      sellerAverageRating: sql<number | null>`${perfRow?.averageRating ?? null}`,
      sellerTotalReviews: sql<number>`${perfRow?.totalReviews ?? 0}`,
      sellerShowStars: sql<boolean>`true`,
    })
    .from(listing)
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(
      listingImage,
      and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true))
    )
    .where(and(eq(listing.ownerUserId, sellerRow.userId), eq(listing.status, 'ACTIVE')))
    .orderBy(desc(listing.createdAt))
    .limit(24);

  return {
    seller: {
      id: sellerRow.id,
      userId: sellerRow.userId,
      storeName: sellerRow.storeName,
      storeSlug: sellerRow.storeSlug,
      storeDescription: sellerRow.storeDescription,
      avatarUrl: sellerRow.avatarUrl,
      bannerUrl: null, // User table doesn't have bannerUrl yet
      performanceBand: sellerRow.performanceBand,
      memberSince: sellerRow.memberSince,
      vacationMode: sellerRow.vacationMode,
      vacationMessage: sellerRow.vacationMessage,
    },
    stats: {
      listingCount: listingCountRow?.count ?? 0,
      followerCount: followerCountRow?.count ?? 0,
      averageRating: perfRow?.averageRating ?? null,
      totalReviews: perfRow?.totalReviews ?? 0,
    },
    listings: listingRows.map(mapToListingCard),
  };
}

/**
 * Get seller statistics for the selling overview page.
 */
export async function getSellerStats(userId: string) {
  // Get counts per status
  const statusCounts = await db
    .select({
      status: listing.status,
      count: sql<number>`count(*)::int`,
    })
    .from(listing)
    .where(eq(listing.ownerUserId, userId))
    .groupBy(listing.status);

  // Build counts object
  const counts = {
    activeCount: 0,
    draftCount: 0,
    pausedCount: 0,
    soldCount: 0,
    endedCount: 0,
  };

  for (const row of statusCounts) {
    switch (row.status) {
      case 'ACTIVE':
        counts.activeCount = row.count;
        break;
      case 'DRAFT':
        counts.draftCount = row.count;
        break;
      case 'PAUSED':
        counts.pausedCount = row.count;
        break;
      case 'SOLD':
        counts.soldCount = row.count;
        break;
      case 'ENDED':
        counts.endedCount = row.count;
        break;
    }
  }

  // Get recent listings (last 5)
  const recentListings = await db
    .select({
      id: listing.id,
      title: listing.title,
      slug: listing.slug,
      status: listing.status,
      priceCents: listing.priceCents,
      createdAt: listing.createdAt,
      primaryImageUrl: listingImage.url,
    })
    .from(listing)
    .leftJoin(
      listingImage,
      and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true))
    )
    .where(eq(listing.ownerUserId, userId))
    .orderBy(desc(listing.createdAt))
    .limit(5);

  return {
    ...counts,
    recentListings: recentListings.map((row) => ({
      id: row.id,
      title: row.title ?? '',
      slug: row.slug ?? row.id,
      status: row.status ?? 'DRAFT',
      priceCents: row.priceCents ?? 0,
      createdAt: row.createdAt,
      primaryImageUrl: row.primaryImageUrl,
    })),
  };
}
