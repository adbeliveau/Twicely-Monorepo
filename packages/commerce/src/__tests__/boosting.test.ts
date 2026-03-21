import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPlatformSetting = vi.fn();
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

import {
  validateBoostRate,
  calculateBoostFee,
  isWithinAttributionWindow,
  calculatePromotedSlots,
  getBoostMinRate,
  getBoostMaxRate,
  getBoostAttributionDays,
  getBoostMaxPromotedPct,
} from '../boosting';

describe('D2.4: Boosting Engine', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Return fallback values by default (same as platform_settings defaults)
    mockGetPlatformSetting.mockImplementation(
      (_key: string, fallback: unknown) => Promise.resolve(fallback),
    );
  });

  describe('async getters', () => {
    it('getBoostMinRate returns 1 from default 100 bps', async () => {
      expect(await getBoostMinRate()).toBe(1);
      expect(mockGetPlatformSetting).toHaveBeenCalledWith('boost.minRateBps', 100);
    });

    it('getBoostMaxRate returns 8 from default 800 bps', async () => {
      expect(await getBoostMaxRate()).toBe(8);
      expect(mockGetPlatformSetting).toHaveBeenCalledWith('boost.maxRateBps', 800);
    });

    it('getBoostAttributionDays returns 7', async () => {
      expect(await getBoostAttributionDays()).toBe(7);
      expect(mockGetPlatformSetting).toHaveBeenCalledWith('boost.attributionDays', 7);
    });

    it('getBoostMaxPromotedPct returns 30', async () => {
      mockGetPlatformSetting.mockResolvedValueOnce(3000); // bps value from seed
      expect(await getBoostMaxPromotedPct()).toBe(30);
      expect(mockGetPlatformSetting).toHaveBeenCalledWith('boost.maxPromotedPercentBps', 3000);
    });

    it('getBoostMinRate converts custom bps to percentage', async () => {
      mockGetPlatformSetting.mockResolvedValue(200); // 2%
      expect(await getBoostMinRate()).toBe(2);
    });

    it('getBoostMaxRate converts custom bps to percentage', async () => {
      mockGetPlatformSetting.mockResolvedValue(1000); // 10%
      expect(await getBoostMaxRate()).toBe(10);
    });
  });

  describe('validateBoostRate', () => {
    it('returns valid for rate within range (5%)', async () => {
      const result = await validateBoostRate(5);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for minimum rate (1%)', async () => {
      const result = await validateBoostRate(1);
      expect(result.valid).toBe(true);
    });

    it('returns valid for maximum rate (8%)', async () => {
      const result = await validateBoostRate(8);
      expect(result.valid).toBe(true);
    });

    it('returns invalid for rate below minimum (0.5%)', async () => {
      const result = await validateBoostRate(0.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('returns invalid for rate above maximum (10%)', async () => {
      const result = await validateBoostRate(10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed');
    });

    it('returns invalid for NaN', async () => {
      const result = await validateBoostRate(NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid number');
    });

    it('returns invalid for Infinity', async () => {
      const result = await validateBoostRate(Infinity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid number');
    });

    it('respects custom min rate from platform_settings', async () => {
      mockGetPlatformSetting.mockImplementation(
        (key: string, fallback: unknown) => {
          if (key === 'boost.minRateBps') return Promise.resolve(200); // 2%
          return Promise.resolve(fallback);
        },
      );
      const result = await validateBoostRate(1.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 2%');
    });

    it('respects custom max rate from platform_settings', async () => {
      mockGetPlatformSetting.mockImplementation(
        (key: string, fallback: unknown) => {
          if (key === 'boost.maxRateBps') return Promise.resolve(500); // 5%
          return Promise.resolve(fallback);
        },
      );
      const result = await validateBoostRate(6);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed 5%');
    });
  });

  describe('calculateBoostFee', () => {
    it('calculates $5.00 fee for $100 sale at 5%', () => {
      const fee = calculateBoostFee(10000, 5);
      expect(fee).toBe(500);
    });

    it('returns 0 for $0 sale', () => {
      const fee = calculateBoostFee(0, 5);
      expect(fee).toBe(0);
    });

    it('returns 0 for negative sale price', () => {
      const fee = calculateBoostFee(-1000, 5);
      expect(fee).toBe(0);
    });

    it('calculates $0.50 for $49.99 sale at 1% (rounds)', () => {
      // 4999 * 0.01 = 49.99, rounds to 50 cents
      const fee = calculateBoostFee(4999, 1);
      expect(fee).toBe(50);
    });

    it('calculates $16.00 fee for $200 sale at 8%', () => {
      const fee = calculateBoostFee(20000, 8);
      expect(fee).toBe(1600);
    });

    it('handles fractional cents by rounding', () => {
      // 333 * 0.05 = 16.65, rounds to 17
      const fee = calculateBoostFee(333, 5);
      expect(fee).toBe(17);
    });
  });

  describe('isWithinAttributionWindow', () => {
    it('returns true for sale 3 days after boost start', async () => {
      const boostStart = new Date('2024-01-01T00:00:00Z');
      const saleDate = new Date('2024-01-04T00:00:00Z');
      expect(await isWithinAttributionWindow(boostStart, saleDate)).toBe(true);
    });

    it('returns true for sale 6 days 23 hours after boost start', async () => {
      const boostStart = new Date('2024-01-01T00:00:00Z');
      const saleDate = new Date('2024-01-07T23:00:00Z');
      expect(await isWithinAttributionWindow(boostStart, saleDate)).toBe(true);
    });

    it('returns false for sale exactly 7 days after boost start (at boundary)', async () => {
      const boostStart = new Date('2024-01-01T00:00:00Z');
      const saleDate = new Date('2024-01-08T00:00:00Z');
      expect(await isWithinAttributionWindow(boostStart, saleDate)).toBe(false);
    });

    it('returns false for sale before boost start', async () => {
      const boostStart = new Date('2024-01-05T00:00:00Z');
      const saleDate = new Date('2024-01-03T00:00:00Z');
      expect(await isWithinAttributionWindow(boostStart, saleDate)).toBe(false);
    });

    it('returns true for sale on same day as boost start', async () => {
      const boostStart = new Date('2024-01-01T10:00:00Z');
      const saleDate = new Date('2024-01-01T15:00:00Z');
      expect(await isWithinAttributionWindow(boostStart, saleDate)).toBe(true);
    });

    it('returns false for sale 8 days after boost start', async () => {
      const boostStart = new Date('2024-01-01T00:00:00Z');
      const saleDate = new Date('2024-01-09T00:00:00Z');
      expect(await isWithinAttributionWindow(boostStart, saleDate)).toBe(false);
    });

    it('respects custom attribution days from platform_settings', async () => {
      mockGetPlatformSetting.mockImplementation(
        (key: string, fallback: unknown) => {
          if (key === 'boost.attributionDays') return Promise.resolve(3);
          return Promise.resolve(fallback);
        },
      );
      const boostStart = new Date('2024-01-01T00:00:00Z');
      // 4 days later — outside 3-day window
      const saleDate = new Date('2024-01-05T00:00:00Z');
      expect(await isWithinAttributionWindow(boostStart, saleDate)).toBe(false);
    });
  });

  describe('calculatePromotedSlots', () => {
    it('returns 6 slots for 20 results (30%)', async () => {
      expect(await calculatePromotedSlots(20)).toBe(6);
    });

    it('returns 0 slots for 3 results (30% = 0.9, floors to 0)', async () => {
      expect(await calculatePromotedSlots(3)).toBe(0);
    });

    it('returns 0 slots for 0 results', async () => {
      expect(await calculatePromotedSlots(0)).toBe(0);
    });

    it('returns 0 slots for negative results', async () => {
      expect(await calculatePromotedSlots(-5)).toBe(0);
    });

    it('returns 30 slots for 100 results', async () => {
      expect(await calculatePromotedSlots(100)).toBe(30);
    });

    it('returns 1 slot for 4 results (30% = 1.2, floors to 1)', async () => {
      expect(await calculatePromotedSlots(4)).toBe(1);
    });

    it('respects custom max promoted pct from platform_settings', async () => {
      mockGetPlatformSetting.mockImplementation(
        (key: string, fallback: unknown) => {
          if (key === 'boost.maxPromotedPercentBps') return Promise.resolve(2000); // 2000 bps = 20%
          return Promise.resolve(fallback);
        },
      );
      // 20% of 100 = 20
      expect(await calculatePromotedSlots(100)).toBe(20);
    });
  });
});
