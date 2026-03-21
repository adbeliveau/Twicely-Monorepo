import { describe, it, expect } from 'vitest';
import {
  hasStoreTier,
  canUseFeature,
  getNextTierName,
  getMinTierForFeature,
} from '../tier-gates';

describe('tier-gates', () => {
  describe('hasStoreTier', () => {
    it('returns true when tiers are equal - NONE', () => {
      expect(hasStoreTier('NONE', 'NONE')).toBe(true);
    });

    it('returns true when current tier is higher - STARTER >= NONE', () => {
      expect(hasStoreTier('STARTER', 'NONE')).toBe(true);
    });

    it('returns false when current tier is lower - NONE < STARTER', () => {
      expect(hasStoreTier('NONE', 'STARTER')).toBe(false);
    });

    it('returns true when PRO >= STARTER', () => {
      expect(hasStoreTier('PRO', 'STARTER')).toBe(true);
    });

    it('returns true when tiers are equal - POWER', () => {
      expect(hasStoreTier('POWER', 'POWER')).toBe(true);
    });

    it('returns true when ENTERPRISE >= POWER', () => {
      expect(hasStoreTier('ENTERPRISE', 'POWER')).toBe(true);
    });

    it('returns false when STARTER < PRO', () => {
      expect(hasStoreTier('STARTER', 'PRO')).toBe(false);
    });

    it('returns false when PRO < POWER', () => {
      expect(hasStoreTier('PRO', 'POWER')).toBe(false);
    });

    it('handles unknown tiers by treating as level 0', () => {
      expect(hasStoreTier('UNKNOWN', 'NONE')).toBe(true);
      expect(hasStoreTier('UNKNOWN', 'STARTER')).toBe(false);
    });
  });

  describe('canUseFeature', () => {
    it('returns false for announcement with NONE tier', () => {
      expect(canUseFeature('NONE', 'announcement')).toBe(false);
    });

    it('returns true for announcement with STARTER tier', () => {
      expect(canUseFeature('STARTER', 'announcement')).toBe(true);
    });

    it('returns true for announcement with PRO tier', () => {
      expect(canUseFeature('PRO', 'announcement')).toBe(true);
    });

    it('returns false for socialLinks with NONE tier', () => {
      expect(canUseFeature('NONE', 'socialLinks')).toBe(false);
    });

    it('returns true for socialLinks with STARTER tier', () => {
      expect(canUseFeature('STARTER', 'socialLinks')).toBe(true);
    });

    it('returns false for customCategories with STARTER tier', () => {
      expect(canUseFeature('STARTER', 'customCategories')).toBe(false);
    });

    it('returns true for customCategories with PRO tier', () => {
      expect(canUseFeature('PRO', 'customCategories')).toBe(true);
    });

    it('returns true for customCategories with POWER tier', () => {
      expect(canUseFeature('POWER', 'customCategories')).toBe(true);
    });

    it('returns false for puckEditor with PRO tier', () => {
      expect(canUseFeature('PRO', 'puckEditor')).toBe(false);
    });

    it('returns true for puckEditor with POWER tier', () => {
      expect(canUseFeature('POWER', 'puckEditor')).toBe(true);
    });

    it('returns true for puckEditor with ENTERPRISE tier', () => {
      expect(canUseFeature('ENTERPRISE', 'puckEditor')).toBe(true);
    });

    it('returns true for boosting with PRO tier', () => {
      expect(canUseFeature('PRO', 'boosting')).toBe(true);
    });

    it('returns false for boosting with STARTER tier', () => {
      expect(canUseFeature('STARTER', 'boosting')).toBe(false);
    });
  });

  describe('getNextTierName', () => {
    it('returns STARTER for NONE', () => {
      expect(getNextTierName('NONE')).toBe('STARTER');
    });

    it('returns PRO for STARTER', () => {
      expect(getNextTierName('STARTER')).toBe('PRO');
    });

    it('returns POWER for PRO', () => {
      expect(getNextTierName('PRO')).toBe('POWER');
    });

    it('returns ENTERPRISE for POWER', () => {
      expect(getNextTierName('POWER')).toBe('ENTERPRISE');
    });

    it('returns null for ENTERPRISE (max tier)', () => {
      expect(getNextTierName('ENTERPRISE')).toBe(null);
    });

    it('returns STARTER for unknown tier', () => {
      expect(getNextTierName('UNKNOWN')).toBe('STARTER');
    });
  });

  describe('getMinTierForFeature', () => {
    it('returns STARTER for announcement', () => {
      expect(getMinTierForFeature('announcement')).toBe('STARTER');
    });

    it('returns STARTER for socialLinks', () => {
      expect(getMinTierForFeature('socialLinks')).toBe('STARTER');
    });

    it('returns PRO for customCategories', () => {
      expect(getMinTierForFeature('customCategories')).toBe('PRO');
    });

    it('returns POWER for puckEditor', () => {
      expect(getMinTierForFeature('puckEditor')).toBe('POWER');
    });
  });
});
