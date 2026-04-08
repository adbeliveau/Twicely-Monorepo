import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock platform_settings to return the default values supplied as fallbacks.
// This decouples the unit tests from a real DB connection. The tests now
// validate the asserted business logic against the seed defaults.
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(async <T>(_key: string, fallback: T): Promise<T> => fallback),
}));

import {
  resolveBundleComponents,
  getBundleSavingsCents,
  BUNDLE_COMPONENTS,
} from '../bundle-resolution';
import {
  compareBundleTiers,
  classifySubscriptionChange,
} from '../subscription-engine';
import { resetSubscriptionPricingCache } from '../price-map';

// Reset the in-process pricing cache before each test so the mock takes effect freshly
beforeEach(() => {
  resetSubscriptionPricingCache();
});

// ─── resolveBundleComponents + BUNDLE_COMPONENTS ─────────────────────────────

describe('D3-S5: BUNDLE_COMPONENTS mapping', () => {
  it('maps NONE to no store, no lister, FREE finance, no automation', () => {
    expect(BUNDLE_COMPONENTS.NONE).toEqual({
      storeTier: 'NONE', listerTier: 'NONE', financeTier: 'FREE', hasAutomation: false,
    });
  });

  it('maps STARTER to Store STARTER + Finance PRO (no lister, no automation)', () => {
    expect(BUNDLE_COMPONENTS.STARTER).toEqual({
      storeTier: 'STARTER', listerTier: 'NONE', financeTier: 'PRO', hasAutomation: false,
    });
  });

  it('maps PRO to Store PRO + Lister PRO + Finance PRO (no automation)', () => {
    expect(BUNDLE_COMPONENTS.PRO).toEqual({
      storeTier: 'PRO', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: false,
    });
  });

  it('maps POWER to Store POWER + Lister PRO + Finance PRO + Automation', () => {
    expect(BUNDLE_COMPONENTS.POWER).toEqual({
      storeTier: 'POWER', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: true,
    });
  });

  it('resolveBundleComponents returns same as BUNDLE_COMPONENTS for each tier', () => {
    (['NONE', 'STARTER', 'PRO', 'POWER'] as const).forEach((tier) => {
      expect(resolveBundleComponents(tier)).toEqual(BUNDLE_COMPONENTS[tier]);
    });
  });
});

// ─── getBundleSavingsCents ───────────────────────────────────────────────────

describe('D3-S5: getBundleSavingsCents', () => {
  it('returns 0 for NONE tier', async () => {
    expect(await getBundleSavingsCents('NONE', 'monthly')).toBe(0);
  });

  it('returns positive savings for STARTER monthly', async () => {
    expect(await getBundleSavingsCents('STARTER', 'monthly')).toBeGreaterThan(0);
  });

  it('returns positive savings for PRO monthly', async () => {
    expect(await getBundleSavingsCents('PRO', 'monthly')).toBeGreaterThan(0);
  });

  it('returns positive savings for POWER annual', async () => {
    expect(await getBundleSavingsCents('POWER', 'annual')).toBeGreaterThan(0);
  });
});

// ─── compareBundleTiers ──────────────────────────────────────────────────────

describe('D3-S5: compareBundleTiers', () => {
  it('orders STARTER < PRO < POWER', () => {
    expect(compareBundleTiers('STARTER', 'PRO')).toBeLessThan(0);
    expect(compareBundleTiers('PRO', 'POWER')).toBeLessThan(0);
    expect(compareBundleTiers('STARTER', 'POWER')).toBeLessThan(0);
  });

  it('returns 0 for same tier', () => {
    expect(compareBundleTiers('PRO', 'PRO')).toBe(0);
  });

  it('returns positive when a > b', () => {
    expect(compareBundleTiers('POWER', 'STARTER')).toBeGreaterThan(0);
  });
});

// ─── classifySubscriptionChange for bundle ───────────────────────────────────

describe('D3-S5: classifySubscriptionChange — bundle', () => {
  it('classifies STARTER → PRO as UPGRADE', () => {
    expect(classifySubscriptionChange({
      product: 'bundle', currentTier: 'STARTER', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly',
    })).toBe('UPGRADE');
  });

  it('classifies POWER → STARTER as DOWNGRADE', () => {
    expect(classifySubscriptionChange({
      product: 'bundle', currentTier: 'POWER', currentInterval: 'monthly',
      targetTier: 'STARTER', targetInterval: 'monthly',
    })).toBe('DOWNGRADE');
  });

  it('classifies same tier same interval as NO_CHANGE', () => {
    expect(classifySubscriptionChange({
      product: 'bundle', currentTier: 'PRO', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly',
    })).toBe('NO_CHANGE');
  });

  it('classifies monthly → annual same tier as INTERVAL_UPGRADE', () => {
    expect(classifySubscriptionChange({
      product: 'bundle', currentTier: 'PRO', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'annual',
    })).toBe('INTERVAL_UPGRADE');
  });
});
