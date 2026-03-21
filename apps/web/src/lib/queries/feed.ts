import { db } from '@twicely/db';
import {
  listing,
  listingImage,
  user,
  sellerProfile,
  sellerPerformance,
  userInterest,
  interestTag,
  promotedListing,
} from '@twicely/db/schema';
import { eq, and, desc, sql, ne, notInArray, isNotNull, gt } from 'drizzle-orm';
import { mapToListingCard } from './shared';
import { getFollowedSellerNewListings } from './follow';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type { ListingCardData } from '@/types/listings';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedData {
  followedListings: ListingCardData[];
  /** Section 2 — deferred until G3.9 (requires snapshotPriceCents on watchlistItem) */
  watchlistDrops: ListingCardData[];
  matchedListings: ListingCardData[];
  boostedListings: ListingCardData[];
  hasInterests: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const listingCardFields = {
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
};

// ─── Feed Query ───────────────────────────────────────────────────────────────

/**
 * V1 personalized "For You" feed.
 * Sections:
 *   1. followedListings — new listings from followed sellers (social override)
 *   2. watchlistDrops   — DEFERRED (G3.9)
 *   3. matchedListings  — interest-matched listings ranked by weight
 *   4. boostedListings  — promoted listings that match user interests
 *
 * Per Personalization Canonical §9: following does NOT add interest weight.
 * Per Personalization Canonical §10: boosted listings that don't match interests are excluded.
 */
export async function getForYouFeed(
  userId: string,
  _page = 1,
  _pageSize = 40,
): Promise<FeedData> {
  // Section 1 — social override (limit from platform settings)
  const followedLimit = await getPlatformSetting<number>('social.feed.followedSellerListingLimit', 20);
  const followedListings = await getFollowedSellerNewListings(userId, followedLimit);
  const followedIds = followedListings.map((l) => l.id);

  // Check if user has non-expired interest records
  const [interestRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userInterest)
    .where(
      and(
        eq(userInterest.userId, userId),
        sql`(${userInterest.expiresAt} IS NULL OR ${userInterest.expiresAt} > now())`,
      ),
    );
  const hasInterests = (interestRow?.count ?? 0) > 0;

  // Section 2 — watchlist price drops (DEFERRED until G3.9)
  // TODO G3.9: watchlist price drops — requires snapshotPriceCents on watchlistItem
  const watchlistDrops: ListingCardData[] = [];

  // Section 3 — interest-matched listings
  const interestLimit = await getPlatformSetting<number>('social.feed.interestListingLimit', 40);
  const matchedListings = await getInterestMatchedListings(
    userId,
    followedIds,
    interestLimit,
  );

  // Section 4 — boosted listings matching user interests
  const allExcludedIds = [
    ...followedIds,
    ...matchedListings.map((l) => l.id),
  ];
  const boostedListings = await getBoostedInterestListings(
    userId,
    allExcludedIds,
  );

  return { followedListings, watchlistDrops, matchedListings, boostedListings, hasInterests };
}

// ─── Interest Matched ─────────────────────────────────────────────────────────

async function getInterestMatchedListings(
  userId: string,
  excludeIds: string[],
  limit: number,
): Promise<ListingCardData[]> {
  // Aggregate non-expired interest weights per tag slug
  const userWeightsCte = db
    .$with('user_weights')
    .as(
      db
        .select({
          tagSlug: userInterest.tagSlug,
          totalWeight: sql<number>`sum(${userInterest.weight}::numeric)`,
        })
        .from(userInterest)
        .where(
          and(
            eq(userInterest.userId, userId),
            sql`(${userInterest.expiresAt} IS NULL OR ${userInterest.expiresAt} > now())`,
          ),
        )
        .groupBy(userInterest.tagSlug),
    );

  const baseWhere = and(
    eq(listing.status, 'ACTIVE'),
    ne(listing.ownerUserId, userId),
    excludeIds.length > 0 ? notInArray(listing.id, excludeIds) : undefined,
    isNotNull(listing.categoryId),
  );

  const rows = await db
    .with(userWeightsCte)
    .select({
      ...listingCardFields,
      relevanceScore: sql<number>`max(coalesce(uw.total_weight, 0))`,
    })
    .from(listing)
    .leftJoin(listingImage, and(
      eq(listingImage.listingId, listing.id),
      eq(listingImage.isPrimary, true),
    ))
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(sellerProfile.userId, listing.ownerUserId))
    .leftJoin(sellerPerformance, eq(sellerPerformance.sellerProfileId, sellerProfile.id))
    .leftJoin(
      interestTag,
      and(
        sql`${listing.categoryId} = ANY(${interestTag.categoryIds})`,
        eq(interestTag.isActive, true),
      ),
    )
    .leftJoin(
      sql`user_weights uw`,
      sql`uw.tag_slug = ${interestTag.slug}`,
    )
    .where(baseWhere)
    .groupBy(
      listing.id, listing.slug, listing.title, listing.priceCents,
      listing.originalPriceCents, listing.condition, listing.brand,
      listing.freeShipping, listing.shippingCents, listing.createdAt,
      listingImage.url, listingImage.altText,
      user.displayName, user.username, user.avatarUrl,
      sellerPerformance.averageRating, sellerPerformance.totalReviews, sellerPerformance.showStars,
    )
    .orderBy(sql`max(coalesce(uw.total_weight, 0)) DESC`, desc(listing.createdAt))
    .limit(limit);

  return rows.map((row) => mapToListingCard(row));
}

// ─── Boosted Interest Listings ────────────────────────────────────────────────

async function getBoostedInterestListings(
  userId: string,
  excludeIds: string[],
): Promise<ListingCardData[]> {
  const userTagsCte = db
    .$with('user_tags')
    .as(
      db
        .select({ tagSlug: userInterest.tagSlug })
        .from(userInterest)
        .where(
          and(
            eq(userInterest.userId, userId),
            sql`(${userInterest.expiresAt} IS NULL OR ${userInterest.expiresAt} > now())`,
          ),
        )
        .groupBy(userInterest.tagSlug),
    );

  const baseWhere = and(
    eq(listing.status, 'ACTIVE'),
    ne(listing.ownerUserId, userId),
    excludeIds.length > 0 ? notInArray(listing.id, excludeIds) : undefined,
    eq(promotedListing.isActive, true),
    gt(promotedListing.endedAt, sql`now()`),
    isNotNull(listing.categoryId),
  );

  const rows = await db
    .with(userTagsCte)
    .select(listingCardFields)
    .from(listing)
    .innerJoin(promotedListing, eq(promotedListing.listingId, listing.id))
    .innerJoin(
      interestTag,
      and(
        sql`${listing.categoryId} = ANY(${interestTag.categoryIds})`,
        eq(interestTag.isActive, true),
      ),
    )
    .innerJoin(
      sql`user_tags ut`,
      sql`ut.tag_slug = ${interestTag.slug}`,
    )
    .leftJoin(listingImage, and(
      eq(listingImage.listingId, listing.id),
      eq(listingImage.isPrimary, true),
    ))
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(sellerProfile.userId, listing.ownerUserId))
    .leftJoin(sellerPerformance, eq(sellerPerformance.sellerProfileId, sellerProfile.id))
    .where(baseWhere)
    .orderBy(desc(listing.createdAt))
    .limit(20);

  return rows.map((row) => mapToListingCard(row));
}
