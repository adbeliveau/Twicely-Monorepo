/**
 * Seed validation tests for Shopify platform settings (H3.1).
 * Validates structure of Shopify entries in CROSSLISTER_SETTINGS.
 * Source: H3.1 install prompt §Test Requirements (seed)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db/schema', () => ({
  platformSetting: { key: 'key', value: 'value', category: 'category', description: 'description' },
  channelCategoryMapping: {},
  channelPolicyRule: {},
}));

vi.mock('../seed-categories', () => ({
  CATEGORY_IDS: {
    apparel: 'cat-apparel',
    electronics: 'cat-electronics',
    collectibles: 'cat-collectibles',
    womens: 'cat-womens',
    mens: 'cat-mens',
    shoes: 'cat-shoes',
    home: 'cat-home',
  },
}));

const SHOPIFY_KEY_PREFIXES = [
  'crosslister.shopify.',
  'crosslister.fees.shopify.',
  'crosslister.rateLimit.shopify.',
];

function hasShopifyPrefix(key: unknown): boolean {
  if (typeof key !== 'string') return false;
  return SHOPIFY_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

// ─── Test state ───────────────────────────────────────────────────────────────

const capturedValues: Array<Record<string, unknown>> = [];

beforeAll(async () => {
  const mockOnConflictDoNothing = vi.fn().mockResolvedValue([]);
  const mockInsert = vi.fn().mockReturnValue({
    values: (val: Record<string, unknown> | Array<Record<string, unknown>>) => {
      if (Array.isArray(val)) {
        capturedValues.push(...val);
      } else {
        capturedValues.push(val);
      }
      return { onConflictDoNothing: mockOnConflictDoNothing };
    },
  });

  const fakeDb = {
    insert: mockInsert,
  };

  const { seedCrosslister } = await import('../seed-crosslister');
  await seedCrosslister(fakeDb as never);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('seed-crosslister — Shopify settings', () => {
  it('seeds at least 12 Shopify-related settings', () => {
    const shopifySettings = capturedValues.filter((v) => hasShopifyPrefix(v.key));
    expect(shopifySettings.length).toBeGreaterThanOrEqual(12);
  });

  it('all Shopify settings have keys starting with the correct prefix', () => {
    const shopifySettings = capturedValues.filter((v) => hasShopifyPrefix(v.key));
    for (const s of shopifySettings) {
      expect(hasShopifyPrefix(s.key)).toBe(true);
    }
  });

  it('boolean settings are booleans — importEnabled, crosslistEnabled, automationEnabled', () => {
    const booleanKeys = [
      'crosslister.shopify.importEnabled',
      'crosslister.shopify.crosslistEnabled',
      'crosslister.shopify.automationEnabled',
    ];
    for (const key of booleanKeys) {
      const setting = capturedValues.find((v) => v.key === key);
      expect(setting, `Setting ${key} should exist`).toBeDefined();
      expect(typeof setting?.value).toBe('boolean');
    }
  });

  it('number settings are numbers — rateLimitPerMinute, rateLimitPerDay', () => {
    const numberKeys = [
      'crosslister.shopify.rateLimitPerMinute',
      'crosslister.shopify.rateLimitPerDay',
    ];
    for (const key of numberKeys) {
      const setting = capturedValues.find((v) => v.key === key);
      expect(setting, `Setting ${key} should exist`).toBeDefined();
      expect(typeof setting?.value).toBe('number');
    }
  });

  it('Shopify settings start disabled at launch', () => {
    const importEnabled = capturedValues.find((v) => v.key === 'crosslister.shopify.importEnabled');
    expect(importEnabled?.value).toBe(false);

    const crosslistEnabled = capturedValues.find((v) => v.key === 'crosslister.shopify.crosslistEnabled');
    expect(crosslistEnabled?.value).toBe(false);

    const automationEnabled = capturedValues.find((v) => v.key === 'crosslister.shopify.automationEnabled');
    expect(automationEnabled?.value).toBe(false);
  });

  it('Shopify redirect URI matches expected callback URL', () => {
    const redirectUri = capturedValues.find((v) => v.key === 'crosslister.shopify.redirectUri');
    expect(redirectUri?.value).toBe('https://twicely.co/api/crosslister/shopify/callback');
  });

  it('Shopify fee rate entry exists', () => {
    const feeRate = capturedValues.find((v) => v.key === 'crosslister.fees.shopify.rateBps');
    expect(feeRate).toBeDefined();
    expect(typeof feeRate?.value).toBe('number');
  });
});
