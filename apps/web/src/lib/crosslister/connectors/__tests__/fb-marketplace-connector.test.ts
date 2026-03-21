import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));
vi.mock('@twicely/db/schema', () => ({
  platformSetting: { key: 'key', value: 'value', category: 'category' },
}));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockConfig = [
  { key: 'crosslister.fbMarketplace.clientId', value: 'test-fb-app-id' },
  { key: 'crosslister.fbMarketplace.clientSecret', value: 'test-fb-secret' },
  { key: 'crosslister.fbMarketplace.redirectUri', value: 'https://twicely.co/api/crosslister/fb-marketplace/callback' },
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
    id: 'account-fb-1',
    sellerId: 'seller-1',
    channel: 'FB_MARKETPLACE' as const,
    externalAccountId: 'fb-user-123',
    externalUsername: 'Test User',
    authMethod: 'OAUTH' as const,
    accessToken: 'valid-fb-access-token',
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

describe('FbMarketplaceConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  describe('authenticate', () => {
    it('returns AuthResult with token on success', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'new-fb-access-token',
            token_type: 'Bearer',
            expires_in: 5183944,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'fb-user-456', name: 'Jane Seller' }),
        });

      const { FbMarketplaceConnector } = await import('../fb-marketplace-connector');
      const connector = new FbMarketplaceConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'fb-auth-code-123',
        redirectUri: 'https://twicely.co/api/crosslister/fb-marketplace/callback',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-fb-access-token');
      expect(result.refreshToken).toBeNull(); // Facebook has no refresh token
      expect(result.externalAccountId).toBe('fb-user-456');
      expect(result.externalUsername).toBe('Jane Seller');
    });

    it('returns error for non-OAUTH auth method', async () => {
      const { FbMarketplaceConnector } = await import('../fb-marketplace-connector');
      const connector = new FbMarketplaceConnector();
      const result = await connector.authenticate({ method: 'API_KEY', apiKey: 'key' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAUTH');
    });

    it('returns error when token exchange fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'Invalid OAuth access token', type: 'OAuthException', code: 190 },
        }),
      });

      const { FbMarketplaceConnector } = await import('../fb-marketplace-connector');
      const connector = new FbMarketplaceConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'bad-code',
        redirectUri: 'https://twicely.co/api/crosslister/fb-marketplace/callback',
      });

      expect(result.success).toBe(false);
      expect(result.accessToken).toBeNull();
    });
  });

  describe('refreshAuth', () => {
    it('returns error (Facebook tokens cannot be refreshed)', async () => {
      const { FbMarketplaceConnector } = await import('../fb-marketplace-connector');
      const connector = new FbMarketplaceConnector();
      const result = await connector.refreshAuth(buildAccount());

      expect(result.success).toBe(false);
      expect(result.error).toContain('reconnect');
    });
  });

  describe('fetchListings', () => {
    it('returns paginated ExternalListing array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 'fb-item-001',
              name: 'Jordan 1 Retro High OG',
              description: 'Excellent condition',
              price: { amount: 15000, currency: 'USD' },
              condition: 'USED_LIKE_NEW',
              availability: 'in stock',
              category: 'Sneakers',
              brand: 'Jordan',
              images: [{ id: 'img-1', url: 'https://example.com/img1.jpg' }],
              product_item_id: 'fb-item-001',
              created_time: '2024-06-01T10:00:00+0000',
            },
          ],
          paging: {
            cursors: { before: 'cursor-before', after: 'cursor-after' },
          },
        }),
      });

      const { FbMarketplaceConnector } = await import('../fb-marketplace-connector');
      const connector = new FbMarketplaceConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]?.externalId).toBe('fb-item-001');
      expect(result.listings[0]?.priceCents).toBe(15000);
      expect(result.listings[0]?.status).toBe('ACTIVE');
    });

    it('returns empty when no access token', async () => {
      const { FbMarketplaceConnector } = await import('../fb-marketplace-connector');
      const connector = new FbMarketplaceConnector();
      const result = await connector.fetchListings(buildAccount({ accessToken: null }));

      expect(result.listings).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('handles 401 gracefully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

      const { FbMarketplaceConnector } = await import('../fb-marketplace-connector');
      const connector = new FbMarketplaceConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(0);
      expect(result.cursor).toBeNull();
    });

    it('passes cursor for pagination', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [],
          paging: { cursors: { before: 'b', after: 'a' }, next: 'next-url' },
        }),
      });

      const { FbMarketplaceConnector } = await import('../fb-marketplace-connector');
      const connector = new FbMarketplaceConnector();
      const result = await connector.fetchListings(buildAccount(), 'cursor-after');

      // Verify the cursor was passed in the URL
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('after=cursor-after'),
        expect.any(Object),
      );
      expect(result.hasMore).toBe(true);
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when API responds 200', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'fb-user-123' }) });

      const { FbMarketplaceConnector } = await import('../fb-marketplace-connector');
      const connector = new FbMarketplaceConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy when no access token', async () => {
      const { FbMarketplaceConnector } = await import('../fb-marketplace-connector');
      const connector = new FbMarketplaceConnector();
      const result = await connector.healthCheck(buildAccount({ accessToken: null }));

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('No access token');
    });
  });
});
