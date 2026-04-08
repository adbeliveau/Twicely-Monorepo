/**
 * Seller score computation — admin-triggered single-seller refresh.
 *
 * Delegates all scoring math to the canonical engine in @twicely/scoring.
 * Mirrors the cron path (seller-score-recalc.ts) for all side effects:
 *   1. Fetch live metrics via @twicely/scoring metric queries
 *   2. Call calculateSellerScore (Engine A, sigmoid + REVIEW_IDEAL=4.5)
 *   3. Derive effective band (override / grace period)
 *   4. Update sellerProfile (score, band, sellerScoreUpdatedAt, isNew)
 *   5. Insert sellerScoreSnapshot
 *   6. Notify on band transition
 *   7. runEnforcementReeval
 *   8. Typesense sync (dynamic import — avoids search→commerce circular dep)
 *
 * D1 fix: replaced the deprecated Engine B (performance-band.ts) with Engine A.
 * sellerId = userId per the ownership model (§4.2).
 */

import { db } from '@twicely/db';
import { sellerProfile, sellerScoreSnapshot, listing } from '@twicely/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { calculateSellerScore, calculateSearchMultiplier } from '@twicely/scoring/calculate-seller-score';
import {
  getOnTimeShippingRate, getInadClaimRate, getReturnRate,
  getCancellationRate, getPrimaryFeeBucket, getCompletedOrderCount, getPlatformMeanScore,
} from '@twicely/scoring/metric-queries';
import { getReviewAverage, getMedianResponseTime } from '@twicely/scoring/metric-queries-messaging';
import { logger } from '@twicely/logger';
import type { PerformanceBand } from '@twicely/scoring/score-types';
import {
  loadScoreSettings, loadCategoryThresholds, loadEnforcementSettings,
  determineEffectiveBand, runEnforcementReeval, notifyBandTransition,
} from './seller-score-compute-helpers';

export interface ComputeSellerScoreResult {
  success: boolean;
  score?: number;
  band?: PerformanceBand;
  isNew?: boolean;
  error?: string;
}

/**
 * Compute, store, and apply the seller performance score using the canonical engine.
 * Mirrors the cron path (seller-score-recalc.ts) including all side effects.
 *
 * @param sellerId - The seller's userId (ownership key per spec §4.2)
 */
export async function computeAndStoreSellerScore(
  sellerId: string,
): Promise<ComputeSellerScoreResult> {
  // Resolve sellerProfile
  const [profile] = await db
    .select({
      id: sellerProfile.id,
      userId: sellerProfile.userId,
      status: sellerProfile.status,
      performanceBand: sellerProfile.performanceBand,
      enforcementLevel: sellerProfile.enforcementLevel,
      warningExpiresAt: sellerProfile.warningExpiresAt,
      bandOverride: sellerProfile.bandOverride,
      bandOverrideExpiresAt: sellerProfile.bandOverrideExpiresAt,
      sellerScore: sellerProfile.sellerScore,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, sellerId))
    .limit(1);

  if (!profile) {
    return { success: false, error: 'Seller profile not found' };
  }

  const [settings, enfSettings, platformMean, windowDays] = await Promise.all([
    loadScoreSettings(),
    loadEnforcementSettings(),
    getPlatformMeanScore(),
    getPlatformSetting<number>('trust.standards.evaluationPeriodDays', 90),
  ]);

  const orderCount = await getCompletedOrderCount(sellerId, windowDays);

  // Gate: mark new seller and skip full scoring
  if (orderCount < settings.newSellerThreshold) {
    await db.update(sellerProfile)
      .set({ isNew: true, sellerScoreUpdatedAt: new Date() })
      .where(eq(sellerProfile.userId, sellerId));
    return { success: true, isNew: true };
  }

  // Fetch live metrics (canonical sources — same as cron, not sellerPerformance aggregate)
  const [onTimeShippingPct, inadClaimRatePct, reviewAverage, responseTimeHours, returnRatePct, cancellationRatePct, feeBucket] =
    await Promise.all([
      getOnTimeShippingRate(sellerId, windowDays),
      getInadClaimRate(sellerId, windowDays),
      getReviewAverage(sellerId, windowDays),
      getMedianResponseTime(sellerId, windowDays),
      getReturnRate(sellerId, windowDays),
      getCancellationRate(sellerId, windowDays),
      getPrimaryFeeBucket(sellerId, windowDays),
    ]);

  const thresholds = await loadCategoryThresholds(feeBucket);

  // Trend data from recent snapshots
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - windowDays);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0] as string;
  const snapshots = await db
    .select({ overallScore: sellerScoreSnapshot.overallScore })
    .from(sellerScoreSnapshot)
    .where(and(eq(sellerScoreSnapshot.userId, sellerId), gte(sellerScoreSnapshot.snapshotDate, ninetyDaysAgoStr)))
    .orderBy(desc(sellerScoreSnapshot.snapshotDate))
    .limit(90);
  const scoreHistory = snapshots.map((s) => s.overallScore).reverse();
  const mid = Math.floor(scoreHistory.length / 2);
  const trendData = scoreHistory.length >= 2 ? {
    avg30day: scoreHistory.slice(mid).reduce((s, v) => s + v, 0) / Math.max(scoreHistory.slice(mid).length, 1),
    avg90day: scoreHistory.slice(0, mid).reduce((s, v) => s + v, 0) / Math.max(scoreHistory.slice(0, mid).length, 1),
  } : null;

  // Engine A: sigmoid normalization, REVIEW_IDEAL=4.5, per-category thresholds, Bayesian smoothing
  const result = calculateSellerScore(
    {
      metrics: { onTimeShippingPct, inadClaimRatePct, reviewAverage, responseTimeHours, returnRatePct, cancellationRatePct },
      thresholds,
      weights: settings.weights,
      orderCount,
      platformMean,
      smoothingFactor: settings.smoothingFactor,
      trendData,
      trendModifierMax: settings.trendModifierMax,
    },
    settings.bandThresholds,
  );

  const effectiveBand = await determineEffectiveBand(profile, result.band, settings.downgradeGraceDays);
  const isSuspended = profile.status === 'SUSPENDED';
  const searchMultiplier = calculateSearchMultiplier(
    result.score, isSuspended, orderCount, settings.newSellerThreshold, settings.transitionThreshold,
  );

  const bandChanged = effectiveBand !== profile.performanceBand;
  const previousBand = profile.performanceBand as PerformanceBand;
  const today = new Date().toISOString().split('T')[0] as string;

  // Update sellerProfile (score, band, timestamp, isNew)
  await db.update(sellerProfile)
    .set({ sellerScore: result.score, sellerScoreUpdatedAt: new Date(), performanceBand: effectiveBand, isNew: false })
    .where(eq(sellerProfile.userId, sellerId));

  // Insert snapshot (same shape as cron)
  await db.insert(sellerScoreSnapshot).values({
    id: createId(),
    sellerProfileId: profile.id,
    userId: sellerId,
    snapshotDate: today,
    overallScore: result.score,
    componentScoresJson: result.perMetricScores,
    performanceBand: effectiveBand,
    periodStart: new Date(Date.now() - windowDays * 86400000),
    periodEnd: new Date(),
    orderCount,
    defectCount: 0,
    searchMultiplier,
    onTimeShippingPct,
    inadClaimRatePct,
    reviewAverage,
    responseTimeHours,
    returnRatePct,
    cancellationRatePct,
    shippingScore: result.perMetricScores.shippingScore,
    inadScore: result.perMetricScores.inadScore,
    reviewScore: result.perMetricScores.reviewScore,
    responseScore: result.perMetricScores.responseScore,
    returnScore: result.perMetricScores.returnScore,
    cancellationScore: result.perMetricScores.cancellationScore,
    primaryFeeBucket: feeBucket,
    trendModifier: result.trendModifier,
    bayesianSmoothing: result.bayesianSmoothing,
    previousBand: bandChanged ? (previousBand as PerformanceBand) : null,
    bandChangedAt: bandChanged ? new Date() : null,
  }).onConflictDoNothing();

  // Notify on band transition (skip if seller was SUSPENDED — admin action owns that)
  if (bandChanged && previousBand !== ('SUSPENDED' as PerformanceBand)) {
    await notifyBandTransition(sellerId, previousBand, effectiveBand);
  }

  // Enforcement re-evaluation
  await runEnforcementReeval(
    profile, result.score, enfSettings.warningDurationDays, enfSettings.coachingBelow,
    enfSettings.warningBelow, enfSettings.restrictionBelow, enfSettings.preSuspensionBelow,
  );

  // Typesense sync — dynamic import to avoid circular dep (search → commerce)
  try {
    const [{ getTypesenseClient }, { LISTINGS_COLLECTION }] = await Promise.all([
      import('@twicely/search/typesense-client'),
      import('@twicely/search/typesense-schema'),
    ]);
    const client = getTypesenseClient();
    const activeListings = await db
      .select({ id: listing.id })
      .from(listing)
      .where(and(eq(listing.ownerUserId, sellerId), eq(listing.status, 'ACTIVE')));

    if (activeListings.length > 0) {
      const docs = activeListings.map((l) => ({
        id: l.id,
        sellerScore: result.score,
        sellerPerformanceBand: effectiveBand,
      }));
      await client.collections(LISTINGS_COLLECTION).documents().import(docs, { action: 'update' });
    }
  } catch {
    // Typesense unavailable — scores will sync on next listing update
  }

  logger.info('[computeAndStoreSellerScore] Complete', { sellerId, score: result.score, band: effectiveBand });

  return {
    success: true,
    score: result.score,
    band: effectiveBand,
    isNew: false,
  };
}
