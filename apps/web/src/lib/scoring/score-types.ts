/**
 * Shared TypeScript types for the Seller Score Engine (G4.1).
 * Seller Score Canonical Section 10.
 */

// Note: SUSPENDED is in the DB enum but is admin-only — never score-derived
export type PerformanceBand = 'EMERGING' | 'ESTABLISHED' | 'TOP_RATED' | 'POWER_SELLER';

export type TrendState = 'SURGING' | 'CLIMBING' | 'STEADY' | 'SLIPPING' | 'DECLINING';

export type EnforcementLevel = 'COACHING' | 'WARNING' | 'RESTRICTION' | 'PRE_SUSPENSION' | null;

export interface BandThresholds {
  powerSeller: number;  // 900
  topRated: number;     // 750
  established: number;  // 550
}

export interface MetricValues {
  onTimeShippingPct: number;      // 0.0-1.0 (fraction, not percentage)
  inadClaimRatePct: number;       // 0.0-1.0
  reviewAverage: number;          // 1.0-5.0 (DSR weighted average)
  responseTimeHours: number;      // median response time in hours
  returnRatePct: number;          // 0.0-1.0 (seller-fault only)
  cancellationRatePct: number;    // 0.0-1.0
}

export interface CategoryThresholds {
  onTimeShipping: { ideal: number; steepness: number };
  inadRate: { ideal: number; steepness: number };
  responseTime: { ideal: number; steepness: number };
  returnRate: { ideal: number; steepness: number };
  cancellationRate: { ideal: number; steepness: number };
}

export interface MetricWeights {
  onTimeShipping: number;    // 0.25
  inadRate: number;          // 0.20
  reviewAverage: number;     // 0.20
  responseTime: number;      // 0.15
  returnRate: number;        // 0.10
  cancellationRate: number;  // 0.10
}

export interface ScoreInput {
  metrics: MetricValues;
  thresholds: CategoryThresholds;
  weights: MetricWeights;
  orderCount: number;
  platformMean: number;
  smoothingFactor: number;
  trendData: { avg30day: number; avg90day: number } | null;
  trendModifierMax: number;
}

export interface PerMetricScores {
  shippingScore: number;
  inadScore: number;
  reviewScore: number;
  responseScore: number;
  returnScore: number;
  cancellationScore: number;
}

export interface ScoreResult {
  score: number;                  // 0-1000, clamped
  band: PerformanceBand;          // EMERGING | ESTABLISHED | TOP_RATED | POWER_SELLER
  searchMultiplier: number;       // 0.60-1.25
  perMetricScores: PerMetricScores;
  rawScore: number;               // before Bayesian smoothing
  adjustedScore: number;          // after Bayesian, before trend
  trendModifier: number;          // -0.05 to +0.05
  bayesianSmoothing: number;      // how much score was pulled toward mean
}
