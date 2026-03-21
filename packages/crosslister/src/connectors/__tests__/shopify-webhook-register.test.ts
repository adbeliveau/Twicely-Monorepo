/**
 * Unit tests for Shopify webhook registration (registerWebhook method).
 * Source: H3.4 install prompt §5 (Unit Tests — Webhook Registration)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  platformSetting: { key: 'key', value: 'value', category: 'category' },
  crosslisterAccount: {},
  channelProjection: {},
  crossJob: {},
  channelCategoryMapping: {},
  featureFlag: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => ({ type: 'eq', a: _a, b: _b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/crosslister/connector-registry', () => ({
  registerConnector: vi.fn(),
}));

vi.mock('../shopify-auth', () => ({
  buildShopifyAuthUrl: vi.fn(),
  authenticateShopify: vi.fn(),
  refreshShopifyAuth: vi.fn(),
  revokeShopifyAuth: vi.fn(),
}));

vi.mock('../shopify-import', () => ({
  fetchShopifyProducts: vi.fn(),
  fetchSingleShopifyProduct: vi.fn(),
}));

vi.mock('../shopify-crosslist', () => ({
  toShopifyProductInput: vi.fn(),
  toShopifyPartialInput: vi.fn(),
  createShopifyProduct: vi.fn(),
  updateShopifyProduct: vi.fn(),
  deleteShopifyProduct: vi.fn(),
  fetchShopifyProductForVerify: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { db } from '@twicely/db';
import { ShopifyConnector } from '../shopify-connector';
import type { CrosslisterAccount } from '../../db-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<CrosslisterAccount> = {}): CrosslisterAccount {
  return {
    id: 'account-001',
    sellerId: 'seller-123',
    channel: 'SHOPIFY',
    authMethod: 'OAUTH',
    status: 'ACTIVE',
    externalAccountId: 'mystore.myshopify.com',
    externalUsername: 'My Store',
    accessToken: 'shpat_test_token',
    refreshToken: null,
    sessionData: null,
    tokenExpiresAt: null,
    lastAuthAt: new Date(),
    lastSyncAt: null,
    lastErrorAt: null,
    lastError: null,
    consecutiveErrors: 0,
    capabilities: {},
    firstImportCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockSettingsAndWebhookUrl(apiVersion = '2024-01', webhookUrl = 'https://twicely.co/api/crosslister/shopify/webhook') {
  vi.mocked(db.select)
    // First call: loadShopifyConfig queries all crosslister settings by category — no limit()
    .mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { key: 'crosslister.shopify.apiVersion', value: apiVersion },
          { key: 'crosslister.shopify.clientId', value: '' },
          { key: 'crosslister.shopify.clientSecret', value: '' },
          { key: 'crosslister.shopify.redirectUri', value: 'https://twicely.co/api/crosslister/shopify/callback' },
          { key: 'crosslister.shopify.scopes', value: 'read_products,write_products' },
        ]),
      }),
    } as never)
    // Second call: webhookUrl lookup by key
    .mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ value: webhookUrl }]),
        }),
      }),
    } as never);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ShopifyConnector.registerWebhook', () => {
  let connector: ShopifyConnector;
  let account: CrosslisterAccount;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new ShopifyConnector();
    account = makeAccount();
  });

  it('POSTs to correct Shopify webhook URL for each event', async () => {
    mockSettingsAndWebhookUrl();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ webhook: { id: 12345 } }),
    });
    global.fetch = mockFetch;

    await connector.registerWebhook(account, ['products/update']);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('mystore.myshopify.com/admin/api/'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Shopify-Access-Token': 'shpat_test_token',
        }),
        body: expect.stringContaining('products/update'),
      }),
    );
  });

  it('returns WebhookRegistration with IDs on success', async () => {
    mockSettingsAndWebhookUrl();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ webhook: { id: 99001 } }),
    });
    global.fetch = mockFetch;

    const result = await connector.registerWebhook(account, ['products/create', 'orders/create']);

    expect(result).toMatchObject({
      events: ['products/create', 'orders/create'],
      callbackUrl: expect.stringContaining('shopify/webhook'),
    });
    expect(result.webhookId).toContain('99001');
  });

  it('throws on 401 unauthorized response', async () => {
    mockSettingsAndWebhookUrl();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });
    global.fetch = mockFetch;

    await expect(
      connector.registerWebhook(account, ['products/update'])
    ).rejects.toThrow();
  });

  it('throws on 422 validation response', async () => {
    mockSettingsAndWebhookUrl();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('{"errors":{"address":["is invalid"]}}'),
    });
    global.fetch = mockFetch;

    await expect(
      connector.registerWebhook(account, ['products/update'])
    ).rejects.toThrow();
  });
});
