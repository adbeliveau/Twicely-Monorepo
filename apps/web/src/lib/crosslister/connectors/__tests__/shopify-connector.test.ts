import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));
vi.mock('@twicely/db/schema', () => ({
  platformSetting: { key: 'key', value: 'value', category: 'category' },
}));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// Prevent auto-registration from conflicting in tests
vi.mock('@twicely/crosslister/connector-registry', () => ({
  registerConnector: vi.fn(),
  getConnector: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

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

describe('ShopifyConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  describe('channel and tier', () => {
    it('channel is "SHOPIFY"', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      expect(connector.channel).toBe('SHOPIFY');
    });

    it('tier is "A"', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      expect(connector.tier).toBe('A');
    });
  });

  describe('capabilities', () => {
    it('all capability flags match the spec', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      expect(connector.capabilities.canImport).toBe(true);
      expect(connector.capabilities.canPublish).toBe(true);
      expect(connector.capabilities.canUpdate).toBe(true);
      expect(connector.capabilities.canDelist).toBe(true);
      expect(connector.capabilities.hasWebhooks).toBe(true);
      expect(connector.capabilities.hasStructuredCategories).toBe(true);
      expect(connector.capabilities.canAutoRelist).toBe(false);
      expect(connector.capabilities.canMakeOffers).toBe(false);
      expect(connector.capabilities.canShare).toBe(false);
      expect(connector.capabilities.maxImagesPerListing).toBe(250);
      expect(connector.capabilities.maxTitleLength).toBe(255);
      expect(connector.capabilities.maxDescriptionLength).toBe(65535);
      expect(connector.capabilities.supportedImageFormats).toContain('webp');
    });
  });

  describe('buildAuthUrl', () => {
    it('returns correct URL with shop domain, client_id, scopes, redirect_uri, state', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const url = await connector.buildAuthUrl('test-state', 'my-store.myshopify.com');
      expect(url).toContain('https://my-store.myshopify.com/admin/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=test-state');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('scope=');
    });

    it('throws when shopDomain is not provided', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      await expect(connector.buildAuthUrl('test-state')).rejects.toThrow('shopDomain');
    });
  });

  describe('authenticate', () => {
    it('returns success with tokens and shop info on successful OAuth flow', async () => {
      // Token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'shpat_new-token',
          scope: 'read_products,write_products',
        }),
      });
      // Shop info fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          shop: {
            id: 123,
            name: 'My Vintage Store',
            email: 'owner@example.com',
            domain: 'my-vintage-store.com',
            myshopify_domain: 'my-vintage-store.myshopify.com',
            currency: 'USD',
            money_format: '${{amount}}',
            primary_locale: 'en',
            country_code: 'US',
            plan_name: 'basic',
          },
        }),
      });

      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'auth-code-123',
        redirectUri: 'https://twicely.co/api/crosslister/shopify/callback',
        state: 'my-vintage-store.myshopify.com',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('shpat_new-token');
      expect(result.refreshToken).toBeNull();
      expect(result.tokenExpiresAt).toBeNull();
      expect(result.externalAccountId).toBe('my-vintage-store.myshopify.com');
      expect(result.externalUsername).toBe('My Vintage Store');
    });

    it('returns error for non-OAUTH auth method', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.authenticate({ method: 'SESSION', username: 'u', password: 'p' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('OAUTH');
    });

    it('returns error when token exchange returns non-200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_request',
          error_description: 'The authorization code is invalid',
        }),
      });

      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'bad-code',
        redirectUri: 'u',
        state: 'my-store.myshopify.com',
      });

      expect(result.success).toBe(false);
      expect(result.accessToken).toBeNull();
    });

    it('returns error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'code',
        redirectUri: 'u',
        state: 'my-store.myshopify.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('returns success when shop info fetch fails — token is non-fatal', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'shpat_token',
          scope: 'read_products',
        }),
      });
      // Shop info fails
      mockFetch.mockRejectedValueOnce(new Error('Shop info fetch failed'));

      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'code',
        redirectUri: 'u',
        state: 'my-store.myshopify.com',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('shpat_token');
      expect(result.externalAccountId).toBeNull();
    });
  });

  describe('refreshAuth', () => {
    it('returns success with existing token — Shopify tokens are permanent', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.refreshAuth(buildAccount());

      // No fetch calls — Shopify tokens are permanent
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('shpat_valid-access-token');
      expect(result.tokenExpiresAt).toBeNull();
      expect(result.refreshToken).toBeNull();
    });

    it('returns error when no access token', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.refreshAuth(buildAccount({ accessToken: null }));

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('revokeAuth', () => {
    it('calls DELETE on Shopify revoke endpoint and logs info', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const { ShopifyConnector } = await import('../shopify-connector');
      const { logger } = await import('@/lib/logger');
      const connector = new ShopifyConnector();
      await connector.revokeAuth(buildAccount());

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api_permissions/current.json'),
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('revokeAuth'),
        expect.any(Object),
      );
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when shop.json responds 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ shop: { id: 1, name: 'Test' } }),
      });

      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy when shop.json returns 401', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('401');
    });

    it('returns unhealthy when no access token', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.healthCheck(buildAccount({ accessToken: null }));

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('No access token');
    });
  });

  describe('fetchListings', () => {
    it('returns empty paginated result when no products', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ products: [] }),
        headers: { get: () => null },
      });

      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(0);
      expect(result.cursor).toBeNull();
      expect(result.hasMore).toBe(false);
    });
  });

  describe('createListing (no credentials guard)', () => {
    it('returns { success: false, retryable: false } when accessToken is null', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.createListing(buildAccount({ accessToken: null }), {} as never);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.error).toBe('No credentials');
    });
  });

  describe('updateListing (no credentials guard)', () => {
    it('returns { success: false, retryable: false } when accessToken is null', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.updateListing(buildAccount({ accessToken: null }), 'ext-id-1', {});

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.error).toBe('No credentials');
    });
  });

  describe('delistListing (no credentials guard)', () => {
    it('returns { success: false, retryable: false } when accessToken is null', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.delistListing(buildAccount({ accessToken: null }), 'ext-id-1');

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.error).toBe('No credentials');
    });
  });

  describe('verifyListing (no credentials guard)', () => {
    it('returns { exists: false, status: "UNKNOWN" } when accessToken is null', async () => {
      const { ShopifyConnector } = await import('../shopify-connector');
      const connector = new ShopifyConnector();
      const result = await connector.verifyListing(buildAccount({ accessToken: null }), 'ext-id-1');

      expect(result.exists).toBe(false);
      expect(result.status).toBe('UNKNOWN');
    });
  });
});
