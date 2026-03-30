import { describe, it, expect } from 'vitest';
import { AFFILIATE_TRIAL_SETTINGS } from '../seed-affiliate-settings';

describe('affiliate and trial platform settings seed', () => {
  it('exports exactly 47 settings', () => {
    expect(AFFILIATE_TRIAL_SETTINGS).toHaveLength(47);
  });

  it('all keys are unique', () => {
    const keys = AFFILIATE_TRIAL_SETTINGS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('all keys follow dot-notation pattern', () => {
    for (const s of AFFILIATE_TRIAL_SETTINGS) {
      expect(s.key).toMatch(/^[a-z]+\.[a-zA-Z.]+$/);
    }
  });

  it('no setting has an empty label', () => {
    for (const s of AFFILIATE_TRIAL_SETTINGS) {
      expect(s.description.length, `empty description for ${s.key}`).toBeGreaterThan(0);
    }
  });

  it('all settings have valid types', () => {
    const validTypes = ['number', 'string', 'boolean', 'cents', 'bps', 'array'];
    for (const s of AFFILIATE_TRIAL_SETTINGS) {
      expect(validTypes, `invalid type '${s.type}' for ${s.key}`).toContain(s.type);
    }
  });

  describe('affiliate.* settings (33 keys)', () => {
    const affiliateSettings = AFFILIATE_TRIAL_SETTINGS.filter((s) => s.key.startsWith('affiliate.'));

    it('has exactly 35 affiliate settings', () => {
      expect(affiliateSettings).toHaveLength(35);
    });

    it('affiliate.enabled is boolean true', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.enabled')!;
      expect(s.type).toBe('boolean');
      expect(s.value).toBe(true);
    });

    it('affiliate.community.commissionRateBps is bps 1500', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.community.commissionRateBps')!;
      expect(s.type).toBe('bps');
      expect(s.value).toBe(1500);
    });

    it('affiliate.influencer.defaultCommissionRateBps is bps 2500', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.influencer.defaultCommissionRateBps')!;
      expect(s.type).toBe('bps');
      expect(s.value).toBe(2500);
    });

    it('affiliate.minPayoutCents is cents 2500', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.minPayoutCents')!;
      expect(s.type).toBe('cents');
      expect(s.value).toBe(2500);
    });

    it('affiliate.holdDays is number 30', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.holdDays')!;
      expect(s.type).toBe('number');
      expect(s.value).toBe(30);
    });

    it('affiliate.maxPromoDiscountBps is bps 2000', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.maxPromoDiscountBps')!;
      expect(s.type).toBe('bps');
      expect(s.value).toBe(2000);
    });

    it('affiliate.maxInfluencerDiscountBps is bps 5000', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.maxInfluencerDiscountBps')!;
      expect(s.type).toBe('bps');
      expect(s.value).toBe(5000);
    });

    it('affiliate.listingLinkEnabled is boolean true', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.listingLinkEnabled')!;
      expect(s.type).toBe('boolean');
      expect(s.value).toBe(true);
    });

    it('affiliate.listingCommissionBps is bps 300', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.listingCommissionBps')!;
      expect(s.type).toBe('bps');
      expect(s.value).toBe(300);
    });

    it('affiliate.listingCommissionMinBps is bps 200', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.listingCommissionMinBps')!;
      expect(s.type).toBe('bps');
      expect(s.value).toBe(200);
    });

    it('affiliate.listingCommissionMaxBps is bps 1000', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.listingCommissionMaxBps')!;
      expect(s.type).toBe('bps');
      expect(s.value).toBe(1000);
    });

    it('affiliate.listingAttributionWindowDays is number 7', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.listingAttributionWindowDays')!;
      expect(s.type).toBe('number');
      expect(s.value).toBe(7);
    });

    it('affiliate.sellerOptInDefault is boolean true', () => {
      const s = affiliateSettings.find((s) => s.key === 'affiliate.sellerOptInDefault')!;
      expect(s.type).toBe('boolean');
      expect(s.value).toBe(true);
    });

    it('all affiliate settings have category affiliate', () => {
      for (const s of affiliateSettings) {
        expect(s.category).toBe('affiliate');
      }
    });
  });

  describe('trials.* settings (12 keys)', () => {
    const trialSettings = AFFILIATE_TRIAL_SETTINGS.filter((s) => s.key.startsWith('trials.'));

    it('has exactly 12 trial settings', () => {
      expect(trialSettings).toHaveLength(12);
    });

    it('trials.lister.enabled is boolean true', () => {
      const s = trialSettings.find((s) => s.key === 'trials.lister.enabled')!;
      expect(s.type).toBe('boolean');
      expect(s.value).toBe(true);
    });

    it('trials.lister.durationDays is number 14', () => {
      const s = trialSettings.find((s) => s.key === 'trials.lister.durationDays')!;
      expect(s.type).toBe('number');
      expect(s.value).toBe(14);
    });

    it('trials.lister.tier is string LITE', () => {
      const s = trialSettings.find((s) => s.key === 'trials.lister.tier')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('LITE');
    });

    it('trials.store.tier is string STARTER', () => {
      const s = trialSettings.find((s) => s.key === 'trials.store.tier')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('STARTER');
    });

    it('trials.store.durationDays is number 7', () => {
      const s = trialSettings.find((s) => s.key === 'trials.store.durationDays')!;
      expect(s.type).toBe('number');
      expect(s.value).toBe(7);
    });

    it('trials.finance.tier is string PRO', () => {
      const s = trialSettings.find((s) => s.key === 'trials.finance.tier')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('PRO');
    });

    it('trials.maxExtensionDays is number 14', () => {
      const s = trialSettings.find((s) => s.key === 'trials.maxExtensionDays')!;
      expect(s.type).toBe('number');
      expect(s.value).toBe(14);
    });

    it('all trial settings have category trials', () => {
      for (const s of trialSettings) {
        expect(s.category).toBe('trials');
      }
    });
  });
});
