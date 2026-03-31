/**
 * Additional coverage for ShopifyConnector — revokeAuth and healthCheck branches.
 * Gap-fill tests for H3.1 review.
 *
 * Companion file: shopify-connector-extra.test.ts (authenticate + buildAuthUrl)
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

function buildAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-1',
    sellerId: 'seller-1',
    channel: 'SHOPIFY' as const,
    externalAccountId: 'my-vintage-store.myshopify.com',
    externalUsername: 'My Vintage Store',
    authMethod: 'OAUTH' as const,
    accessToken: 'shpat_valid-access-token',
    refreshToken: null,
    sessionData: null,
    tokenExpiresAt: null,
    lastAuthAt: null,
    status: 'ACTIVE' as const,
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ShopifyConnector — revokeAuth no-op paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  it('does not call fetch when account has no accessToken', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    await connector.revokeAuth(buildAccount({ accessToken: null }));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not call fetch when account has no externalAccountId', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    await connector.revokeAuth(buildAccount({ externalAccountId: null }));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw when revoke network request fails — best-effort operation', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const { ShopifyConnector } = await import('../shopify-connector');
    const { logger } = await import('@twicely/logger');
    const connector = new ShopifyConnector();

    // Must NOT throw — revokeAuth is best-effort
    await expect(connector.revokeAuth(buildAccount())).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('revokeAuth'),
      expect.any(Object),
    );
  });

  it('calls DELETE on the correct Shopify revoke endpoint', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    await connector.revokeAuth(buildAccount());

    expect(mockFetch).toHaveBeenCalledWith(
      'https://my-vintage-store.myshopify.com/admin/api_permissions/current.json',
      expect.objectContaining({
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': 'shpat_valid-access-token' },
      }),
    );
  });
});

describe('ShopifyConnector — healthCheck additional branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  it('returns unhealthy when externalAccountId (shop domain) is null', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const result = await connector.healthCheck(buildAccount({ externalAccountId: null }));

    expect(result.healthy).toBe(false);
    expect(result.error).toContain('No shop domain');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns unhealthy and captures error string when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'));

    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const result = await connector.healthCheck(buildAccount());

    expect(result.healthy).toBe(false);
    expect(result.error).toContain('ECONNRESET');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('healthCheck URL uses the configured apiVersion from platform_settings', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    await connector.healthCheck(buildAccount());

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/admin/api/2024-01/shop.json');
    expect(url).toContain('my-vintage-store.myshopify.com');
  });

  it('healthCheck sends X-Shopify-Access-Token header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    await connector.healthCheck(buildAccount());

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['X-Shopify-Access-Token']).toBe(
      'shpat_valid-access-token',
    );
  });

  it('returns status code in error message when shop.json returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const result = await connector.healthCheck(buildAccount());

    expect(result.healthy).toBe(false);
    expect(result.error).toContain('429');
  });
});
