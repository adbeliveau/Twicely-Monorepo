import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock platform_settings to return the supplied fallback values.
// Decouples unit tests from a real DB connection.
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(async <T>(_key: string, fallback: T): Promise<T> => fallback),
}));

import {
  classifySubscriptionChange,
  getChangePreview,
  getBillingIntervalFromPriceId,
} from '../subscription-engine';
import { resetSubscriptionPricingCache } from '@twicely/subscriptions/price-map';

beforeEach(() => {
  resetSubscriptionPricingCache();
});

// ─── classifySubscriptionChange ─────────────────────────────────────────────

describe('D3-S4: classifySubscriptionChange', () => {
  // UPGRADE cases
  it('classifies STARTER → PRO as UPGRADE (store)', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'STARTER', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly',
    })).toBe('UPGRADE');
  });

  it('classifies PRO → POWER as UPGRADE (store)', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'PRO', currentInterval: 'monthly',
      targetTier: 'POWER', targetInterval: 'monthly',
    })).toBe('UPGRADE');
  });

  it('classifies FREE → LITE as UPGRADE (lister)', () => {
    expect(classifySubscriptionChange({
      product: 'lister', currentTier: 'FREE', currentInterval: 'monthly',
      targetTier: 'LITE', targetInterval: 'monthly',
    })).toBe('UPGRADE');
  });

  it('classifies LITE → PRO as UPGRADE (lister)', () => {
    expect(classifySubscriptionChange({
      product: 'lister', currentTier: 'LITE', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly',
    })).toBe('UPGRADE');
  });

  it('classifies FREE → PRO as UPGRADE (finance)', () => {
    expect(classifySubscriptionChange({
      product: 'finance', currentTier: 'FREE', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly',
    })).toBe('UPGRADE');
  });

  // DOWNGRADE cases
  it('classifies POWER → PRO as DOWNGRADE (store)', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'POWER', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly',
    })).toBe('DOWNGRADE');
  });

  it('classifies PRO → STARTER as DOWNGRADE (store)', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'PRO', currentInterval: 'monthly',
      targetTier: 'STARTER', targetInterval: 'monthly',
    })).toBe('DOWNGRADE');
  });

  it('classifies PRO → LITE as DOWNGRADE (lister)', () => {
    expect(classifySubscriptionChange({
      product: 'lister', currentTier: 'PRO', currentInterval: 'monthly',
      targetTier: 'LITE', targetInterval: 'monthly',
    })).toBe('DOWNGRADE');
  });

  // INTERVAL changes
  it('classifies monthly → annual (same tier) as INTERVAL_UPGRADE', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'PRO', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'annual',
    })).toBe('INTERVAL_UPGRADE');
  });

  it('classifies annual → monthly (same tier) as INTERVAL_DOWNGRADE', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'PRO', currentInterval: 'annual',
      targetTier: 'PRO', targetInterval: 'monthly',
    })).toBe('INTERVAL_DOWNGRADE');
  });

  // Combined changes — tier wins
  it('classifies PRO monthly → POWER annual as UPGRADE (tier wins)', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'PRO', currentInterval: 'monthly',
      targetTier: 'POWER', targetInterval: 'annual',
    })).toBe('UPGRADE');
  });

  it('classifies POWER annual → PRO monthly as DOWNGRADE (tier wins)', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'POWER', currentInterval: 'annual',
      targetTier: 'PRO', targetInterval: 'monthly',
    })).toBe('DOWNGRADE');
  });

  // Edge cases
  it('classifies same tier same interval as NO_CHANGE', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'PRO', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly',
    })).toBe('NO_CHANGE');
  });

  it('classifies any → ENTERPRISE as BLOCKED', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'PRO', currentInterval: 'monthly',
      targetTier: 'ENTERPRISE', targetInterval: 'monthly',
    })).toBe('BLOCKED');
  });

  it('classifies ENTERPRISE → any as BLOCKED', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'ENTERPRISE', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly',
    })).toBe('BLOCKED');
  });

  it('classifies any → NONE as BLOCKED (use cancel flow)', () => {
    expect(classifySubscriptionChange({
      product: 'store', currentTier: 'PRO', currentInterval: 'monthly',
      targetTier: 'NONE', targetInterval: 'monthly',
    })).toBe('BLOCKED');
  });
});

// ─── getChangePreview ───────────────────────────────────────────────────────

describe('D3-S4: getChangePreview', () => {
  const periodEnd = new Date('2026-04-01');

  it('returns immediate effectiveDate for UPGRADE', async () => {
    const preview = await getChangePreview({
      product: 'store', currentTier: 'STARTER', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly', currentPeriodEnd: periodEnd,
    });
    expect(preview.classification).toBe('UPGRADE');
    expect(preview.effectiveDate).toBe('immediate');
  });

  it('returns period end date for DOWNGRADE', async () => {
    const preview = await getChangePreview({
      product: 'store', currentTier: 'POWER', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly', currentPeriodEnd: periodEnd,
    });
    expect(preview.classification).toBe('DOWNGRADE');
    expect(preview.effectiveDate).toEqual(periodEnd);
  });

  it('has higher targetPriceCents than currentPriceCents for UPGRADE', async () => {
    const preview = await getChangePreview({
      product: 'store', currentTier: 'STARTER', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly', currentPeriodEnd: periodEnd,
    });
    expect(preview.targetPriceCents).toBeGreaterThan(preview.currentPriceCents);
  });

  it('has lower targetPriceCents than currentPriceCents for DOWNGRADE', async () => {
    const preview = await getChangePreview({
      product: 'store', currentTier: 'POWER', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'monthly', currentPeriodEnd: periodEnd,
    });
    expect(preview.targetPriceCents).toBeLessThan(preview.currentPriceCents);
  });

  it('includes downgrade warnings for store DOWNGRADE from POWER', async () => {
    const preview = await getChangePreview({
      product: 'store', currentTier: 'POWER', currentInterval: 'monthly',
      targetTier: 'STARTER', targetInterval: 'monthly', currentPeriodEnd: periodEnd,
    });
    expect(preview.classification).toBe('DOWNGRADE');
    // POWER→STARTER always generates Daily Auto-Payout warning
    expect(preview.warnings.length).toBeGreaterThanOrEqual(1);
    expect(preview.warnings.some((w: { feature: string }) => w.feature === 'Daily Auto-Payout')).toBe(true);
  });

  it('returns immediate effectiveDate for INTERVAL_UPGRADE', async () => {
    const preview = await getChangePreview({
      product: 'store', currentTier: 'PRO', currentInterval: 'monthly',
      targetTier: 'PRO', targetInterval: 'annual', currentPeriodEnd: periodEnd,
    });
    expect(preview.classification).toBe('INTERVAL_UPGRADE');
    expect(preview.effectiveDate).toBe('immediate');
  });

  it('returns period end for INTERVAL_DOWNGRADE', async () => {
    const preview = await getChangePreview({
      product: 'store', currentTier: 'PRO', currentInterval: 'annual',
      targetTier: 'PRO', targetInterval: 'monthly', currentPeriodEnd: periodEnd,
    });
    expect(preview.classification).toBe('INTERVAL_DOWNGRADE');
    expect(preview.effectiveDate).toEqual(periodEnd);
  });
});

// ─── getBillingIntervalFromPriceId ──────────────────────────────────────────

describe('D3-S4: getBillingIntervalFromPriceId', () => {
  it('returns monthly for monthly store price IDs', () => {
    expect(getBillingIntervalFromPriceId('price_store_pro_monthly')).toBe('monthly');
  });

  it('returns annual for annual store price IDs', () => {
    expect(getBillingIntervalFromPriceId('price_store_pro_annual')).toBe('annual');
  });

  it('returns null for unknown price ID', () => {
    expect(getBillingIntervalFromPriceId('price_unknown_xyz')).toBeNull();
  });
});
