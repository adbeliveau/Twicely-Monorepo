import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB to avoid real DB calls
const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: {
    select: mockDbSelect,
  },
}));
vi.mock('@twicely/db/schema', () => ({
  platformSetting: { key: 'key', value: 'value', category: 'category' },
}));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockConfig = [
  { key: 'crosslister.ebay.clientId', value: 'test-client-id' },
  { key: 'crosslister.ebay.clientSecret', value: 'test-secret' },
  { key: 'crosslister.ebay.redirectUri', value: 'https://twicely.co/api/crosslister/ebay/callback' },
  { key: 'crosslister.ebay.environment', value: 'SANDBOX' },
];

function setupDbMock(): void {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(mockConfig),
    }),
  });
}

function buildAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-1',
    sellerId: 'seller-1',
    channel: 'EBAY' as const,
    externalAccountId: null,
    externalUsername: null,
    authMethod: 'OAUTH' as const,
    accessToken: 'valid-access-token',
    refreshToken: 'valid-refresh-token',
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

describe('EbayConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  describe('authenticate', () => {
    it('returns AuthResult with tokens on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'new-access-token',
          token_type: 'User Access Token',
          expires_in: 7200,
          refresh_token: 'new-refresh-token',
        }),
      });

      const { EbayConnector } = await import('../ebay-connector');
      const connector = new EbayConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'auth-code-123',
        redirectUri: 'https://twicely.co/api/crosslister/ebay/callback',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.tokenExpiresAt).toBeInstanceOf(Date);
    });

    it('returns error result on invalid code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'The authorization code is invalid',
        }),
      });

      const { EbayConnector } = await import('../ebay-connector');
      const connector = new EbayConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'bad-code',
        redirectUri: 'https://twicely.co/api/crosslister/ebay/callback',
      });

      expect(result.success).toBe(false);
      expect(result.accessToken).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('returns error for non-OAUTH auth method', async () => {
      const { EbayConnector } = await import('../ebay-connector');
      const connector = new EbayConnector();
      const result = await connector.authenticate({ method: 'API_KEY', apiKey: 'key' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAUTH');
    });
  });

  describe('fetchListings', () => {
    it('returns paginated ExternalListing array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          inventoryItems: [
            {
              sku: 'SKU-001',
              condition: 'LIKE_NEW',
              product: {
                title: 'Test Item',
                imageUrls: ['https://example.com/img.jpg'],
              },
              availability: { shipToLocationAvailability: { quantity: 1 } },
              offers: [{ listingId: '111', pricingSummary: { price: { value: '25.00', currency: 'USD' } } }],
            },
          ],
          total: 1,
          offset: 0,
          limit: 50,
        }),
      });

      const { EbayConnector } = await import('../ebay-connector');
      const connector = new EbayConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]?.externalId).toBe('SKU-001');
      expect(result.listings[0]?.priceCents).toBe(2500);
      expect(result.hasMore).toBe(false);
    });

    it('handles empty response (no listings)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ inventoryItems: [], total: 0 }),
      });

      const { EbayConnector } = await import('../ebay-connector');
      const connector = new EbayConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.cursor).toBeNull();
    });

    it('handles pagination (hasMore + cursor)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          inventoryItems: Array.from({ length: 50 }, (_, i) => ({
            sku: `SKU-${i}`,
            condition: 'GOOD',
            product: { title: `Item ${i}`, imageUrls: ['https://example.com/img.jpg'] },
            availability: { shipToLocationAvailability: { quantity: 1 } },
            offers: [{ pricingSummary: { price: { value: '10.00', currency: 'USD' } } }],
          })),
          total: 120,
          offset: 0,
          limit: 50,
        }),
      });

      const { EbayConnector } = await import('../ebay-connector');
      const connector = new EbayConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('50');
      expect(result.totalEstimate).toBe(120);
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when API responds 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ inventoryItems: [], total: 0 }),
      });

      const { EbayConnector } = await import('../ebay-connector');
      const connector = new EbayConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy when API responds error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      });

      const { EbayConnector } = await import('../ebay-connector');
      const connector = new EbayConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('503');
    });
  });
});
