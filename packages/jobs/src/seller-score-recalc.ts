/**
 * Daily seller score recalculation BullMQ job.
 * Runs at 3 AM UTC. Concurrency: 10 workers.
 * Seller Score Canonical Section 12.1.
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { sellerProfile, sellerScoreSnapshot, listing } from '@twicely/db/schema';
import { eq, and, gte, desc, ne } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { calculateSellerScore, calculateSearchMultiplier } from '@twicely/scoring/calculate-seller-score';
import {
  getOnTimeShippingRate, getInadClaimRate, getReturnRate,
  getCancellationRate, getPrimaryFeeBucket, getCompletedOrderCount, getPlatformMeanScore,
} from '@twicely/scoring/metric-queries';
import { getReviewAverage, getMedianResponseTime } from '@twicely/scoring/metric-queries-messaging';
import {
  determineEffectiveBand, runAutoEnforcement, notifyBandTransition, loadEnforcementSettings,
  type SellerRow,
} from './seller-score-recalc-helpers';
import { logger } from '@twicely/logger';
import type { BandThresholds, CategoryThresholds, MetricWeights, PerformanceBand } from '@twicely/scoring/score-types';

const QUEUE_NAME = 'seller-score-recalc';

interface RecalcJobData { triggeredAt: string; }

export const sellerScoreRecalcQueue = createQueue<RecalcJobData>(QUEUE_NAME);

export async function registerSellerScoreRecalcJob(): Promise<void> {
  await sellerScoreRecalcQueue.add(
    'seller-score-recalc-daily',
    { triggeredAt: new Date().toISOString() },
    { jobId: 'seller-score-recalc-daily', repeat: { pattern: '0 3 * * *', tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 100 } },
  );
  logger.info('[sellerScoreRecalc] Registered daily recalc job');
}

async function loadScoreSettings() {
  const [sf, tmm, ps, tr, es, wOts, wInad, wRev, wResp, wRet, wCancel, nst, tst, dgd] =
    await Promise.all([
      getPlatformSetting('score.smoothingFactor', 30),
      getPlatformSetting('score.trendModifierMax', 0.05),
      getPlatformSetting('performance.band.powerSeller', 900),
      getPlatformSetting('performance.band.topRated', 750),
      getPlatformSetting('performance.band.established', 550),
      getPlatformSetting('score.weight.onTimeShipping', 0.25),
      getPlatformSetting('score.weight.inadRate', 0.20),
      getPlatformSetting('score.weight.reviewAverage', 0.20),
      getPlatformSetting('score.weight.responseTime', 0.15),
      getPlatformSetting('score.weight.returnRate', 0.10),
      getPlatformSetting('score.weight.cancellationRate', 0.10),
      getPlatformSetting('score.newSellerOrderThreshold', 10),
      getPlatformSetting('score.transitionOrderThreshold', 50),
      getPlatformSetting('score.downgradeGraceDays', 7),
    ]);
  return {
    smoothingFactor: Number(sf), trendModifierMax: Number(tmm),
    bandThresholds: { powerSeller: Number(ps), topRated: Number(tr), established: Number(es) } as BandThresholds,
    weights: { onTimeShipping: Number(wOts), inadRate: Number(wInad), reviewAverage: Number(wRev), responseTime: Number(wResp), returnRate: Number(wRet), cancellationRate: Number(wCancel) } as MetricWeights,
    newSellerThreshold: Number(nst), transitionThreshold: Number(tst), downgradeGraceDays: Number(dgd),
  };
}

async function loadCategoryThresholds(fb: string): Promise<CategoryThresholds> {
  const [otsI, otsSt, inadI, inadSt, rtI, rtSt, rrI, rrSt, crI, crSt] = await Promise.all([
    getPlatformSetting(`score.threshold.${fb}.onTimeShipping.ideal`, 0.95),
    getPlatformSetting(`score.threshold.${fb}.onTimeShipping.steepness`, 10),
    getPlatformSetting(`score.threshold.${fb}.inadRate.ideal`, 0.02),
    getPlatformSetting(`score.threshold.${fb}.inadRate.steepness`, 10),
    getPlatformSetting(`score.threshold.${fb}.responseTime.ideal`, 8),
    getPlatformSetting(`score.threshold.${fb}.responseTime.steepness`, 10),
    getPlatformSetting(`score.threshold.${fb}.returnRate.ideal`, 0.03),
    getPlatformSetting(`score.threshold.${fb}.returnRate.steepness`, 10),
    getPlatformSetting(`score.threshold.${fb}.cancellationRate.ideal`, 0.015),
    getPlatformSetting(`score.threshold.${fb}.cancellationRate.steepness`, 10),
  ]);
  return {
    onTimeShipping: { ideal: Number(otsI), steepness: Number(otsSt) },
    inadRate: { ideal: Number(inadI), steepness: Number(inadSt) },
    responseTime: { ideal: Number(rtI), steepness: Number(rtSt) },
    returnRate: { ideal: Number(rrI), steepness: Number(rrSt) },
    cancellationRate: { ideal: Number(crI), steepness: Number(crSt) },
  };
}

async function processSeller(seller: SellerRow, settings: Awaited<ReturnType<typeof loadScoreSettings>>, enfSettings: Awaited<ReturnType<typeof loadEnforcementSettings>>, platformMean: number, today: string, windowDays: number): Promise<void> {
  const { userId } = seller;
  const orderCount = await getCompletedOrderCount(userId, windowDays);
  if (orderCount < 1) return;

  if (orderCount < settings.newSellerThreshold) {
    await db.update(sellerProfile).set({ isNew: true, sellerScoreUpdatedAt: new Date() }).where(eq(sellerProfile.userId, userId));
    return;
  }

  const [onTimeShippingPct, inadClaimRatePct, reviewAverage, responseTimeHours, returnRatePct, cancellationRatePct, feeBucket] = await Promise.all([
    getOnTimeShippingRate(userId, windowDays), getInadClaimRate(userId, windowDays),
    getReviewAverage(userId, windowDays), getMedianResponseTime(userId, windowDays),
    getReturnRate(userId, windowDays), getCancellationRate(userId, windowDays),
    getPrimaryFeeBucket(userId, windowDays),
  ]);

  const thresholds = await loadCategoryThresholds(feeBucket);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - windowDays);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0] as string;
  const snapshots = await db.select({ overallScore: sellerScoreSnapshot.overallScore }).from(sellerScoreSnapshot)
    .where(and(eq(sellerScoreSnapshot.userId, userId), gte(sellerScoreSnapshot.snapshotDate, ninetyDaysAgoStr)))
    .orderBy(desc(sellerScoreSnapshot.snapshotDate)).limit(90);
  const scoreHistory = snapshots.map((s) => s.overallScore).reverse();
  const mid = Math.floor(scoreHistory.length / 2);
  const trendData = scoreHistory.length >= 2 ? {
    avg30day: scoreHistory.slice(mid).reduce((s, v) => s + v, 0) / Math.max(scoreHistory.slice(mid).length, 1),
    avg90day: scoreHistory.slice(0, mid).reduce((s, v) => s + v, 0) / Math.max(scoreHistory.slice(0, mid).length, 1),
  } : null;

  const result = calculateSellerScore(
    { metrics: { onTimeShippingPct, inadClaimRatePct, reviewAverage, responseTimeHours, returnRatePct, cancellationRatePct }, thresholds, weights: settings.weights, orderCount, platformMean, smoothingFactor: settings.smoothingFactor, trendData, trendModifierMax: settings.trendModifierMax },
    settings.bandThresholds,
  );

  const effectiveBand = await determineEffectiveBand(seller, result.band, settings.downgradeGraceDays);
  const isSuspended = seller.status === 'SUSPENDED';
  const searchMultiplier = calculateSearchMultiplier(result.score, isSuspended, orderCount, settings.newSellerThreshold, settings.transitionThreshold);

  const bandChanged = effectiveBand !== seller.performanceBand;
  const previousBand = seller.performanceBand;

  await db.update(sellerProfile).set({ sellerScore: result.score, sellerScoreUpdatedAt: new Date(), performanceBand: effectiveBand, isNew: false }).where(eq(sellerProfile.userId, userId));

  await db.insert(sellerScoreSnapshot).values({
    id: createId(), sellerProfileId: seller.id, userId, snapshotDate: today,
    overallScore: result.score, componentScoresJson: result.perMetricScores,
    performanceBand: effectiveBand, periodStart: new Date(Date.now() - windowDays * 86400000), periodEnd: new Date(),
    orderCount, defectCount: 0, searchMultiplier,
    onTimeShippingPct, inadClaimRatePct, reviewAverage, responseTimeHours, returnRatePct, cancellationRatePct,
    shippingScore: result.perMetricScores.shippingScore, inadScore: result.perMetricScores.inadScore,
    reviewScore: result.perMetricScores.reviewScore, responseScore: result.perMetricScores.responseScore,
    returnScore: result.perMetricScores.returnScore, cancellationScore: result.perMetricScores.cancellationScore,
    primaryFeeBucket: feeBucket, trendModifier: result.trendModifier, bayesianSmoothing: result.bayesianSmoothing,
    previousBand: bandChanged ? previousBand : null, bandChangedAt: bandChanged ? new Date() : null,
  }).onConflictDoNothing();

  if (bandChanged && previousBand !== 'SUSPENDED') {
    await notifyBandTransition(userId, previousBand as PerformanceBand, effectiveBand);
  }

  await runAutoEnforcement(seller, result.score, enfSettings.warningDurationDays, enfSettings.coachingBelow, enfSettings.warningBelow, enfSettings.restrictionBelow, enfSettings.preSuspensionBelow);

  // Update Typesense: patch sellerScore on all ACTIVE listings for this seller.
  // Dynamic import to avoid circular dep (search → commerce → jobs).
  try {
    const [{ getTypesenseClient }, { LISTINGS_COLLECTION }] = await Promise.all([
      import('@twicely/search/typesense-client'),
      import('@twicely/search/typesense-schema'),
    ]);
    const client = getTypesenseClient();
    const activeListings = await db
      .select({ id: listing.id })
      .from(listing)
      .where(and(eq(listing.ownerUserId, userId), eq(listing.status, 'ACTIVE')));

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
}

export async function processSellerScoreRecalc(): Promise<void> {
  const [settings, enfSettings, platformMean, windowDays] = await Promise.all([
    loadScoreSettings(),
    loadEnforcementSettings(),
    getPlatformMeanScore(),
    getPlatformSetting<number>('trust.standards.evaluationPeriodDays', 90),
  ]);
  const today = new Date().toISOString().split('T')[0] as string;

  const sellers = await db.select({
    id: sellerProfile.id, userId: sellerProfile.userId, status: sellerProfile.status,
    performanceBand: sellerProfile.performanceBand, enforcementLevel: sellerProfile.enforcementLevel,
    warningExpiresAt: sellerProfile.warningExpiresAt, bandOverride: sellerProfile.bandOverride,
    bandOverrideExpiresAt: sellerProfile.bandOverrideExpiresAt, sellerScore: sellerProfile.sellerScore,
  }).from(sellerProfile).where(ne(sellerProfile.status, 'SUSPENDED'));

  logger.info('[sellerScoreRecalc] Starting recalc', { sellerCount: sellers.length });

  for (const seller of sellers) {
    try {
      await processSeller(seller as SellerRow, settings, enfSettings, platformMean, today, windowDays);
    } catch (err) {
      logger.error('[sellerScoreRecalc] Error processing seller', { userId: seller.userId, err });
    }
  }

  logger.info('[sellerScoreRecalc] Complete', { sellerCount: sellers.length });
}

export const sellerScoreRecalcWorker = createWorker<RecalcJobData>(
  QUEUE_NAME,
  async () => { await processSellerScoreRecalc(); },
  10,
);