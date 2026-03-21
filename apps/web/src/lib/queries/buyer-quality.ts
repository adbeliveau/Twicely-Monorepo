import { db } from '@twicely/db';
import { buyerReview } from '@twicely/db/schema';
import { eq, sql, and, isNotNull, lte } from 'drizzle-orm';

export type BuyerQualityTier = 'GREEN' | 'YELLOW' | 'RED' | null;

/**
 * Get buyer quality tier based on visible seller→buyer reviews.
 * Only counts reviews where visibleAt has passed (dual-blind).
 *
 * GREEN: avg >= 4.0 OR fewer than 3 visible reviews
 * YELLOW: avg >= 2.5 AND avg < 4.0
 * RED: avg < 2.5
 * null: no visible reviews
 */
export async function getBuyerQualityTier(buyerUserId: string): Promise<BuyerQualityTier> {
  const now = new Date();

  const [result] = await db
    .select({
      avgRating: sql<number>`ROUND(AVG(${buyerReview.overallRating})::numeric, 2)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(buyerReview)
    .where(
      and(
        eq(buyerReview.buyerUserId, buyerUserId),
        // Only visible reviews (dual-blind gate passed)
        isNotNull(buyerReview.visibleAt),
        lte(buyerReview.visibleAt, now)
      )
    );

  if (!result || result.count === 0) return null;
  if (result.count < 3) return 'GREEN'; // Benefit of the doubt
  if (result.avgRating >= 4.0) return 'GREEN';
  if (result.avgRating >= 2.5) return 'YELLOW';
  return 'RED';
}
