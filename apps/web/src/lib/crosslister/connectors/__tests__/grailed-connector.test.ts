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
  { key: 'crosslister.grailed.clientId', value: 'test-grailed-client-id' },
  { key: 'crosslister.grailed.clientSecret', value: 'test-grailed-secret' },
  { key: 'crosslister.grailed.redirectUri', value: 'https://twicely.co/api/crosslister/grailed/callback' },
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
    id: 'account-grailed-1',
    sellerId: 'seller-1',
    channel: 'GRAILED' as const,
    externalAccountId: 'grailed-user-999',
    externalUsername: 'streetwear_guru',
    authMethod: 'OAUTH' as const,
    accessToken: 'valid-grailed-access-token',
    refreshToken: 'valid-grailed-refresh-token',
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

describe('GrailedConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  describe('authenticate', () => {
    it('returns AuthResult with tokens on success', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'new-grailed-access-token',
            token_type: 'Bearer',
            expires_in: 7200,
            refresh_token: 'new-grailed-refresh-token',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 999, username: 'streetwear_guru' }),
        });

      const { GrailedConnector } = await import('../grailed-connector');
      const connector = new GrailedConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'grailed-auth-code-123',
        redirectUri: 'https://twicely.co/api/crosslister/grailed/callback',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-grailed-access-token');
      expect(result.refreshToken).toBe('new-grailed-refresh-token');
      expect(result.tokenExpiresAt).toBeInstanceOf(Date);
      expect(result.externalUsername).toBe('streetwear_guru');
    });

    it('returns error for non-OAUTH auth method', async () => {
      const { GrailedConnector } = await import('../grailed-connector');
      const connector = new GrailedConnector();
      const result = await connector.authenticate({ method: 'SESSION', username: 'u', password: 'p' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAUTH');
    });

    it('returns error when token exchange fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        }),
      });

      const { GrailedConnector } = await import('../grailed-connector');
      const connector = new GrailedConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'bad-code',
        redirectUri: 'https://twicely.co/api/crosslister/grailed/callback',
      });

      expect(result.success).toBe(false);
      expect(result.accessToken).toBeNull();
    });
  });

  describe('fetchListings', () => {
    it('returns paginated ExternalListing array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          listings: [
            {
              id: 111222,
              title: 'Balenciaga Triple S Size 44',
              description: 'Excellent condition, comes with original box.',
              price: '450.00',
              currency: 'USD',
              is_new: false,
              is_gently_used: true,
              is_used: false,
              is_very_worn: false,
              sold: false,
              bumped: false,
              deleted: false,
              designer: { id: 1, name: 'Balenciaga', slug: 'balenciaga' },
              photos: [{ id: 1, url: 'https://media.grailed.com/bal.jpg', position: 1 }],
              link: 'https://www.grailed.com/listings/111222',
            },
          ],
          page: 1,
          per_page: 50,
          total_count: 1,
        }),
      });

      const { GrailedConnector } = await import('../grailed-connector');
      const connector = new GrailedConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]?.externalId).toBe('111222');
      expect(result.listings[0]?.priceCents).toBe(45000);
      expect(result.listings[0]?.status).toBe('ACTIVE');
      expect(result.hasMore).toBe(false);
    });

    it('returns empty when no access token', async () => {
      const { GrailedConnector } = await import('../grailed-connector');
      const connector = new GrailedConnector();
      const result = await connector.fetchListings(buildAccount({ accessToken: null }));

      expect(result.listings).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('handles 401 gracefully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

      const { GrailedConnector } = await import('../grailed-connector');
      const connector = new GrailedConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(0);
      expect(result.cursor).toBeNull();
    });

    it('handles pagination with page cursor', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          listings: Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            title: `Item ${i}`,
            description: 'desc',
            price: '100.00',
            currency: 'USD',
            is_new: true,
            is_gently_used: false,
            is_used: false,
            is_very_worn: false,
            sold: false,
            bumped: false,
            deleted: false,
          })),
          page: 1,
          per_page: 50,
          total_count: 200,
        }),
      });

      const { GrailedConnector } = await import('../grailed-connector');
      const connector = new GrailedConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('2');
      expect(result.totalEstimate).toBe(200);
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when API responds 200', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 999, username: 'streetwear_guru' }) });

      const { GrailedConnector } = await import('../grailed-connector');
      const connector = new GrailedConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy when API responds with error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

      const { GrailedConnector } = await import('../grailed-connector');
      const connector = new GrailedConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('503');
    });

    it('returns unhealthy with no access token', async () => {
      const { GrailedConnector } = await import('../grailed-connector');
      const connector = new GrailedConnector();
      const result = await connector.healthCheck(buildAccount({ accessToken: null }));

      expect(result.healthy).toBe(false);
    });
  });
});
