import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

import {
  computePerformanceBand,
  getTrustBadge,
  type SellerMetrics,
} from '../performance-band';

describe('computePerformanceBand', () => {
  const perfectMetrics: SellerMetrics = {
    onTimeShippingPct: 100,
    inadRate: 0,
    reviewAverage: 5.0,
    responseTimeHours: 0.5,
    returnRate: 0,
    cancelRate: 0,
    totalOrders: 50,
  };

  it('returns POWER_SELLER for perfect metrics', async () => {
    const result = await computePerformanceBand(perfectMetrics);

    expect(result.band).toBe('POWER_SELLER');
    expect(result.score).toBeGreaterThanOrEqual(900);
  });

  it('marks new sellers with < 10 orders', async () => {
    const metrics: SellerMetrics = {
      ...perfectMetrics,
      totalOrders: 5,
    };

    const result = await computePerformanceBand(metrics);

    expect(result.isNew).toBe(true);
  });

  it('returns EMERGING for poor metrics', async () => {
    const poorMetrics: SellerMetrics = {
      onTimeShippingPct: 70,    // Below 80% threshold
      inadRate: 0.12,           // Above 10% threshold
      reviewAverage: 2.5,       // Low
      responseTimeHours: 80,    // Above 72h threshold
      returnRate: 0.25,         // Above 20% threshold
      cancelRate: 0.18,         // Above 15% threshold
      totalOrders: 50,
    };

    const result = await computePerformanceBand(poorMetrics);

    expect(result.band).toBe('EMERGING');
    expect(result.score).toBeLessThan(550);
  });

  it('returns ESTABLISHED for average metrics', async () => {
    const averageMetrics: SellerMetrics = {
      onTimeShippingPct: 92,
      inadRate: 0.03,
      reviewAverage: 4.0,
      responseTimeHours: 24,
      returnRate: 0.08,
      cancelRate: 0.06,
      totalOrders: 50,
    };

    const result = await computePerformanceBand(averageMetrics);

    expect(result.band).toBe('ESTABLISHED');
    expect(result.score).toBeGreaterThanOrEqual(550);
    expect(result.score).toBeLessThan(750);
  });

  it('returns TOP_RATED for good metrics', async () => {
    const goodMetrics: SellerMetrics = {
      onTimeShippingPct: 96,
      inadRate: 0.01,
      reviewAverage: 4.7,
      responseTimeHours: 4,
      returnRate: 0.02,
      cancelRate: 0.01,
      totalOrders: 50,
    };

    const result = await computePerformanceBand(goodMetrics);

    expect(result.band).toBe('TOP_RATED');
    expect(result.score).toBeGreaterThanOrEqual(750);
  });

  it('applies positive trend modifier when improving', async () => {
    const result = await computePerformanceBand(perfectMetrics, 800); // Previous score was lower

    expect(result.trendModifier).toBeGreaterThan(0);
  });

  it('applies negative trend modifier when declining', async () => {
    const averageMetrics: SellerMetrics = {
      ...perfectMetrics,
      onTimeShippingPct: 90,
      reviewAverage: 4.0,
    };

    const result = await computePerformanceBand(averageMetrics, 950); // Previous score was higher

    expect(result.trendModifier).toBeLessThan(0);
  });

  it('handles null review average gracefully', async () => {
    const metrics: SellerMetrics = {
      ...perfectMetrics,
      reviewAverage: null,
    };

    const result = await computePerformanceBand(metrics);

    expect(result.metrics.reviewScore).toBe(500); // Default for no reviews
  });

  it('handles null response time gracefully', async () => {
    const metrics: SellerMetrics = {
      ...perfectMetrics,
      responseTimeHours: null,
    };

    const result = await computePerformanceBand(metrics);

    expect(result.metrics.responseTimeScore).toBe(700); // Default for no data
  });
});

describe('getTrustBadge', () => {
  it('returns "Power Seller" for POWER_SELLER band', () => {
    expect(getTrustBadge('POWER_SELLER')).toBe('Power Seller');
  });

  it('returns "Top Rated Seller" for TOP_RATED band', () => {
    expect(getTrustBadge('TOP_RATED')).toBe('Top Rated Seller');
  });

  it('returns null for ESTABLISHED band', () => {
    expect(getTrustBadge('ESTABLISHED')).toBeNull();
  });

  it('returns null for EMERGING band', () => {
    expect(getTrustBadge('EMERGING')).toBeNull();
  });
});
