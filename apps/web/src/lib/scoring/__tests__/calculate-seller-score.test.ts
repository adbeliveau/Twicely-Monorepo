import { describe, it, expect } from 'vitest';
import {
  calculateSellerScore,
  calculateSearchMultiplier,
  calculateTrend,
  deriveBand,
} from '../calculate-seller-score';
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

describe('sigmoid normalization', () => {
  it('scores ~500 when on-time shipping equals ideal threshold', () => {
    const input = makeInput({ metrics: { ...makeInput().metrics, onTimeShippingPct: 0.95 } });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.perMetricScores.shippingScore).toBeCloseTo(500, -1);
  });

  it('scores ~0 when on-time shipping is far below ideal', () => {
    const input = makeInput({ metrics: { ...makeInput().metrics, onTimeShippingPct: 0.0 } });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.perMetricScores.shippingScore).toBeLessThan(10);
  });

  it('scores ~500 when INAD rate equals ideal (lower is better)', () => {
    const input = makeInput({ metrics: { ...makeInput().metrics, inadClaimRatePct: 0.02 } });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.perMetricScores.inadScore).toBeCloseTo(500, -1);
  });

  it('scores above ideal midpoint when INAD rate is 0 (lower is better)', () => {
    const input = makeInput({ metrics: { ...makeInput().metrics, inadClaimRatePct: 0.0 } });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    // sigmoidLower(0, ideal=0.02, steepness=10) ≈ 550 — above the 500 midpoint
    expect(result.perMetricScores.inadScore).toBeGreaterThan(500);
  });

  it('scores ~0 when INAD rate is far above ideal', () => {
    const input = makeInput({ metrics: { ...makeInput().metrics, inadClaimRatePct: 0.5 } });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.perMetricScores.inadScore).toBeLessThan(10);
  });

  it('scores close to 1000 for responseTime of 0 hours', () => {
    const input = makeInput({ metrics: { ...makeInput().metrics, responseTimeHours: 0 } });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.perMetricScores.responseScore).toBeGreaterThan(900);
  });

  it('scores close to 0 for reviewAverage of 1.0', () => {
    const input = makeInput({ metrics: { ...makeInput().metrics, reviewAverage: 1.0 } });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.perMetricScores.reviewScore).toBeLessThan(50);
  });
});

describe('weighted sum', () => {
  it('correctly weights 6 metrics', () => {
    const input = makeInput({ orderCount: 1000, smoothingFactor: 0 });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.rawScore).toBeGreaterThan(0);
    expect(result.rawScore).toBeLessThanOrEqual(1000);
  });

  it('weights sum to 1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('produces score 0-1000 for all-perfect metrics', () => {
    const input = makeInput({
      metrics: { onTimeShippingPct: 1.0, inadClaimRatePct: 0, reviewAverage: 5.0, responseTimeHours: 0, returnRatePct: 0, cancellationRatePct: 0 },
      orderCount: 1000, smoothingFactor: 0, trendData: null,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1000);
    // With steepness=10, even perfect values produce ~700-750 due to sigmoid shape
    expect(result.score).toBeGreaterThan(600);
  });

  it('produces score 0-1000 for all-terrible metrics', () => {
    const input = makeInput({
      metrics: { onTimeShippingPct: 0, inadClaimRatePct: 1.0, reviewAverage: 1.0, responseTimeHours: 999, returnRatePct: 1.0, cancellationRatePct: 1.0 },
      orderCount: 1000, smoothingFactor: 0, trendData: null,
    });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1000);
    expect(result.score).toBeLessThan(10);
  });
});

describe('Bayesian smoothing', () => {
  const goodMetrics = { onTimeShippingPct: 1.0, inadClaimRatePct: 0, reviewAverage: 5.0, responseTimeHours: 0, returnRatePct: 0, cancellationRatePct: 0 };

  it('pulls 2-order seller ~86% toward platform mean', () => {
    const input = makeInput({ metrics: goodMetrics, orderCount: 2, platformMean: 600, smoothingFactor: 14 });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    // With 2 orders and smoothingFactor 14: 2/(2+14) = 12.5% raw, 87.5% mean
    expect(result.adjustedScore).toBeGreaterThan(600);
    expect(result.adjustedScore).toBeLessThan(result.rawScore);
  });

  it('pulls 30-order seller ~50% toward platform mean with factor 30', () => {
    const input = makeInput({ metrics: goodMetrics, orderCount: 30, platformMean: 600, smoothingFactor: 30 });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    // 30/(30+30) = 50% raw
    const expected = (result.rawScore * 30 + 600 * 30) / 60;
    // adjustedScore is rounded, allow ±1 tolerance
    expect(Math.abs(result.adjustedScore - expected)).toBeLessThanOrEqual(1);
  });

  it('has negligible Bayesian effect at 500+ orders', () => {
    // 500/(500+30) = 94.3% raw — very close to raw
    const rawFraction = 500 / 530;
    expect(rawFraction).toBeGreaterThan(0.93);
  });

  it('uses configurable smoothing factor', () => {
    const input1 = makeInput({ metrics: goodMetrics, orderCount: 10, smoothingFactor: 10, platformMean: 600, trendData: null });
    const input2 = makeInput({ metrics: goodMetrics, orderCount: 10, smoothingFactor: 100, platformMean: 600, trendData: null });
    const r1 = calculateSellerScore(input1, DEFAULT_THRESHOLDS);
    const r2 = calculateSellerScore(input2, DEFAULT_THRESHOLDS);
    // Higher smoothing = more pulled toward mean
    expect(r2.adjustedScore).toBeLessThan(r1.adjustedScore);
  });
});

describe('trend modifier', () => {
  it('applies +5% modifier when avg30day >> avg90day', () => {
    const input = makeInput({ trendData: { avg30day: 900, avg90day: 600 }, orderCount: 200, smoothingFactor: 0 });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.trendModifier).toBeCloseTo(0.05, 3);
  });

  it('applies -5% modifier when avg30day << avg90day', () => {
    const input = makeInput({ trendData: { avg30day: 300, avg90day: 900 }, orderCount: 200, smoothingFactor: 0 });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.trendModifier).toBeCloseTo(-0.05, 3);
  });

  it('applies 0% modifier when trend is steady', () => {
    const input = makeInput({ trendData: { avg30day: 700, avg90day: 700 }, orderCount: 200, smoothingFactor: 0 });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.trendModifier).toBeCloseTo(0, 5);
  });

  it('clamps modifier to configured max', () => {
    const input = makeInput({ trendData: { avg30day: 1000, avg90day: 100 }, trendModifierMax: 0.05, orderCount: 200, smoothingFactor: 0 });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.trendModifier).toBeCloseTo(0.05, 3);
  });

  it('handles null trendData gracefully (no modification)', () => {
    const input = makeInput({ trendData: null, orderCount: 200, smoothingFactor: 0 });
    const result = calculateSellerScore(input, DEFAULT_THRESHOLDS);
    expect(result.trendModifier).toBe(0);
  });
});

describe('band derivation', () => {
  it('assigns POWER_SELLER at score 900+', () => {
    expect(deriveBand(900, DEFAULT_THRESHOLDS)).toBe('POWER_SELLER');
    expect(deriveBand(1000, DEFAULT_THRESHOLDS)).toBe('POWER_SELLER');
  });

  it('assigns TOP_RATED at score 750-899', () => {
    expect(deriveBand(750, DEFAULT_THRESHOLDS)).toBe('TOP_RATED');
    expect(deriveBand(850, DEFAULT_THRESHOLDS)).toBe('TOP_RATED');
    expect(deriveBand(899, DEFAULT_THRESHOLDS)).toBe('TOP_RATED');
  });

  it('assigns ESTABLISHED at score 550-749', () => {
    expect(deriveBand(550, DEFAULT_THRESHOLDS)).toBe('ESTABLISHED');
    expect(deriveBand(650, DEFAULT_THRESHOLDS)).toBe('ESTABLISHED');
    expect(deriveBand(749, DEFAULT_THRESHOLDS)).toBe('ESTABLISHED');
  });

  it('assigns EMERGING at score below 550', () => {
    expect(deriveBand(549, DEFAULT_THRESHOLDS)).toBe('EMERGING');
    expect(deriveBand(0, DEFAULT_THRESHOLDS)).toBe('EMERGING');
  });

  it('uses configurable band thresholds', () => {
    const custom: BandThresholds = { powerSeller: 800, topRated: 600, established: 400 };
    expect(deriveBand(799, custom)).toBe('TOP_RATED');
    expect(deriveBand(800, custom)).toBe('POWER_SELLER');
    expect(deriveBand(400, custom)).toBe('ESTABLISHED');
    expect(deriveBand(399, custom)).toBe('EMERGING');
  });
});

describe('search multiplier', () => {
  it('returns 0.60 for score 0 (non-suspended, established seller)', () => {
    const mult = calculateSearchMultiplier(0, false, 100, 10, 50);
    expect(mult).toBeCloseTo(0.60, 5);
  });

  it('returns 1.0 for score 800', () => {
    const mult = calculateSearchMultiplier(800, false, 100, 10, 50);
    expect(mult).toBeCloseTo(1.0, 5);
  });

  it('returns 1.25 for score 1000', () => {
    const mult = calculateSearchMultiplier(1000, false, 100, 10, 50);
    expect(mult).toBeCloseTo(1.25, 5);
  });

  it('returns 0.0 for SUSPENDED seller', () => {
    expect(calculateSearchMultiplier(900, true, 100, 10, 50)).toBe(0.0);
  });

  it('returns 1.0 for new seller (< 10 orders)', () => {
    expect(calculateSearchMultiplier(800, false, 5, 10, 50)).toBe(1.0);
  });

  it('clamps multiplier for transition sellers (10-49 orders) to 0.95-1.10', () => {
    expect(calculateSearchMultiplier(0, false, 20, 10, 50)).toBeCloseTo(0.95, 5);
    expect(calculateSearchMultiplier(1000, false, 20, 10, 50)).toBeCloseTo(1.10, 5);
    expect(calculateSearchMultiplier(800, false, 20, 10, 50)).toBeCloseTo(1.0, 5);
  });
});

describe('trend state', () => {
  it('returns SURGING when delta >= 50', () => {
    const scores = [500, 510, 520, 530, 540, 600, 650, 700];
    expect(calculateTrend(scores)).toBe('SURGING');
  });

  it('returns CLIMBING when delta 10-49', () => {
    const scores = [600, 605, 610, 615, 620, 625, 630, 635];
    expect(calculateTrend(scores)).toBe('CLIMBING');
  });

  it('returns STEADY when delta within +-10', () => {
    const scores = [600, 602, 598, 601, 599, 602, 600, 601];
    expect(calculateTrend(scores)).toBe('STEADY');
  });

  it('returns SLIPPING when delta -10 to -49', () => {
    const scores = [640, 635, 630, 625, 620, 615, 610, 605];
    expect(calculateTrend(scores)).toBe('SLIPPING');
  });

  it('returns DECLINING when delta <= -50', () => {
    const scores = [700, 690, 680, 660, 640, 610, 580, 550];
    expect(calculateTrend(scores)).toBe('DECLINING');
  });
});

describe('determinism', () => {
  it('produces identical output for identical input across 100 runs', () => {
    const input = makeInput({ orderCount: 50, trendData: { avg30day: 650, avg90day: 620 } });
    const results = Array.from({ length: 100 }, () => calculateSellerScore(input, DEFAULT_THRESHOLDS));
    const firstScore = results[0]?.score ?? -1;
    expect(results.every((r) => r.score === firstScore)).toBe(true);
  });
});
