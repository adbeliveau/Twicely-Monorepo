import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));
vi.mock('@twicely/db/schema', () => ({
  platformSetting: { key: 'key', value: 'value', category: 'category' },
}));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { db } from '@twicely/db';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockConfig = [
  { key: 'crosslister.vestiaire.apiBase', value: 'https://www.vestiairecollective.com/api' },
  {
    key: 'crosslister.vestiaire.userAgent',
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  },
];

function setupDbMock(): void {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(mockConfig),
    }),
  } as unknown as ReturnType<typeof db.select>);
}

function buildAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-vc-1',
    sellerId: 'seller-1',
    channel: 'VESTIAIRE' as const,
    externalAccountId: 'vc-user-123',
    externalUsername: 'VestiaireSeller',
    authMethod: 'SESSION' as const,
    accessToken: null,
    refreshToken: null,
    sessionData: {
      sessionToken: 'valid-session-token',
      userId: 'vc-user-123',
      email: 'seller@example.com',
      detectedAt: Date.now(),
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

describe('VestiaireConnector', () => {
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
          user: { id: 'vc-user-001', email: 'seller@example.com', username: 'VestiaireSeller' },
          session_token: 'new-session-token-xyz',
        }),
      });

      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
      const result = await connector.authenticate({
        method: 'SESSION',
        username: 'seller@example.com',
        password: 'correct-password',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeNull();
      expect(result.sessionData).toBeDefined();
      expect((result.sessionData as Record<string, unknown>)['sessionToken']).toBe(
        'new-session-token-xyz',
      );
      expect(result.externalAccountId).toBe('vc-user-001');
      expect(result.externalUsername).toBe('VestiaireSeller');
    });

    it('rejects non-SESSION auth method', async () => {
      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
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

      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
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

      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
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
          items: [
            {
              id: 'vc-001',
              title: 'Chanel Classic Flap Bag',
              description: 'Very good condition Chanel.',
              price: '3500.00',
              currency: 'EUR',
              condition: 'Very good condition',
              status: 'on_sale',
              brand: { id: 1, name: 'Chanel', slug: 'chanel' },
              category: { id: 5, name: 'Handbags' },
              images: [
                { id: 'i1', url: 'https://cdn.vestiaire.com/chanel.jpg', position: 1, is_primary: true },
              ],
              created_at: '2024-01-01T00:00:00Z',
            },
          ],
          page: 1,
          per_page: 50,
          total: 1,
          has_more: false,
        }),
      });

      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]?.externalId).toBe('vc-001');
      expect(result.listings[0]?.priceCents).toBe(350000);
      expect(result.listings[0]?.status).toBe('ACTIVE');
      expect(result.hasMore).toBe(false);
    });

    it('returns empty when no session data', async () => {
      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
      const result = await connector.fetchListings(buildAccount({ sessionData: null }));

      expect(result.listings).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('handles 401 gracefully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(0);
      expect(result.cursor).toBeNull();
    });

    it('handles pagination with has_more cursor', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: Array.from({ length: 50 }, (_, i) => ({
            id: `vc-${i}`,
            title: `Item ${i}`,
            price: '100.00',
            status: 'on_sale',
            images: [],
          })),
          page: 1,
          per_page: 50,
          total: 150,
          has_more: true,
        }),
      });

      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('2');
      expect(result.totalEstimate).toBe(150);
    });

    it('preserves EUR currency from Vestiaire response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'vc-eur-1',
              title: 'LV Bag',
              price: '450.00',
              currency: 'EUR',
              status: 'on_sale',
              images: [],
            },
          ],
          page: 1,
          per_page: 50,
          total: 1,
          has_more: false,
        }),
      });

      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings[0]?.currencyCode).toBe('EUR');
    });

    it('filters to ACTIVE status only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: 'vc-active', title: 'Active Item', price: '100.00', status: 'on_sale', images: [] },
            { id: 'vc-sold', title: 'Sold Item', price: '100.00', status: 'sold', images: [] },
          ],
          page: 1,
          per_page: 50,
          total: 2,
          has_more: false,
        }),
      });

      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]?.externalId).toBe('vc-active');
    });
  });

  describe('updateListing', () => {
    it('always returns failure (canUpdate: false)', async () => {
      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
      const result = await connector.updateListing(buildAccount(), 'vc-001', {});

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Vestiaire');
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when API responds 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 0, has_more: false }),
      });

      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy when no session data', async () => {
      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
      const result = await connector.healthCheck(buildAccount({ sessionData: null }));

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('No session data');
    });

    it('returns unhealthy when API responds with error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

      const { VestiaireConnector } = await import('../vestiaire-connector');
      const connector = new VestiaireConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('503');
    });
  });
});
