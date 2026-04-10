import { db } from '@twicely/db';
import { recommendationFeed, browsingHistory, listing, follow } from '@twicely/db/schema';
import { eq, and, desc, sql, ne, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { RecommendationReason } from './types';

interface RecommendationItem {
  id: string;
  userId: string;
  listingId: string;
  score: number;
  reason: RecommendationReason;
  generatedAt: Date;
  clickedAt: Date | null;
  purchasedAt: Date | null;
}

/**
 * Generate personalized recommendations for a user.
 * Sources: recently viewed categories, purchased items, trending, followed sellers.
 */
export async function generateRecommendations(
  userId: string,
  limit: number = 20
): Promise<RecommendationItem[]> {
  const maxItems = await getPlatformSetting<number>('buyer.recommendation.maxItems', 50);
  const effectiveLimit = Math.min(limit, maxItems);

  // Clear old recommendations for this user
  await db
    .delete(recommendationFeed)
    .where(eq(recommendationFeed.userId, userId));

  // Get recently viewed category IDs
  const viewedListings = await db
    .select({
      listingId: browsingHistory.listingId,
      categoryId: browsingHistory.categoryId,
    })
    .from(browsingHistory)
    .where(eq(browsingHistory.userId, userId))
    .orderBy(desc(browsingHistory.lastViewedAt))
    .limit(20);

  const viewedListingIds = viewedListings.map(v => v.listingId);
  const viewedCategoryIds = [...new Set(viewedListings.map(v => v.categoryId).filter(Boolean))] as string[];

  // Get followed seller IDs
  const followedSellers = await db
    .select({ followedId: follow.followedId })
    .from(follow)
    .where(eq(follow.followerId, userId))
    .limit(50);

  const followedSellerIds = followedSellers.map(f => f.followedId);

  const recommendations: Array<{
    listingId: string;
    score: number;
    reason: RecommendationReason;
  }> = [];

  // Category-based recommendations (SIMILAR_TO_VIEWED)
  if (viewedCategoryIds.length > 0) {
    const categoryListings = await db
      .select({ id: listing.id })
      .from(listing)
      .where(
        and(
          inArray(listing.categoryId, viewedCategoryIds),
          eq(listing.status, 'ACTIVE')
        )
      )
      .limit(effectiveLimit);

    for (const l of categoryListings) {
      if (!viewedListingIds.includes(l.id)) {
        recommendations.push({
          listingId: l.id,
          score: 0.8,
          reason: 'SIMILAR_TO_VIEWED',
        });
      }
    }
  }

  // Followed seller recommendations (NEW_FROM_FOLLOWED)
  if (followedSellerIds.length > 0) {
    const sellerListings = await db
      .select({ id: listing.id })
      .from(listing)
      .where(
        and(
          inArray(listing.ownerUserId, followedSellerIds),
          eq(listing.status, 'ACTIVE')
        )
      )
      .orderBy(desc(listing.createdAt))
      .limit(Math.ceil(effectiveLimit / 3));

    for (const l of sellerListings) {
      if (!viewedListingIds.includes(l.id)) {
        recommendations.push({
          listingId: l.id,
          score: 0.7,
          reason: 'NEW_FROM_FOLLOWED',
        });
      }
    }
  }

  // Trending listings
  const trending = await db
    .select({ id: listing.id })
    .from(listing)
    .where(eq(listing.status, 'ACTIVE'))
    .orderBy(desc(listing.createdAt))
    .limit(Math.ceil(effectiveLimit / 4));

  for (const l of trending) {
    if (!viewedListingIds.includes(l.id) && !recommendations.some(r => r.listingId === l.id)) {
      recommendations.push({
        listingId: l.id,
        score: 0.5,
        reason: 'TRENDING',
      });
    }
  }

  // Deduplicate and sort by score
  const seen = new Set<string>();
  const unique = recommendations.filter(r => {
    if (seen.has(r.listingId)) return false;
    seen.add(r.listingId);
    return true;
  });
  unique.sort((a, b) => b.score - a.score);
  const final = unique.slice(0, effectiveLimit);

  // Insert into feed
  const now = new Date();
  const inserted: RecommendationItem[] = [];

  for (const rec of final) {
    const id = createId();
    await db.insert(recommendationFeed).values({
      id,
      userId,
      listingId: rec.listingId,
      score: rec.score,
      reason: rec.reason,
      generatedAt: now,
    });
    inserted.push({
      id,
      userId,
      listingId: rec.listingId,
      score: rec.score,
      reason: rec.reason,
      generatedAt: now,
      clickedAt: null,
      purchasedAt: null,
    });
  }

  return inserted;
}

/**
 * Record that a user clicked on a recommendation.
 */
export async function recordRecommendationClick(id: string): Promise<void> {
  await db
    .update(recommendationFeed)
    .set({ clickedAt: new Date() })
    .where(eq(recommendationFeed.id, id));
}

/**
 * Record that a user purchased from a recommendation.
 */
export async function recordRecommendationPurchase(id: string): Promise<void> {
  await db
    .update(recommendationFeed)
    .set({ purchasedAt: new Date() })
    .where(eq(recommendationFeed.id, id));
}

/**
 * Get the current recommendation feed for a user.
 */
export async function getRecommendationFeed(
  userId: string,
  limit: number = 20
): Promise<RecommendationItem[]> {
  const rows = await db
    .select({
      id: recommendationFeed.id,
      userId: recommendationFeed.userId,
      listingId: recommendationFeed.listingId,
      score: recommendationFeed.score,
      reason: recommendationFeed.reason,
      generatedAt: recommendationFeed.generatedAt,
      clickedAt: recommendationFeed.clickedAt,
      purchasedAt: recommendationFeed.purchasedAt,
    })
    .from(recommendationFeed)
    .where(eq(recommendationFeed.userId, userId))
    .orderBy(desc(recommendationFeed.score))
    .limit(limit);
  return rows.map(r => ({ ...r, reason: r.reason as RecommendationReason }));
}
