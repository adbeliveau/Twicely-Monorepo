/**
 * Supplemental edge-case tests for calculate-seller-score.ts (G4.1).
 * Covers: sigmoid boundary values, trend modifier edge cases,
 * Bayesian smoothing edge cases, integer output guarantees.
 * See calculate-seller-score-multiplier.test.ts for search multiplier,
 * band derivation, and calculateTrend edge cases.
 */
import { describe, it, expect } from 'vitest';
import { calculateSellerScore } from '../calculate-seller-score';
import type { ScoreInput, BandThresholds } from '../score-types';

const DEFAULT_THRESHOLDS: BandThresholds = { powerSeller: 900, topRated: 750, established: 550 };

const DEFAULT_CATEGORY_THRESHOLDS = {
  onTimeShipping: { ideal: 0.95, steepness: 10 },
  inadRate: { ideal: 0.02, steepness: 10 },
  responseTime: { ideal: 8, steepness: 10 },
  returnRate: { ideal: 0.03, steepness: 10 },
  cancellationRate: { ideal: 0.015, steepness: 10 },
};

const DEFAULT_WEIGHTS = {
  onTimeShipping: 0.25, inadRate: 0.20, reviewAverage: 0.20,
  responseTime: 0.15, returnRate: 0.10, cancellationRate: 0.10,
};

function makeInput(overrides?: Partial<ScoreInput>): ScoreInput {
  return {
    metrics: {
      onTimeShippingPct: 0.95,
      inadClaimRatePct: 0.02,
      reviewAverage: 4.5,
      responseTimeHours: 8,
      returnRatePct: 0.03,
      cancellationRatePct: 0.015,
    },
    thresholds: DEFAULT_CATEGORY_THRESHOLDS,
    weights: DEFAULT_WEIGHTS,
    orderCount: 100,
    platformMean: 600,
    smoothingFactor: 30,
    trendData: null,
    trendModifierMax: 0.05,
    ...overrides,
  };
}

// ── Sigmoid boundary values ───────────────────────────────────────────────────

describe('sigmoid boundary: value === ideal → score 500', () => {
  it('onTimeShippingPct at ideal (0.95) produces shippingScore of 500', () => {
    const input = makeInput({
      metrics: { ...makeInput().metrics, onTimeShippingPct: 0.95 },
      orderCount: 1000, smoothingFactor: 0, trendData: null,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    // sigmoid(0) = 1000/(1+e^0) = 500 exactly
    expect(result.perMetricScores.shippingScore).toBe(500);
  });

  it('inadClaimRatePct at ideal (0.02) produces inadScore of 500', () => {
    const input = makeInput({
      metrics: { ...makeInput().metrics, inadClaimRatePct: 0.02 },
      orderCount: 1000, smoothingFactor: 0, trendData: null,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.perMetricScores.inadScore).toBe(500);
  });

  it('responseTimeHours at ideal (8h) produces responseScore of 500', () => {
    const input = makeInput({
      metrics: { ...makeInput().metrics, responseTimeHours: 8 },
      orderCount: 1000, smoothingFactor: 0, trendData: null,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.perMetricScores.responseScore).toBe(500);
  });

  it('returnRatePct at ideal (0.03) produces returnScore of 500', () => {
    const input = makeInput({
      metrics: { ...makeInput().metrics, returnRatePct: 0.03 },
      orderCount: 1000, smoothingFactor: 0, trendData: null,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.perMetricScores.returnScore).toBe(500);
  });

  it('cancellationRatePct at ideal (0.015) produces cancellationScore of 500', () => {
    const input = makeInput({
      metrics: { ...makeInput().metrics, cancellationRatePct: 0.015 },
      orderCount: 1000, smoothingFactor: 0, trendData: null,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.perMetricScores.cancellationScore).toBe(500);
  });
});

// ── Trend modifier edge cases ─────────────────────────────────────────────────

describe('trend modifier edge cases', () => {
  it('trendData.avg90day === 0 produces modifier of 0 (division guard)', () => {
    const input = makeInput({
      trendData: { avg30day: 500, avg90day: 0 },
      orderCount: 200, smoothingFactor: 0,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.trendModifier).toBe(0);
  });

  it('trendModifierMax === 0 disables trend modifier entirely', () => {
    const input = makeInput({
      trendData: { avg30day: 900, avg90day: 300 },
      trendModifierMax: 0,
      orderCount: 200, smoothingFactor: 0,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.trendModifier).toBe(0);
  });

  it('trendData avg30day equals avg90day → modifier exactly 0', () => {
    const input = makeInput({
      trendData: { avg30day: 650, avg90day: 650 },
      orderCount: 200, smoothingFactor: 0,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.trendModifier).toBe(0);
  });
});

// ── Bayesian edge cases ───────────────────────────────────────────────────────

describe('Bayesian smoothing edge cases', () => {
  it('orderCount === 0 pulls score fully to platform mean', () => {
    const input = makeInput({
      metrics: { onTimeShippingPct: 1.0, inadClaimRatePct: 0, reviewAverage: 5.0, responseTimeHours: 0, returnRatePct: 0, cancellationRatePct: 0 },
      orderCount: 0, platformMean: 600, smoothingFactor: 30, trendData: null,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    // 0/(0+30) raw + 30/30 mean = 100% mean = 600
    expect(result.adjustedScore).toBe(600);
  });

  it('smoothingFactor === 0 means adjustedScore equals rawScore', () => {
    const input = makeInput({
      metrics: { onTimeShippingPct: 1.0, inadClaimRatePct: 0, reviewAverage: 5.0, responseTimeHours: 0, returnRatePct: 0, cancellationRatePct: 0 },
      orderCount: 100, platformMean: 600, smoothingFactor: 0, trendData: null,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.adjustedScore).toBe(result.rawScore);
  });

  it('very high orderCount (10000) is dominated by rawScore — smoothing < 0.3%', () => {
    const rawInput = makeInput({
      metrics: { onTimeShippingPct: 1.0, inadClaimRatePct: 0, reviewAverage: 5.0, responseTimeHours: 0, returnRatePct: 0, cancellationRatePct: 0 },
      orderCount: 10000, platformMean: 600, smoothingFactor: 30, trendData: null,
    });
    const result = calculateSellerScore(rawInput, DEFAULT_THRESHOLDS);
    // 10000/(10000+30) = 99.7% raw → adjustedScore almost equals rawScore
    expect(Math.abs(result.adjustedScore - result.rawScore)).toBeLessThan(3);
  });
});

// ── Score is always an integer ────────────────────────────────────────────────

describe('score output is always an integer', () => {
  it('final score is an integer (Math.round applied)', () => {
    const input = makeInput({ orderCount: 37, trendData: { avg30day: 612, avg90day: 598 } });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(Number.isInteger(result.score)).toBe(true);
  });

  it('rawScore is an integer', () => {
    const input = makeInput();
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(Number.isInteger(result.rawScore)).toBe(true);
  });

  it('adjustedScore is an integer', () => {
    const input = makeInput();
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(Number.isInteger(result.adjustedScore)).toBe(true);
  });
});

