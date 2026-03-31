import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hasQuota,
  recordDispatch,
  resetQuota,
  resetAllQuotas,
  getMaxJobsPerSellerPerMinute,
} from '../fairness-quota';

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(10),
}));

describe('fairness-quota', () => {
  beforeEach(() => {
    resetAllQuotas();
  });

  it('hasQuota returns true for new seller', () => {
    expect(hasQuota('seller-1', 10)).toBe(true);
  });

  it('hasQuota returns true when below limit', () => {
    recordDispatch('seller-1');
    recordDispatch('seller-1');
    expect(hasQuota('seller-1', 10)).toBe(true);
  });

  it('hasQuota returns false when at limit', () => {
    for (let i = 0; i < 5; i++) {
      recordDispatch('seller-1');
    }
    expect(hasQuota('seller-1', 5)).toBe(false);
  });

  it('hasQuota returns true after window resets', () => {
    for (let i = 0; i < 5; i++) {
      recordDispatch('seller-1');
    }
    expect(hasQuota('seller-1', 5)).toBe(false);

    // Advance time past the 1-minute window
    const originalNow = Date.now;
    Date.now = () => originalNow() + 61_000;
    expect(hasQuota('seller-1', 5)).toBe(true);
    Date.now = originalNow;
  });

  it('recordDispatch increments counter', () => {
    recordDispatch('seller-1');
    recordDispatch('seller-1');
    recordDispatch('seller-1');
    // 3 dispatched, limit is 3 → exhausted
    expect(hasQuota('seller-1', 3)).toBe(false);
  });

  it('recordDispatch resets counter when new window starts', () => {
    recordDispatch('seller-1');
    recordDispatch('seller-1');

    const originalNow = Date.now;
    Date.now = () => originalNow() + 61_000;
    recordDispatch('seller-1');
    // Should be 1 in the new window
    expect(hasQuota('seller-1', 2)).toBe(true);
    Date.now = originalNow;
  });

  it('resetQuota clears seller state', () => {
    for (let i = 0; i < 10; i++) {
      recordDispatch('seller-1');
    }
    expect(hasQuota('seller-1', 10)).toBe(false);
    resetQuota('seller-1');
    expect(hasQuota('seller-1', 10)).toBe(true);
  });

  it('getMaxJobsPerSellerPerMinute returns DB value', async () => {
    const result = await getMaxJobsPerSellerPerMinute();
    expect(result).toBe(10);
  });

  it('getMaxJobsPerSellerPerMinute returns default 10 when setting is invalid', async () => {
    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');
    (getPlatformSetting as ReturnType<typeof vi.fn>).mockResolvedValueOnce(-5);
    resetAllQuotas(); // clear cache
    const result = await getMaxJobsPerSellerPerMinute();
    expect(result).toBe(10);
  });
});
