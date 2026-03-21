import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  effectiveQuota,
  getDefaultWeights,
  resetTierWeightCache,
  loadTierWeights,
} from '../tier-weight';

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: number) => {
    return Promise.resolve(fallback);
  }),
}));

describe('tier-weight', () => {
  beforeEach(() => {
    resetTierWeightCache();
  });

  it('effectiveQuota returns correct value for each tier', () => {
    const defaults = getDefaultWeights();
    expect(effectiveQuota(10, 'NONE')).toBe(Math.floor(10 * defaults.NONE)); // 5
    expect(effectiveQuota(10, 'FREE')).toBe(Math.floor(10 * defaults.FREE)); // 10
    expect(effectiveQuota(10, 'LITE')).toBe(Math.floor(10 * defaults.LITE)); // 15
    expect(effectiveQuota(10, 'PRO')).toBe(Math.floor(10 * defaults.PRO));   // 30
  });

  it('effectiveQuota returns minimum 1 even for very low base × weight', () => {
    expect(effectiveQuota(1, 'NONE')).toBe(1); // 1 * 0.5 = 0.5, floors to 0, clamped to 1
  });

  it('effectiveQuota floors to integer', () => {
    // 7 * 1.5 = 10.5 → should floor to 10
    expect(effectiveQuota(7, 'LITE')).toBe(10);
  });

  it('NONE tier gets less quota than FREE', () => {
    expect(effectiveQuota(10, 'NONE')).toBeLessThan(effectiveQuota(10, 'FREE'));
  });

  it('PRO tier gets more quota than FREE', () => {
    expect(effectiveQuota(10, 'PRO')).toBeGreaterThan(effectiveQuota(10, 'FREE'));
  });

  it('PRO tier gets most quota', () => {
    const base = 10;
    const none = effectiveQuota(base, 'NONE');
    const free = effectiveQuota(base, 'FREE');
    const lite = effectiveQuota(base, 'LITE');
    const pro = effectiveQuota(base, 'PRO');
    expect(pro).toBeGreaterThan(lite);
    expect(lite).toBeGreaterThan(free);
    expect(free).toBeGreaterThan(none);
  });

  it('reads from platform settings when available', async () => {
    const weights = await loadTierWeights();
    expect(weights.FREE).toBe(1.0);
    expect(weights.PRO).toBe(3.0);
  });

  it('falls back to hardcoded values when setting is missing', async () => {
    const { getPlatformSetting } = await import('@/lib/queries/platform-settings');
    (getPlatformSetting as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    resetTierWeightCache();
    const weights = await loadTierWeights();
    // Undefined isn't a valid number, so falls back to defaults
    const defaults = getDefaultWeights();
    expect(weights.NONE).toBe(defaults.NONE);
    expect(weights.PRO).toBe(defaults.PRO);
  });
});
