import { describe, it, expect } from 'vitest';
import {
  STORE_TIER_ORDER,
  LISTER_TIER_ORDER,
  compareStoreTiers,
  compareListerTiers,
  isPaidStoreTier,
  isPaidListerTier,
  canSubscribeToStoreTier,
  getDowngradeWarnings,
  resolveBundleEntitlements,
} from '../subscription-engine';

describe('D3-S1: Subscription Engine', () => {
  describe('STORE_TIER_ORDER', () => {
    it('has correct order: NONE < STARTER < PRO < POWER < ENTERPRISE', () => {
      expect(STORE_TIER_ORDER).toEqual(['NONE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE']);
    });
  });

  describe('LISTER_TIER_ORDER', () => {
    it('has correct order: NONE < FREE < LITE < PRO', () => {
      expect(LISTER_TIER_ORDER).toEqual(['NONE', 'FREE', 'LITE', 'PRO']);
    });
  });

  describe('compareStoreTiers', () => {
    it('returns negative when a < b', () => {
      expect(compareStoreTiers('STARTER', 'PRO')).toBeLessThan(0);
    });

    it('returns zero when a === b', () => {
      expect(compareStoreTiers('PRO', 'PRO')).toBe(0);
    });

    it('returns positive when a > b', () => {
      expect(compareStoreTiers('POWER', 'STARTER')).toBeGreaterThan(0);
    });
  });

  describe('compareListerTiers', () => {
    it('returns negative when a < b', () => {
      expect(compareListerTiers('FREE', 'PRO')).toBeLessThan(0);
    });

    it('returns zero when a === b', () => {
      expect(compareListerTiers('LITE', 'LITE')).toBe(0);
    });

    it('returns positive when a > b', () => {
      expect(compareListerTiers('PRO', 'NONE')).toBeGreaterThan(0);
    });
  });

  describe('isPaidStoreTier', () => {
    it('returns false for NONE', () => {
      expect(isPaidStoreTier('NONE')).toBe(false);
    });

    it('returns true for STARTER', () => {
      expect(isPaidStoreTier('STARTER')).toBe(true);
    });

    it('returns true for PRO', () => {
      expect(isPaidStoreTier('PRO')).toBe(true);
    });

    it('returns false for ENTERPRISE (custom pricing, not standard Stripe)', () => {
      expect(isPaidStoreTier('ENTERPRISE')).toBe(false);
    });
  });

  describe('isPaidListerTier', () => {
    it('returns false for NONE', () => {
      expect(isPaidListerTier('NONE')).toBe(false);
    });

    it('returns false for FREE', () => {
      expect(isPaidListerTier('FREE')).toBe(false);
    });

    it('returns true for LITE', () => {
      expect(isPaidListerTier('LITE')).toBe(true);
    });

    it('returns true for PRO', () => {
      expect(isPaidListerTier('PRO')).toBe(true);
    });
  });

  describe('canSubscribeToStoreTier', () => {
    const fullEligibility = {
      isBusinessSeller: true,
      hasStripeConnect: true,
      hasIdentityVerified: true,
    };

    it('allows NONE for anyone', () => {
      const result = canSubscribeToStoreTier('NONE', {
        isBusinessSeller: false,
        hasStripeConnect: false,
        hasIdentityVerified: false,
      });
      expect(result.allowed).toBe(true);
    });

    it('requires business seller for paid tiers', () => {
      const result = canSubscribeToStoreTier('PRO', {
        isBusinessSeller: false,
        hasStripeConnect: true,
        hasIdentityVerified: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('business seller account');
    });

    it('requires Stripe Connect for paid tiers', () => {
      const result = canSubscribeToStoreTier('PRO', {
        isBusinessSeller: true,
        hasStripeConnect: false,
        hasIdentityVerified: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Stripe Connect');
    });

    it('requires identity verification for paid tiers', () => {
      const result = canSubscribeToStoreTier('PRO', {
        isBusinessSeller: true,
        hasStripeConnect: true,
        hasIdentityVerified: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Identity verification');
    });

    it('allows paid tiers with full eligibility', () => {
      expect(canSubscribeToStoreTier('STARTER', fullEligibility).allowed).toBe(true);
      expect(canSubscribeToStoreTier('PRO', fullEligibility).allowed).toBe(true);
      expect(canSubscribeToStoreTier('POWER', fullEligibility).allowed).toBe(true);
    });

    it('rejects ENTERPRISE tier (must contact sales)', () => {
      const result = canSubscribeToStoreTier('ENTERPRISE', fullEligibility);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('sales');
    });
  });

  describe('getDowngradeWarnings', () => {
    it('returns empty array for upgrade', () => {
      const warnings = getDowngradeWarnings({
        currentStoreTier: 'STARTER',
        targetStoreTier: 'PRO',
      });
      expect(warnings).toEqual([]);
    });

    it('returns empty array for same tier', () => {
      const warnings = getDowngradeWarnings({
        currentStoreTier: 'PRO',
        targetStoreTier: 'PRO',
      });
      expect(warnings).toEqual([]);
    });

    it('warns about active boosts when downgrading from PRO', () => {
      const warnings = getDowngradeWarnings({
        currentStoreTier: 'PRO',
        targetStoreTier: 'STARTER',
        activeBoostCount: 3,
      });
      expect(warnings).toHaveLength(1);
      const firstWarning = warnings[0];
      expect(firstWarning).toBeDefined();
      expect(firstWarning!.feature).toBe('Promoted Listings');
      expect(firstWarning!.severity).toBe('warning');
    });

    it('warns about custom storefront when downgrading from POWER', () => {
      const warnings = getDowngradeWarnings({
        currentStoreTier: 'POWER',
        targetStoreTier: 'PRO',
        hasCustomStorefront: true,
      });
      const storefrontWarning = warnings.find(w => w.feature === 'Custom Storefront');
      expect(storefrontWarning).toBeDefined();
      expect(storefrontWarning!.severity).toBe('critical');
    });

    it('warns about daily auto-payout when downgrading from POWER', () => {
      const warnings = getDowngradeWarnings({
        currentStoreTier: 'POWER',
        targetStoreTier: 'PRO',
      });
      const payoutWarning = warnings.find(w => w.feature === 'Daily Auto-Payout');
      expect(payoutWarning).toBeDefined();
      expect(payoutWarning?.severity).toBe('info');
    });

    it('returns all 3 warning types when downgrading POWER→STARTER with active features', () => {
      const warnings = getDowngradeWarnings({
        currentStoreTier: 'POWER',
        targetStoreTier: 'STARTER',
        activeBoostCount: 5,
        hasCustomStorefront: true,
      });
      // Should have: Promoted Listings (warning), Custom Storefront (critical), Daily Auto-Payout (info)
      expect(warnings.length).toBeGreaterThanOrEqual(3);
      const boostWarning = warnings.find(w => w.feature === 'Promoted Listings');
      const storefrontWarning = warnings.find(w => w.feature === 'Custom Storefront');
      const payoutWarning = warnings.find(w => w.feature === 'Daily Auto-Payout');
      expect(boostWarning).toBeDefined();
      expect(boostWarning!.severity).toBe('warning');
      expect(storefrontWarning).toBeDefined();
      expect(storefrontWarning!.severity).toBe('critical');
      expect(payoutWarning).toBeDefined();
      expect(payoutWarning!.severity).toBe('info');
    });
  });

  describe('resolveBundleEntitlements', () => {
    it('resolves STARTER bundle', () => {
      expect(resolveBundleEntitlements('STARTER')).toEqual({
        storeTier: 'STARTER',
        listerTier: null,
        hasFinancePro: true,
        hasAutomation: false,
      });
    });

    it('resolves PRO bundle', () => {
      expect(resolveBundleEntitlements('PRO')).toEqual({
        storeTier: 'PRO',
        listerTier: 'PRO',
        hasFinancePro: true,
        hasAutomation: false,
      });
    });

    it('resolves POWER bundle', () => {
      expect(resolveBundleEntitlements('POWER')).toEqual({
        storeTier: 'POWER',
        listerTier: 'PRO',
        hasFinancePro: true,
        hasAutomation: true,
      });
    });

    it('returns null for unknown bundle', () => {
      expect(resolveBundleEntitlements('UNKNOWN')).toBeNull();
    });
  });
});
