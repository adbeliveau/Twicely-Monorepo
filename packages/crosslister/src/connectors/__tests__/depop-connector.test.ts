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
  { key: 'crosslister.depop.clientId', value: 'test-depop-client-id' },
  { key: 'crosslister.depop.clientSecret', value: 'test-depop-secret' },
  { key: 'crosslister.depop.redirectUri', value: 'https://twicely.co/api/crosslister/depop/callback' },
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
    id: 'account-depop-1',
    sellerId: 'seller-1',
    channel: 'DEPOP' as const,
    externalAccountId: 'depop-user-321',
    externalUsername: 'vintage_by_maya',
    authMethod: 'OAUTH' as const,
    accessToken: 'valid-depop-access-token',
    refreshToken: 'valid-depop-refresh-token',
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

describe('DepopConnector', () => {
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
            access_token: 'new-depop-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'new-depop-refresh-token',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'depop-321', username: 'vintage_by_maya' }),
        });

      const { DepopConnector } = await import('../depop-connector');
      const connector = new DepopConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'depop-auth-code-123',
        redirectUri: 'https://twicely.co/api/crosslister/depop/callback',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-depop-access-token');
      expect(result.refreshToken).toBe('new-depop-refresh-token');
      expect(result.tokenExpiresAt).toBeInstanceOf(Date);
      expect(result.externalUsername).toBe('vintage_by_maya');
    });

    it('returns error for non-OAUTH auth method', async () => {
      const { DepopConnector } = await import('../depop-connector');
      const connector = new DepopConnector();
      const result = await connector.authenticate({ method: 'API_KEY', apiKey: 'key' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAUTH');
    });

    it('returns error when token exchange fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Authorization code is invalid',
        }),
      });

      const { DepopConnector } = await import('../depop-connector');
      const connector = new DepopConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'bad-code',
        redirectUri: 'https://twicely.co/api/crosslister/depop/callback',
      });

      expect(result.success).toBe(false);
      expect(result.accessToken).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('fetchListings', () => {
    it('returns paginated ExternalListing array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          objects: [
            {
              id: 'depop-888',
              slug: 'vintage-band-tee-xl',
              description: 'Original Nirvana tee from the 90s.',
              price: { price_amount: '85.00', currency_name: 'USD' },
              status: 'active',
              condition: 'good',
              category: { id: 1, name: 'T-shirts' },
              brand: { id: 5, name: 'Nirvana' },
              pictures: [{ id: 1, url: 'https://example.com/tee.jpg' }],
              created_at: '2024-03-20T10:00:00Z',
            },
          ],
          meta: { end: true },
        }),
      });

      const { DepopConnector } = await import('../depop-connector');
      const connector = new DepopConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]?.externalId).toBe('depop-888');
      expect(result.listings[0]?.priceCents).toBe(8500);
      expect(result.listings[0]?.status).toBe('ACTIVE');
      expect(result.hasMore).toBe(false);
    });

    it('returns empty when no access token', async () => {
      const { DepopConnector } = await import('../depop-connector');
      const connector = new DepopConnector();
      const result = await connector.fetchListings(buildAccount({ accessToken: null }));

      expect(result.listings).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('handles 401 gracefully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

      const { DepopConnector } = await import('../depop-connector');
      const connector = new DepopConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(0);
      expect(result.cursor).toBeNull();
    });

    it('handles pagination with cursor', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          objects: Array.from({ length: 50 }, (_, i) => ({
            id: `depop-${i}`,
            slug: `item-${i}`,
            description: 'desc',
            price: { price_amount: '20.00', currency_name: 'USD' },
            status: 'active',
            pictures: [],
          })),
          meta: { next: 'cursor-xyz', end: false },
        }),
      });

      const { DepopConnector } = await import('../depop-connector');
      const connector = new DepopConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('cursor-xyz');
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when API responds 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'depop-321', username: 'vintage_by_maya' }),
      });

      const { DepopConnector } = await import('../depop-connector');
      const connector = new DepopConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy when no access token', async () => {
      const { DepopConnector } = await import('../depop-connector');
      const connector = new DepopConnector();
      const result = await connector.healthCheck(buildAccount({ accessToken: null }));

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('No access token');
    });

    it('returns unhealthy when API responds with error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

      const { DepopConnector } = await import('../depop-connector');
      const connector = new DepopConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('503');
    });
  });
});
