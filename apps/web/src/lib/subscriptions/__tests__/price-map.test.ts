import { describe, it, expect } from 'vitest';
import {
  STORE_PRICING,
  LISTER_PRICING,
  FINANCE_PRICING,
  AUTOMATION_PRICING,
  BUNDLE_PRICING,
  getPricing,
  getStripePriceId,
  resolveStripePriceId,
  formatTierPrice,
  getAnnualSavingsPercent,
} from '../price-map';

describe('D3-S1: Price Map', () => {
  describe('STORE_PRICING', () => {
    it('has STARTER, PRO, POWER tiers', () => {
      expect(Object.keys(STORE_PRICING)).toEqual(['STARTER', 'PRO', 'POWER']);
    });

    it('STARTER costs $12/mo monthly, $6.99/mo annual', () => {
      const starter = STORE_PRICING['STARTER'];
      expect(starter).toBeDefined();
      expect(starter!.monthlyCents).toBe(1200);
      expect(starter!.annualMonthlyCents).toBe(699);
    });

    it('PRO costs $39.99/mo monthly, $29.99/mo annual', () => {
      const pro = STORE_PRICING['PRO'];
      expect(pro).toBeDefined();
      expect(pro!.monthlyCents).toBe(3999);
      expect(pro!.annualMonthlyCents).toBe(2999);
    });

    it('POWER costs $79.99/mo monthly, $59.99/mo annual', () => {
      const power = STORE_PRICING['POWER'];
      expect(power).toBeDefined();
      expect(power!.monthlyCents).toBe(7999);
      expect(power!.annualMonthlyCents).toBe(5999);
    });
  });

  describe('LISTER_PRICING', () => {
    it('has LITE and PRO tiers', () => {
      expect(Object.keys(LISTER_PRICING)).toEqual(['LITE', 'PRO']);
    });

    it('LITE costs $13.99/mo monthly, $9.99/mo annual', () => {
      const lite = LISTER_PRICING['LITE'];
      expect(lite).toBeDefined();
      expect(lite!.monthlyCents).toBe(1399);
      expect(lite!.annualMonthlyCents).toBe(999);
    });
  });

  describe('FINANCE_PRICING', () => {
    it('has PRO tier only', () => {
      expect(Object.keys(FINANCE_PRICING)).toEqual(['PRO']);
    });

    it('PRO costs $14.99/mo monthly, $11.99/mo annual', () => {
      const pro = FINANCE_PRICING['PRO'];
      expect(pro).toBeDefined();
      expect(pro!.monthlyCents).toBe(1499);
      expect(pro!.annualMonthlyCents).toBe(1199);
    });
  });

  describe('AUTOMATION_PRICING', () => {
    it('costs $12.99/mo monthly, $9.99/mo annual', () => {
      expect(AUTOMATION_PRICING.monthlyCents).toBe(1299);
      expect(AUTOMATION_PRICING.annualMonthlyCents).toBe(999);
    });
  });

  describe('BUNDLE_PRICING', () => {
    it('has STARTER, PRO, POWER bundles', () => {
      expect(Object.keys(BUNDLE_PRICING)).toEqual(['STARTER', 'PRO', 'POWER']);
    });

    it('STARTER bundle includes storeTier STARTER and financeTier PRO', () => {
      const starter = BUNDLE_PRICING['STARTER'];
      expect(starter).toBeDefined();
      expect(starter!.includes).toEqual({
        storeTier: 'STARTER',
        financeTier: 'PRO',
      });
    });

    it('PRO bundle includes storeTier PRO, listerTier PRO, financeTier PRO', () => {
      const pro = BUNDLE_PRICING['PRO'];
      expect(pro).toBeDefined();
      expect(pro!.includes).toEqual({
        storeTier: 'PRO',
        listerTier: 'PRO',
        financeTier: 'PRO',
      });
    });

    it('POWER bundle includes all + automation', () => {
      const power = BUNDLE_PRICING['POWER'];
      expect(power).toBeDefined();
      expect(power!.includes).toEqual({
        storeTier: 'POWER',
        listerTier: 'PRO',
        financeTier: 'PRO',
        automation: true,
      });
    });
  });

  describe('getPricing', () => {
    it('returns STORE_PRICING.PRO for (store, PRO)', () => {
      expect(getPricing('store', 'PRO')).toBe(STORE_PRICING['PRO']);
    });

    it('returns LISTER_PRICING.LITE for (lister, LITE)', () => {
      expect(getPricing('lister', 'LITE')).toBe(LISTER_PRICING['LITE']);
    });

    it('returns FINANCE_PRICING.PRO for (finance, PRO)', () => {
      expect(getPricing('finance', 'PRO')).toBe(FINANCE_PRICING['PRO']);
    });

    it('returns AUTOMATION_PRICING for (automation, any)', () => {
      expect(getPricing('automation', 'DEFAULT')).toBe(AUTOMATION_PRICING);
    });

    it('returns BUNDLE_PRICING.POWER for (bundle, POWER)', () => {
      expect(getPricing('bundle', 'POWER')).toBe(BUNDLE_PRICING['POWER']);
    });

    it('returns null for unknown tier', () => {
      expect(getPricing('store', 'NONE')).toBeNull();
      expect(getPricing('store', 'ENTERPRISE')).toBeNull();
    });
  });

  describe('getStripePriceId', () => {
    it('returns monthly price ID for monthly interval', () => {
      expect(getStripePriceId('store', 'PRO', 'monthly')).toBe('price_store_pro_monthly');
    });

    it('returns annual price ID for annual interval', () => {
      expect(getStripePriceId('store', 'PRO', 'annual')).toBe('price_store_pro_annual');
    });

    it('returns null for free/none tiers', () => {
      expect(getStripePriceId('store', 'NONE', 'monthly')).toBeNull();
    });
  });

  describe('resolveStripePriceId', () => {
    it('resolves store monthly price ID', () => {
      expect(resolveStripePriceId('price_store_pro_monthly')).toEqual({
        product: 'store',
        tier: 'PRO',
        interval: 'monthly',
      });
    });

    it('resolves lister annual price ID', () => {
      expect(resolveStripePriceId('price_crosslister_lite_annual')).toEqual({
        product: 'lister',
        tier: 'LITE',
        interval: 'annual',
      });
    });

    it('resolves automation price ID', () => {
      expect(resolveStripePriceId('price_automation_monthly')).toEqual({
        product: 'automation',
        tier: 'DEFAULT',
        interval: 'monthly',
      });
    });

    it('resolves bundle price ID', () => {
      expect(resolveStripePriceId('price_bundle_power_annual')).toEqual({
        product: 'bundle',
        tier: 'POWER',
        interval: 'annual',
      });
    });

    it('returns null for unknown price ID', () => {
      expect(resolveStripePriceId('price_unknown_123')).toBeNull();
    });

    it('resolves finance monthly price ID', () => {
      expect(resolveStripePriceId('price_finance_pro_monthly')).toEqual({
        product: 'finance',
        tier: 'PRO',
        interval: 'monthly',
      });
    });

    it('resolves finance annual price ID', () => {
      expect(resolveStripePriceId('price_finance_pro_annual')).toEqual({
        product: 'finance',
        tier: 'PRO',
        interval: 'annual',
      });
    });
  });

  describe('formatTierPrice', () => {
    it('formats monthly price correctly', () => {
      expect(formatTierPrice('store', 'PRO', 'monthly')).toBe('$39.99/mo');
    });

    it('formats annual price correctly', () => {
      expect(formatTierPrice('store', 'PRO', 'annual')).toBe('$29.99/mo');
    });

    it('returns $0.00/mo for unknown tier', () => {
      expect(formatTierPrice('store', 'NONE', 'monthly')).toBe('$0.00/mo');
    });
  });

  describe('getAnnualSavingsPercent', () => {
    it('returns 25% savings for Store PRO', () => {
      // (3999 - 2999) / 3999 = 25%
      expect(getAnnualSavingsPercent('store', 'PRO')).toBe(25);
    });

    it('returns 42% savings for Store STARTER', () => {
      // (1200 - 699) / 1200 = 41.75% rounds to 42%
      expect(getAnnualSavingsPercent('store', 'STARTER')).toBe(42);
    });

    it('returns 0 for unknown tier', () => {
      expect(getAnnualSavingsPercent('store', 'NONE')).toBe(0);
    });
  });
});
