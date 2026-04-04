/**
 * C1.2 — Seller Performance Metrics + Badges
 *
 * Computes a seller's performance score (0-1000) and band.
 * Canonical enum: POWER_SELLER, TOP_RATED, ESTABLISHED, EMERGING
 *
 * Metrics and weights:
 * - On-Time Shipping: 25%
 * - INAD Rate: 20%
 * - Review Average: 20%
 * - Response Time: 15%
 * - Return Rate: 10%
 * - Cancellation Rate: 10%
 *
 * Band thresholds:
 * - POWER_SELLER: 900-1000
 * - TOP_RATED: 750-899
 * - ESTABLISHED: 550-749
 * - EMERGING: 0-549
 *
 * Note: Suspension is handled via sellerStatus enum, not performanceBand.
 */

import { getPlatformSetting } from '@/lib/queries/platform-settings';

export type PerformanceBand = 'POWER_SELLER' | 'TOP_RATED' | 'ESTABLISHED' | 'EMERGING';

export interface SellerMetrics {
  onTimeShippingPct: number;      // 0-100
  inadRate: number;               // 0-1 (fraction)
  reviewAverage: number | null;   // 1-5 or null if no reviews
  responseTimeHours: number | null; // avg hours or null
  returnRate: number;             // 0-1 (fraction)
  cancelRate: number;             // 0-1 (fraction)
  totalOrders: number;            // for new seller detection
}

export interface PerformanceResult {
  score: number;
  band: PerformanceBand;
  isNew: boolean;
  metrics: {
    onTimeShippingScore: number;
    inadScore: number;
    reviewScore: number;
    responseTimeScore: number;
    returnScore: number;
    cancelScore: number;
  };
  trendModifier: number;
}

interface Weights {
  onTimeShipping: number;
  inad: number;
  review: number;
  responseTime: number;
  return: number;
  cancel: number;
}

/** Load metric weights from platform_settings (with hardcoded defaults). */
async function getWeights(): Promise<Weights> {
  const [ots, inad, rev, rt, ret, canc] = await Promise.all([
    getPlatformSetting<number>('score.weight.onTimeShipping', 0.25),
    getPlatformSetting<number>('score.weight.inadRate', 0.20),
    getPlatformSetting<number>('score.weight.reviewAverage', 0.20),
    getPlatformSetting<number>('score.weight.responseTime', 0.15),
    getPlatformSetting<number>('score.weight.returnRate', 0.10),
    getPlatformSetting<number>('score.weight.cancellationRate', 0.10),
  ]);
  return { onTimeShipping: ots, inad, review: rev, responseTime: rt, return: ret, cancel: canc };
}

interface BandThresholds {
  POWER_SELLER: number;
  TOP_RATED: number;
  ESTABLISHED: number;
}

/** Load band thresholds from platform_settings (with hardcoded defaults). */
async function getBandThresholds(): Promise<BandThresholds> {
  const [ps, tr, est] = await Promise.all([
    getPlatformSetting<number>('performance.band.powerSeller', 900),
    getPlatformSetting<number>('performance.band.topRated', 750),
    getPlatformSetting<number>('performance.band.established', 550),
  ]);
  return { POWER_SELLER: ps, TOP_RATED: tr, ESTABLISHED: est };
}

// Bayesian smoothing factor loaded from platform_settings
async function getSmoothingFactor(): Promise<number> {
  return getPlatformSetting<number>('score.smoothingFactor', 30);
}

// Target values for 100% score
const TARGETS = {
  onTimeShippingPct: 98,        // 98% on-time = perfect score
  inadRate: 0,                  // 0% INAD = perfect
  reviewAverage: 5.0,           // 5 stars = perfect
  responseTimeHours: 1,         // 1 hour = perfect
  returnRate: 0,                // 0% return = perfect
  cancelRate: 0,                // 0% cancel = perfect
} as const;

// Thresholds for 0% score
const MINIMUMS = {
  onTimeShippingPct: 80,        // below 80% = 0 score
  inadRate: 0.1,                // 10% INAD = 0 score
  reviewAverage: 2.0,           // 2 stars = 0 score
  responseTimeHours: 72,        // 72 hours = 0 score
  returnRate: 0.2,              // 20% return = 0 score
  cancelRate: 0.15,             // 15% cancel = 0 score
} as const;

/**
 * Compute individual metric score (0-1000 scale)
 */
function computeMetricScore(
  value: number,
  target: number,
  minimum: number,
  higherIsBetter: boolean
): number {
  if (higherIsBetter) {
    // e.g., on-time shipping, review average
    if (value >= target) return 1000;
    if (value <= minimum) return 0;
    return Math.round(((value - minimum) / (target - minimum)) * 1000);
  } else {
    // e.g., INAD rate, return rate (lower is better)
    if (value <= target) return 1000;
    if (value >= minimum) return 0;
    return Math.round(((minimum - value) / (minimum - target)) * 1000);
  }
}

/**
 * Apply Bayesian smoothing to review average
 * Pulls averages toward 3.5 for sellers with few reviews
 */
function applyBayesianSmoothing(average: number, reviewCount: number, smoothingFactor: number, priorMean: number): number {
  return (reviewCount * average + smoothingFactor * priorMean) / (reviewCount + smoothingFactor);
}

/**
 * Compute performance band from score
 */
async function getBandFromScore(score: number): Promise<PerformanceBand> {
  const thresholds = await getBandThresholds();
  if (score >= thresholds.POWER_SELLER) return 'POWER_SELLER';
  if (score >= thresholds.TOP_RATED) return 'TOP_RATED';
  if (score >= thresholds.ESTABLISHED) return 'ESTABLISHED';
  return 'EMERGING';
}

/**
 * Compute seller performance score and band.
 *
 * @param metrics - Seller's current metrics
 * @param previousScore - Previous period score (for trend calculation)
 */
export async function computePerformanceBand(
  metrics: SellerMetrics,
  previousScore?: number
): Promise<PerformanceResult> {
  const [WEIGHTS, smoothingFactor, newSellerThreshold, priorMean, trendModifierMax, trendDampeningFactor, defaultReviewScore, defaultResponseTimeScore] = await Promise.all([
    getWeights(),
    getSmoothingFactor(),
    getPlatformSetting<number>('score.newSellerOrderThreshold', 10),
    getPlatformSetting<number>('score.priorMean', 3.5),
    getPlatformSetting<number>('score.trendModifierMax', 0.05),
    getPlatformSetting<number>('score.trendDampeningFactor', 0.5),
    getPlatformSetting<number>('score.defaultReviewScore', 500),
    getPlatformSetting<number>('score.defaultResponseTimeScore', 700),
  ]);
  const isNew = metrics.totalOrders < newSellerThreshold;

  // Calculate individual metric scores
  const onTimeShippingScore = computeMetricScore(
    metrics.onTimeShippingPct,
    TARGETS.onTimeShippingPct,
    MINIMUMS.onTimeShippingPct,
    true
  );

  const inadScore = computeMetricScore(
    metrics.inadRate,
    TARGETS.inadRate,
    MINIMUMS.inadRate,
    false
  );

  // Review score with Bayesian smoothing
  let reviewScore = defaultReviewScore; // Default for no reviews
  if (metrics.reviewAverage !== null) {
    const smoothedAverage = applyBayesianSmoothing(metrics.reviewAverage, metrics.totalOrders, smoothingFactor, priorMean);
    reviewScore = computeMetricScore(
      smoothedAverage,
      TARGETS.reviewAverage,
      MINIMUMS.reviewAverage,
      true
    );
  }

  // Response time score
  let responseTimeScore = defaultResponseTimeScore; // Default for no data
  if (metrics.responseTimeHours !== null) {
    responseTimeScore = computeMetricScore(
      metrics.responseTimeHours,
      TARGETS.responseTimeHours,
      MINIMUMS.responseTimeHours,
      false
    );
  }

  const returnScore = computeMetricScore(
    metrics.returnRate,
    TARGETS.returnRate,
    MINIMUMS.returnRate,
    false
  );

  const cancelScore = computeMetricScore(
    metrics.cancelRate,
    TARGETS.cancelRate,
    MINIMUMS.cancelRate,
    false
  );

  // Calculate weighted score
  const rawScore =
    onTimeShippingScore * WEIGHTS.onTimeShipping +
    inadScore * WEIGHTS.inad +
    reviewScore * WEIGHTS.review +
    responseTimeScore * WEIGHTS.responseTime +
    returnScore * WEIGHTS.return +
    cancelScore * WEIGHTS.cancel;

  // Apply trend modifier (±5% based on improvement/decline)
  let trendModifier = 0;
  if (previousScore !== undefined && previousScore > 0) {
    const change = rawScore - previousScore;
    const changePercent = change / previousScore;
    trendModifier = Math.max(-trendModifierMax, Math.min(trendModifierMax, changePercent * trendDampeningFactor));
  }

  const finalScore = Math.round(rawScore * (1 + trendModifier));
  const clampedScore = Math.max(0, Math.min(1000, finalScore));

  return {
    score: clampedScore,
    band: await getBandFromScore(clampedScore),
    isNew,
    metrics: {
      onTimeShippingScore,
      inadScore,
      reviewScore,
      responseTimeScore,
      returnScore,
      cancelScore,
    },
    trendModifier,
  };
}

/**
 * Check if a seller qualifies for a trust badge based on their band.
 */
export function getTrustBadge(band: PerformanceBand): string | null {
  switch (band) {
    case 'POWER_SELLER':
      return 'Power Seller';
    case 'TOP_RATED':
      return 'Top Rated Seller';
    default:
      return null;
  }
}
