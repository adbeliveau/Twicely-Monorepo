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
  { key: 'crosslister.therealreal.apiBase', value: 'https://www.therealreal.com/api/v1' },
  { key: 'crosslister.therealreal.userAgent', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
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
    id: 'account-trr-1',
    sellerId: 'seller-1',
    channel: 'THEREALREAL' as const,
    externalAccountId: 'trr-user-567',
    externalUsername: 'Jane Consigner',
    authMethod: 'SESSION' as const,
    accessToken: null,
    refreshToken: null,
    sessionData: {
      sessionId: 'valid-session-id',
      csrfToken: 'valid-csrf-token',
      userId: 'trr-user-567',
      email: 'seller@example.com',
    },
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

describe('TheRealRealConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  describe('authenticate', () => {
    it('returns AuthResult with session data on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: { id: 'trr-user-001', email: 'seller@example.com', first_name: 'Jane', last_name: 'Consigner' },
          session_id: 'new-session-id-xyz',
          csrf_token: 'new-csrf-token-xyz',
        }),
      });

      const { TheRealRealConnector } = await import('../therealreal-connector');
      const connector = new TheRealRealConnector();
      const result = await connector.authenticate({
        method: 'SESSION',
        username: 'seller@example.com',
        password: 'correct-password',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeNull();
      expect(result.sessionData).toBeDefined();
      expect((result.sessionData as Record<string, unknown>)['sessionId']).toBe('new-session-id-xyz');
      expect(result.externalAccountId).toBe('trr-user-001');
      expect(result.externalUsername).toBe('Jane Consigner');
    });

    it('returns error for non-SESSION auth method', async () => {
      const { TheRealRealConnector } = await import('../therealreal-connector');
      const connector = new TheRealRealConnector();
      const result = await connector.authenticate({ method: 'OAUTH', code: 'code', redirectUri: 'url' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SESSION');
    });

    it('returns error when login fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      const { TheRealRealConnector } = await import('../therealreal-connector');
      const connector = new TheRealRealConnector();
      const result = await connector.authenticate({
        method: 'SESSION',
        username: 'bad@example.com',
        password: 'wrong-password',
      });

      expect(result.success).toBe(false);
      expect(result.sessionData).toBeNull();
    });

    it('handles network error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { TheRealRealConnector } = await import('../therealreal-connector');
      const connector = new TheRealRealConnector();
      const result = await connector.authenticate({
        method: 'SESSION',
        username: 'seller@example.com',
        password: 'password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('fetchListings', () => {
    it('returns paginated ExternalListing array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          consignments: [
            {
              id: 'trr-con-001',
              title: 'Chanel Classic Flap Bag Medium',
              description: 'Excellent condition Chanel.',
              price: '3500.00',
              currency: 'USD',
              condition: 'Excellent',
              authentication_status: 'authenticated',
              status: 'listed',
              designer: { id: 1, name: 'Chanel', slug: 'chanel' },
              category: { id: 5, name: 'Handbags', path: 'women/handbags' },
              images: [{ id: 'i1', url: 'https://cdn.therealreal.com/chanel.jpg', position: 1, is_primary: true }],
              created_at: '2024-01-01T00:00:00Z',
            },
          ],
          page: 1,
          per_page: 50,
          total: 1,
          has_more: false,
        }),
      });

      const { TheRealRealConnector } = await import('../therealreal-connector');
      const connector = new TheRealRealConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]?.externalId).toBe('trr-con-001');
      expect(result.listings[0]?.priceCents).toBe(350000);
      expect(result.listings[0]?.status).toBe('ACTIVE');
      expect(result.hasMore).toBe(false);
    });

    it('returns empty when no session data', async () => {
      const { TheRealRealConnector } = await import('../therealreal-connector');
      const connector = new TheRealRealConnector();
      const result = await connector.fetchListings(buildAccount({ sessionData: null }));

      expect(result.listings).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('handles 401 gracefully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

      const { TheRealRealConnector } = await import('../therealreal-connector');
      const connector = new TheRealRealConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(0);
      expect(result.cursor).toBeNull();
    });

    it('handles pagination with has_more cursor', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          consignments: Array.from({ length: 50 }, (_, i) => ({
            id: `trr-${i}`,
            title: `Item ${i}`,
            price: '100.00',
            status: 'listed',
            images: [],
          })),
          page: 1,
          per_page: 50,
          total: 150,
          has_more: true,
        }),
      });

      const { TheRealRealConnector } = await import('../therealreal-connector');
      const connector = new TheRealRealConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('2');
      expect(result.totalEstimate).toBe(150);
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when API responds 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ consignments: [], total: 0, has_more: false }),
      });

      const { TheRealRealConnector } = await import('../therealreal-connector');
      const connector = new TheRealRealConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy when no session data', async () => {
      const { TheRealRealConnector } = await import('../therealreal-connector');
      const connector = new TheRealRealConnector();
      const result = await connector.healthCheck(buildAccount({ sessionData: null }));

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('No session data');
    });

    it('returns unhealthy when API responds with error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

      const { TheRealRealConnector } = await import('../therealreal-connector');
      const connector = new TheRealRealConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('503');
    });
  });
});
