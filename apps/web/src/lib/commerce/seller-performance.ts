import { db } from '@twicely/db';
import { review, sellerProfile, sellerPerformance } from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Recalculate and update seller performance aggregates.
 *
 * Called after review creation or update to keep sellerPerformance.totalReviews
 * and sellerPerformance.averageRating in sync.
 *
 * @param sellerId - user.id (not sellerProfile.id)
 */
export async function updateSellerPerformanceAggregates(sellerId: string): Promise<void> {
  // Get sellerProfileId from userId
  const [profile] = await db
    .select({ id: sellerProfile.id })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, sellerId))
    .limit(1);

  if (!profile) {
    // Seller doesn't have a profile yet (shouldn't happen, but guard against it)
    return;
  }

  // Calculate aggregate stats for this seller
  const [stats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      avgRating: sql<number>`avg(${review.rating})::real`,
    })
    .from(review)
    .where(and(
      eq(review.sellerId, sellerId),
      eq(review.status, 'APPROVED')
    ));

  if (!stats) return;

  // Update seller performance using sellerProfileId
  await db
    .update(sellerPerformance)
    .set({
      totalReviews: stats.count,
      averageRating: stats.avgRating,
      updatedAt: new Date(),
    })
    .where(eq(sellerPerformance.sellerProfileId, profile.id));
}
