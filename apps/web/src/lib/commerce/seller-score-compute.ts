/**
 * Seller score computation utility.
 *
 * Reads aggregated seller metrics from the sellerPerformance table,
 * computes the performance band via computePerformanceBand(), stores
 * a snapshot in sellerScoreSnapshot, and updates sellerProfile.performanceBand.
 *
 * sellerId = userId per the ownership model.
 */

import { db } from '@twicely/db';
import {
  sellerProfile,
  sellerPerformance,
  sellerScoreSnapshot,
} from '@twicely/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import {
  computePerformanceBand,
  type PerformanceBand,
  type SellerMetrics,
} from '@twicely/commerce/performance-band';
import { logger } from '@twicely/logger';

export interface ComputeSellerScoreResult {
  success: boolean;
  score?: number;
  band?: PerformanceBand;
  isNew?: boolean;
  error?: string;
}

/**
 * Fetch the most recent snapshot score for trend calculation.
 */
async function getPreviousScore(sellerProfileId: string): Promise<number | undefined> {
  const [latest] = await db
    .select({ overallScore: sellerScoreSnapshot.overallScore })
    .from(sellerScoreSnapshot)
    .where(eq(sellerScoreSnapshot.sellerProfileId, sellerProfileId))
    .orderBy(desc(sellerScoreSnapshot.createdAt))
    .limit(1);

  return latest?.overallScore ?? undefined;
}

/**
 * Compute, store, and apply the seller performance score.
 *
 * @param sellerId - The seller's userId (ownership key per spec §4.2)
 */
export async function computeAndStoreSellerScore(
  sellerId: string
): Promise<ComputeSellerScoreResult> {
  // 1. Resolve sellerProfile (PK = id, FK to user via userId)
  const [profile] = await db
    .select({
      id: sellerProfile.id,
      performanceBand: sellerProfile.performanceBand,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, sellerId))
    .limit(1);

  if (!profile) {
    return { success: false, error: 'Seller profile not found' };
  }

  // 2. Fetch pre-aggregated metrics from sellerPerformance
  const [perf] = await db
    .select({
      totalOrders:         sellerPerformance.totalOrders,
      completedOrders:     sellerPerformance.completedOrders,
      canceledOrders:      sellerPerformance.canceledOrders,
      defectRate:          sellerPerformance.defectRate,
      onTimeShippingPct:   sellerPerformance.onTimeShippingPct,
      inadRate:            sellerPerformance.inadRate,
      returnRate:          sellerPerformance.returnRate,
      cancelRate:          sellerPerformance.cancelRate,
      averageRating:       sellerPerformance.averageRating,
      avgResponseTimeHours: sellerPerformance.avgResponseTimeHours,
    })
    .from(sellerPerformance)
    .where(eq(sellerPerformance.sellerProfileId, profile.id))
    .limit(1);

  // Derive metrics with safe defaults for sellers with no performance row yet
  const metrics: SellerMetrics = {
    totalOrders:         perf?.totalOrders ?? 0,
    onTimeShippingPct:   perf?.onTimeShippingPct ?? 100,
    inadRate:            perf?.inadRate ?? 0,
    reviewAverage:       perf?.averageRating ?? null,
    responseTimeHours:   perf?.avgResponseTimeHours ?? null,
    returnRate:          perf?.returnRate ?? 0,
    cancelRate:          perf?.cancelRate ?? 0,
  };

  // 3. Fetch previous snapshot score for trend modifier
  const previousScore = await getPreviousScore(profile.id);

  // 4. Compute performance band
  const result = await computePerformanceBand(metrics, previousScore);

  // 5. Insert snapshot for this period
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const componentScoresJson = {
    onTimeShippingScore: result.metrics.onTimeShippingScore,
    inadScore:           result.metrics.inadScore,
    reviewScore:         result.metrics.reviewScore,
    responseTimeScore:   result.metrics.responseTimeScore,
    returnScore:         result.metrics.returnScore,
    cancelScore:         result.metrics.cancelScore,
  };

  try {
    await db.insert(sellerScoreSnapshot).values({
      id:                  createId(),
      sellerProfileId:     profile.id,
      overallScore:        result.score,
      componentScoresJson,
      performanceBand:     result.band,
      periodStart,
      periodEnd,
      orderCount:          metrics.totalOrders,
      defectCount:         Math.round((perf?.defectRate ?? 0) * metrics.totalOrders),
      createdAt:           now,
    });
  } catch (err) {
    logger.error('Failed to insert sellerScoreSnapshot', { err, sellerId });
    return { success: false, error: 'Failed to store score snapshot' };
  }

  // 6. Update sellerProfile.performanceBand
  try {
    await db
      .update(sellerProfile)
      .set({
        performanceBand: result.band,
        updatedAt: now,
      })
      .where(eq(sellerProfile.userId, sellerId));
  } catch (err) {
    logger.error('Failed to update sellerProfile.performanceBand', { err, sellerId });
    return { success: false, error: 'Failed to update seller profile band' };
  }

  return {
    success: true,
    score:   result.score,
    band:    result.band,
    isNew:   result.isNew,
  };
}
