/**
 * Additional coverage for ShopifyConnector — authenticate and buildAuthUrl edge cases.
 * Gap-fill tests for H3.1 review.
 *
 * Companion file: shopify-connector-revoke-health.test.ts (revokeAuth + healthCheck)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));
vi.mock('@twicely/db/schema', () => ({
  platformSetting: { key: 'key', value: 'value', category: 'category' },
}));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@twicely/crosslister/connector-registry', () => ({
  registerConnector: vi.fn(),
  getConnector: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockConfig = [
  { key: 'crosslister.shopify.clientId', value: 'test-client-id' },
  { key: 'crosslister.shopify.clientSecret', value: 'test-secret' },
  { key: 'crosslister.shopify.redirectUri', value: 'https://twicely.co/api/crosslister/shopify/callback' },
  { key: 'crosslister.shopify.scopes', value: 'read_products,write_products,read_inventory,write_inventory,read_orders' },
  { key: 'crosslister.shopify.apiVersion', value: '2024-01' },
];

function setupDbMock(config = mockConfig) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(config),
    }),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ShopifyConnector — authenticate edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  it('returns error when credentials.state (shopDomain) is empty string', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const result = await connector.authenticate({
      method: 'OAUTH',
      code: 'some-code',
      redirectUri: 'https://twicely.co/api/crosslister/shopify/callback',
      state: '',   // empty state = no shop domain
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('shopDomain missing');
    expect(result.accessToken).toBeNull();
  });

  it('returns error when token response body has error field but HTTP 200', async () => {
    // Shopify can return HTTP 200 with an error payload in some edge cases
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        error: 'invalid_request',
        error_description: 'Code already used',
      }),
    });

    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const result = await connector.authenticate({
      method: 'OAUTH',
      code: 'used-code',
      redirectUri: '',
      state: 'my-store.myshopify.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Code already used');
    expect(result.accessToken).toBeNull();
  });

  it('returns error when token response is missing access_token (fails schema)', async () => {
    // HTTP 200 but body does not have access_token — fails ShopifyAccessTokenSchema
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        scope: 'read_products',
        // access_token deliberately omitted
      }),
    });

    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const result = await connector.authenticate({
      method: 'OAUTH',
      code: 'bad-response-code',
      redirectUri: '',
      state: 'my-store.myshopify.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid token response from Shopify');
    expect(result.accessToken).toBeNull();
  });

  it('returns success with null externalAccountId when shop info returns non-ok status', async () => {
    // Token exchange succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'shpat_token', scope: 'read_products' }),
    });
    // Shop info returns 403 — should be treated as non-fatal
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({}),
    });

    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const result = await connector.authenticate({
      method: 'OAUTH',
      code: 'code',
      redirectUri: '',
      state: 'my-store.myshopify.com',
    });

    // Auth is still successful even when shop info is unavailable
    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('shpat_token');
    expect(result.externalAccountId).toBeNull();
    expect(result.externalUsername).toBeNull();
  });

  it('refreshToken and tokenExpiresAt are always null — Shopify tokens are permanent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'shpat_token', scope: 'read_products' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        shop: {
          id: 1, name: 'Test', email: 'a@b.com',
          domain: 'test.com', myshopify_domain: 'test.myshopify.com', currency: 'USD',
        },
      }),
    });

    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const result = await connector.authenticate({
      method: 'OAUTH',
      code: 'code',
      redirectUri: '',
      state: 'test.myshopify.com',
    });

    expect(result.refreshToken).toBeNull();
    expect(result.tokenExpiresAt).toBeNull();
  });
});

describe('ShopifyConnector — buildAuthUrl scope encoding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  it('encodes the configured scopes into the URL scope param', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const url = await connector.buildAuthUrl('state-abc', 'myshop.myshopify.com');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('scope')).toBe(
      'read_products,write_products,read_inventory,write_inventory,read_orders',
    );
  });

  it('encodes the configured redirect_uri into the URL', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const url = await connector.buildAuthUrl('state-abc', 'myshop.myshopify.com');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://twicely.co/api/crosslister/shopify/callback',
    );
  });

  it('uses default scopes when none are found in platform_settings', async () => {
    // Empty settings forces default fallback in loadShopifyConfig
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const url = await connector.buildAuthUrl('state', 'myshop.myshopify.com');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('scope')).toBe(
      'read_products,write_products,read_inventory,write_inventory,read_orders',
    );
  });

  it('encodes the client_id from platform_settings', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const url = await connector.buildAuthUrl('state-abc', 'myshop.myshopify.com');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
  });
});
