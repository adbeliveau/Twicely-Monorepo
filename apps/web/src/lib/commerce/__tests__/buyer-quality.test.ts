import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

import {
  computeBuyerQuality,
  getBuyerQualityDescription,
  shouldShowBuyerWarning,
  type BuyerMetrics,
} from '../buyer-quality';

describe('computeBuyerQuality', () => {
  it('returns GREEN for buyer with no issues', async () => {
    const metrics: BuyerMetrics = {
      totalOrders90d: 20,
      returns90d: 0,
      cancellations90d: 0,
      disputes90d: 0,
    };

    const result = await computeBuyerQuality(metrics);

    expect(result.tier).toBe('GREEN');
    expect(result.visible).toBe(true);
    expect(result.rates.returnRate).toBe(0);
    expect(result.rates.cancelRate).toBe(0);
  });

  it('returns GREEN with visible=false for buyer with < 5 orders', async () => {
    const metrics: BuyerMetrics = {
      totalOrders90d: 4,
      returns90d: 0,
      cancellations90d: 0,
      disputes90d: 0,
    };

    const result = await computeBuyerQuality(metrics);

    expect(result.tier).toBe('GREEN');
    expect(result.visible).toBe(false);
  });

  it('returns GREEN for buyer with low return rate', async () => {
    const metrics: BuyerMetrics = {
      totalOrders90d: 100,
      returns90d: 4,      // 4% return rate
      cancellations90d: 5, // 5% cancel rate
      disputes90d: 0,
    };

    const result = await computeBuyerQuality(metrics);

    expect(result.tier).toBe('GREEN');
    expect(result.rates.returnRate).toBe(0.04);
  });

  it('returns YELLOW for buyer with 5-15% return rate', async () => {
    const metrics: BuyerMetrics = {
      totalOrders90d: 100,
      returns90d: 10,     // 10% return rate
      cancellations90d: 5,
      disputes90d: 0,
    };

    const result = await computeBuyerQuality(metrics);

    expect(result.tier).toBe('YELLOW');
    expect(result.flags.highReturnRate).toBe(true);
  });

  it('returns YELLOW for buyer with 10-25% cancel rate', async () => {
    const metrics: BuyerMetrics = {
      totalOrders90d: 100,
      returns90d: 2,
      cancellations90d: 15, // 15% cancel rate
      disputes90d: 0,
    };

    const result = await computeBuyerQuality(metrics);

    expect(result.tier).toBe('YELLOW');
    expect(result.flags.highCancelRate).toBe(true);
  });

  it('returns YELLOW for buyer with exactly 1 dispute', async () => {
    const metrics: BuyerMetrics = {
      totalOrders90d: 100,
      returns90d: 2,
      cancellations90d: 2,
      disputes90d: 1,
    };

    const result = await computeBuyerQuality(metrics);

    expect(result.tier).toBe('YELLOW');
    expect(result.flags.hasDisputes).toBe(true);
  });

  it('returns RED for buyer with >15% return rate', async () => {
    const metrics: BuyerMetrics = {
      totalOrders90d: 100,
      returns90d: 20,     // 20% return rate
      cancellations90d: 0,
      disputes90d: 0,
    };

    const result = await computeBuyerQuality(metrics);

    expect(result.tier).toBe('RED');
    expect(result.flags.highReturnRate).toBe(true);
  });

  it('returns RED for buyer with >25% cancel rate', async () => {
    const metrics: BuyerMetrics = {
      totalOrders90d: 100,
      returns90d: 0,
      cancellations90d: 30, // 30% cancel rate
      disputes90d: 0,
    };

    const result = await computeBuyerQuality(metrics);

    expect(result.tier).toBe('RED');
    expect(result.flags.highCancelRate).toBe(true);
  });

  it('returns RED for buyer with 2+ disputes', async () => {
    const metrics: BuyerMetrics = {
      totalOrders90d: 100,
      returns90d: 2,
      cancellations90d: 2,
      disputes90d: 2,
    };

    const result = await computeBuyerQuality(metrics);

    expect(result.tier).toBe('RED');
    expect(result.flags.hasDisputes).toBe(true);
  });

  it('returns GREEN with visible=false for buyer with few orders (benefit of doubt)', async () => {
    const metrics: BuyerMetrics = {
      totalOrders90d: 2,
      returns90d: 1,  // Would be 50% rate with more orders
      cancellations90d: 0,
      disputes90d: 0,
    };

    const result = await computeBuyerQuality(metrics);

    // Rate calculation requires minimum 3 orders, visibility requires 5
    expect(result.tier).toBe('GREEN');
    expect(result.visible).toBe(false);
    expect(result.rates.returnRate).toBe(0);
  });
});

describe('getBuyerQualityDescription', () => {
  it('returns correct descriptions', () => {
    expect(getBuyerQualityDescription('GREEN')).toBe('Good standing');
    expect(getBuyerQualityDescription('YELLOW')).toBe('Elevated risk');
    expect(getBuyerQualityDescription('RED')).toBe('High risk');
  });
});

describe('shouldShowBuyerWarning', () => {
  it('returns false for GREEN tier', () => {
    expect(shouldShowBuyerWarning('GREEN')).toBe(false);
  });

  it('returns true for YELLOW tier', () => {
    expect(shouldShowBuyerWarning('YELLOW')).toBe(true);
  });

  it('returns true for RED tier', () => {
    expect(shouldShowBuyerWarning('RED')).toBe(true);
  });
});
