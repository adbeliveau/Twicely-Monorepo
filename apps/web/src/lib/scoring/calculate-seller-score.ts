/**
 * Seller Score Calculation Engine (G4.1).
 * Pure functions — same inputs always produce same output.
 * No database access, no side effects, no randomness.
 * Seller Score Canonical Section 2-4.
 */

import type {
  ScoreInput,
  ScoreResult,
  PerformanceBand,
  BandThresholds,
  TrendState,
} from './score-types';

// ─── Sigmoid helpers ───────────────────────────────────────────────────────

/**
 * Higher-is-better sigmoid: score peaks when value >= threshold.
 * S(x) = 1000 / (1 + e^(-k * (value - threshold)))
 */
function sigmoidHigher(value: number, ideal: number, steepness: number): number {
  return 1000 / (1 + Math.exp(-steepness * (value - ideal)));
}

/**
 * Lower-is-better sigmoid: score peaks when value <= threshold.
 * S(x) = 1000 / (1 + e^(k * (value - threshold)))
 */
function sigmoidLower(value: number, ideal: number, steepness: number): number {
  return 1000 / (1 + Math.exp(steepness * (value - ideal)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Per-metric normalization ────────────────────────────────────────────

/**
 * Normalize on-time shipping pct (0-1, higher is better).
 */
function calcShippingScore(pct: number, ideal: number, steepness: number): number {
  return clamp(sigmoidHigher(pct, ideal, steepness), 0, 1000);
}

/**
 * Normalize INAD claim rate (0-1, lower is better).
 */
function calcInadScore(rate: number, ideal: number, steepness: number): number {
  return clamp(sigmoidLower(rate, ideal, steepness), 0, 1000);
}

/**
 * Normalize review average (1-5 stars, higher is better).
 * Sigmoid centered on 4.5 stars (fixed ideal per spec).
 * reviewAverage is on 1-5 scale; ideal = 4.5, steepness = 10.
 */
function calcReviewScore(avg: number, steepness: number): number {
  const REVIEW_IDEAL = 4.5;
  return clamp(sigmoidHigher(avg, REVIEW_IDEAL, steepness), 0, 1000);
}

/**
 * Normalize median response time in hours (lower is better).
 */
function calcResponseScore(hours: number, ideal: number, steepness: number): number {
  return clamp(sigmoidLower(hours, ideal, steepness), 0, 1000);
}

/**
 * Normalize return rate — seller-fault only (0-1, lower is better).
 */
function calcReturnScore(rate: number, ideal: number, steepness: number): number {
  return clamp(sigmoidLower(rate, ideal, steepness), 0, 1000);
}

/**
 * Normalize cancellation rate (0-1, lower is better).
 */
function calcCancellationScore(rate: number, ideal: number, steepness: number): number {
  return clamp(sigmoidLower(rate, ideal, steepness), 0, 1000);
}

// ─── Band derivation ────────────────────────────────────────────────────

/**
 * Derive performance band from score using configurable thresholds.
 * Canonical Section 3.1.
 */
export function deriveBand(score: number, bandThresholds: BandThresholds): PerformanceBand {
  if (score >= bandThresholds.powerSeller) return 'POWER_SELLER';
  if (score >= bandThresholds.topRated) return 'TOP_RATED';
  if (score >= bandThresholds.established) return 'ESTABLISHED';
  return 'EMERGING';
}

// ─── Search multiplier ──────────────────────────────────────────────────

/**
 * Calculate search ranking multiplier. Canonical Section 3.3.
 * SUSPENDED sellers always get 0.0 (admin-driven, not score-derived).
 * Transition sellers (10-49 orders) are clamped to 0.95-1.10.
 */
export function calculateSearchMultiplier(
  score: number,
  isSuspended: boolean,
  orderCount: number,
  newSellerThreshold: number,
  transitionThreshold: number,
): number {
  if (isSuspended) return 0.0;
  if (orderCount < newSellerThreshold) return 1.0;
  const raw = score / 800;
  if (orderCount < transitionThreshold) {
    return clamp(raw, 0.95, 1.10);
  }
  return clamp(raw, 0.60, 1.25);
}

// ─── Trend state ────────────────────────────────────────────────────────

/**
 * Calculate trend state from snapshot history.
 * Canonical Section 4.1 — computed, never stored.
 * Expects scores ordered oldest-to-newest.
 */
export function calculateTrend(scores: number[]): TrendState {
  if (scores.length < 2) return 'STEADY';
  const mid = Math.floor(scores.length / 2);
  const recent = scores.slice(mid);
  const older = scores.slice(0, mid);
  const avg30day = recent.reduce((s, v) => s + v, 0) / recent.length;
  const avg90day = older.length > 0
    ? older.reduce((s, v) => s + v, 0) / older.length
    : avg30day;
  const delta = avg30day - avg90day;
  if (delta >= 50) return 'SURGING';
  if (delta >= 10) return 'CLIMBING';
  if (delta <= -50) return 'DECLINING';
  if (delta <= -10) return 'SLIPPING';
  return 'STEADY';
}

// ─── Main score calculation ──────────────────────────────────────────────

/**
 * Calculate seller score. Pure function — deterministic.
 * Canonical Section 2.
 */
export function calculateSellerScore(
  input: ScoreInput,
  bandThresholds: BandThresholds,
): ScoreResult {
  const { metrics, thresholds, weights, orderCount, platformMean, smoothingFactor, trendData, trendModifierMax } = input;

  // Step 1: Per-metric normalization
  const shippingScore = calcShippingScore(
    metrics.onTimeShippingPct,
    thresholds.onTimeShipping.ideal,
    thresholds.onTimeShipping.steepness,
  );
  const inadScore = calcInadScore(
    metrics.inadClaimRatePct,
    thresholds.inadRate.ideal,
    thresholds.inadRate.steepness,
  );
  // reviewAverage: fixed ideal 4.5, steepness from reviewAverage is not in thresholds
  // Per spec: "use a fixed ideal of 4.5 stars across all categories, steepness 10"
  const reviewScore = calcReviewScore(metrics.reviewAverage, 10);
  const responseScore = calcResponseScore(
    metrics.responseTimeHours,
    thresholds.responseTime.ideal,
    thresholds.responseTime.steepness,
  );
  const returnScore = calcReturnScore(
    metrics.returnRatePct,
    thresholds.returnRate.ideal,
    thresholds.returnRate.steepness,
  );
  const cancellationScore = calcCancellationScore(
    metrics.cancellationRatePct,
    thresholds.cancellationRate.ideal,
    thresholds.cancellationRate.steepness,
  );

  // Step 2: Weighted sum
  const rawScore = clamp(
    shippingScore * weights.onTimeShipping
    + inadScore * weights.inadRate
    + reviewScore * weights.reviewAverage
    + responseScore * weights.responseTime
    + returnScore * weights.returnRate
    + cancellationScore * weights.cancellationRate,
    0,
    1000,
  );

  // Step 3: Bayesian smoothing
  // adjustedScore = (rawScore * orderCount + platformMean * smoothingFactor) / (orderCount + smoothingFactor)
  const adjustedScore = (rawScore * orderCount + platformMean * smoothingFactor)
    / (orderCount + smoothingFactor);
  const bayesianSmoothing = adjustedScore - rawScore;

  // Step 4: Trend modifier
  let trendModifier = 0;
  if (trendData !== null) {
    const rawMod = trendData.avg90day > 0
      ? (trendData.avg30day - trendData.avg90day) / trendData.avg90day
      : 0;
    trendModifier = clamp(rawMod, -trendModifierMax, trendModifierMax);
  }
  const scoreAfterTrend = adjustedScore * (1 + trendModifier);

  // Step 5: Clamp final score
  const score = Math.round(clamp(scoreAfterTrend, 0, 1000));

  // Step 6: Derive band
  const band = deriveBand(score, bandThresholds);

  // Step 7: Search multiplier (non-SUSPENDED path — SUSPENDED check is caller's responsibility)
  const searchMultiplier = clamp(score / 800, 0.60, 1.25);

  return {
    score,
    band,
    searchMultiplier,
    perMetricScores: {
      shippingScore: Math.round(shippingScore),
      inadScore: Math.round(inadScore),
      reviewScore: Math.round(reviewScore),
      responseScore: Math.round(responseScore),
      returnScore: Math.round(returnScore),
      cancellationScore: Math.round(cancellationScore),
    },
    rawScore: Math.round(rawScore),
    adjustedScore: Math.round(adjustedScore),
    trendModifier,
    bayesianSmoothing: Math.round(bayesianSmoothing),
  };
}
