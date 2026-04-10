/**
 * I14 Platform Settings Seed Tests
 * Validates the SEED_I14_SETTINGS array structure and values.
 */

import { describe, it, expect } from 'vitest';
import { SEED_I14_SETTINGS } from '../seed-i14-settings';

describe('SEED_I14_SETTINGS', () => {
  it('exports exactly 26 settings', () => {
    expect(SEED_I14_SETTINGS).toHaveLength(26);
  });

  it('all keys are unique', () => {
    const keys = SEED_I14_SETTINGS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('all keys follow dot-notation pattern', () => {
    for (const s of SEED_I14_SETTINGS) {
      expect(s.key).toMatch(/^[a-z]+[\w-]*\.[a-zA-Z][\w.-]*$/);
    }
  });

  it('all settings have non-empty descriptions', () => {
    for (const s of SEED_I14_SETTINGS) {
      expect(s.description.length, `empty description for ${s.key}`).toBeGreaterThan(0);
    }
  });

  it('all settings have valid types', () => {
    const validTypes = ['number', 'string', 'boolean', 'cents', 'bps', 'array'];
    for (const s of SEED_I14_SETTINGS) {
      expect(validTypes, `invalid type '${s.type}' for ${s.key}`).toContain(s.type);
    }
  });

  describe('i18n.* settings (3 keys)', () => {
    const i18nSettings = SEED_I14_SETTINGS.filter((s) => s.key.startsWith('i18n.'));

    it('has exactly 3 i18n settings', () => {
      expect(i18nSettings).toHaveLength(3);
    });

    it('i18n.defaultLocale is string en-US', () => {
      const s = i18nSettings.find((s) => s.key === 'i18n.defaultLocale')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('en-US');
    });

    it('i18n.supportedLocales is string en-US', () => {
      const s = i18nSettings.find((s) => s.key === 'i18n.supportedLocales')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('en-US');
    });

    it('i18n.fallbackLocale is string en-US', () => {
      const s = i18nSettings.find((s) => s.key === 'i18n.fallbackLocale')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('en-US');
    });
  });

  describe('policy.* settings (8 keys)', () => {
    const policySettings = SEED_I14_SETTINGS.filter((s) => s.key.startsWith('policy.'));

    it('has exactly 8 policy settings', () => {
      expect(policySettings).toHaveLength(8);
    });

    it('policy.terms.version is string 1.0.0', () => {
      const s = policySettings.find((s) => s.key === 'policy.terms.version')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('1.0.0');
    });

    it('policy.privacy.version is string 1.0.0', () => {
      const s = policySettings.find((s) => s.key === 'policy.privacy.version')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('1.0.0');
    });

    it('policy.seller-agreement.version is string 1.0.0', () => {
      const s = policySettings.find((s) => s.key === 'policy.seller-agreement.version')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('1.0.0');
    });

    it('policy.refund.effectiveDate is string 2024-01-01', () => {
      const s = policySettings.find((s) => s.key === 'policy.refund.effectiveDate')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('2024-01-01');
    });
  });

  describe('currency.* settings (3 keys)', () => {
    const currencySettings = SEED_I14_SETTINGS.filter((s) => s.key.startsWith('currency.'));

    it('has exactly 3 currency settings', () => {
      expect(currencySettings).toHaveLength(3);
    });

    it('currency.default is string USD', () => {
      const s = currencySettings.find((s) => s.key === 'currency.default')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('USD');
    });

    it('currency.symbol is string $', () => {
      const s = currencySettings.find((s) => s.key === 'currency.symbol')!;
      expect(s.type).toBe('string');
      expect(s.value).toBe('$');
    });

    it('currency.precision is number 2', () => {
      const s = currencySettings.find((s) => s.key === 'currency.precision')!;
      expect(s.type).toBe('number');
      expect(s.value).toBe(2);
    });
  });

  describe('shipping and tax settings', () => {
    it('fulfillment.shipping.freeThresholdCents is cents 5000', () => {
      const s = SEED_I14_SETTINGS.find((s) => s.key === 'fulfillment.shipping.freeThresholdCents')!;
      expect(s.type).toBe('cents');
      expect(s.value).toBe(5000);
    });

    it('tax.platformTaxEnabled is boolean false', () => {
      const s = SEED_I14_SETTINGS.find((s) => s.key === 'tax.platformTaxEnabled')!;
      expect(s.type).toBe('boolean');
      expect(s.value).toBe(false);
    });

    it('tax.defaultTaxRate is number 0', () => {
      const s = SEED_I14_SETTINGS.find((s) => s.key === 'tax.defaultTaxRate')!;
      expect(s.type).toBe('number');
      expect(s.value).toBe(0);
    });
  });
});
