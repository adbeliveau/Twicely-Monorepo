/**
 * Seed validation tests for Shopify webhook platform settings (H3.4).
 * Validates the 3 new webhook-related settings added by H3.4.
 * Source: H3.4 install prompt §5 (Seed Tests)
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

  const fakeDb = { insert: mockInsert };
  const { seedCrosslister } = await import('../seed-crosslister');
  await seedCrosslister(fakeDb as never);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('seed-crosslister — Shopify webhook settings (H3.4)', () => {
  it('seeds at least 15 Shopify-related settings (12 existing + 3 new)', () => {
    const shopifySettings = capturedValues.filter((v) => {
      if (typeof v.key !== 'string') return false;
      return (
        v.key.startsWith('crosslister.shopify.') ||
        v.key.startsWith('crosslister.fees.shopify.') ||
        v.key.startsWith('crosslister.rateLimit.shopify.')
      );
    });
    expect(shopifySettings.length).toBeGreaterThanOrEqual(15);
  });

  it('crosslister.shopify.webhookUrl matches expected callback URL', () => {
    const webhookUrl = capturedValues.find((v) => v.key === 'crosslister.shopify.webhookUrl');
    expect(webhookUrl).toBeDefined();
    expect(webhookUrl?.value).toBe('https://twicely.co/api/crosslister/shopify/webhook');
  });

  it('crosslister.shopify.syncEnabled defaults to true', () => {
    const syncEnabled = capturedValues.find((v) => v.key === 'crosslister.shopify.syncEnabled');
    expect(syncEnabled).toBeDefined();
    expect(syncEnabled?.value).toBe(true);
  });
});
