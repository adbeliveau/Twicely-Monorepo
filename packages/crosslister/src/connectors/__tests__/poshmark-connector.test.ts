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
  { key: 'crosslister.poshmark.apiBase', value: 'https://poshmark.com/api' },
  { key: 'crosslister.poshmark.userAgent', value: 'Poshmark/8.0 (iPhone; iOS 17.0)' },
];

function setupDbMock() {
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
    channel: 'POSHMARK' as const,
    externalAccountId: 'user-id-123',
    externalUsername: 'testuser',
    authMethod: 'SESSION' as const,
    accessToken: null,
    refreshToken: null,
    sessionData: { jwt: 'test-jwt', username: 'testuser' },
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

function buildPoshmarkItem(id = 'listing-1') {
  return {
    id,
    title: 'Test Item',
    description: 'A test item',
    price_amount: { val: '25.00', currency_code: 'USD' },
    inventory: { size_quantities: [{ size_id: '10', quantity_available: 1 }] },
    catalog: { category_obj: { display: 'Tops' } },
    pictures: [{ url: 'https://poshmark.com/img.jpg' }],
    brand: { display: 'Nike' },
    condition: 'Good',
    status: 'available',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

describe('PoshmarkConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  describe('channel and tier', () => {
    it('channel is "POSHMARK"', async () => {
      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      expect(connector.channel).toBe('POSHMARK');
    });

    it('tier is "C"', async () => {
      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      expect(connector.tier).toBe('C');
    });
  });

  describe('authenticate', () => {
    it('returns error for non-SESSION auth method', async () => {
      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.authenticate({ method: 'OAUTH', code: 'c', redirectUri: 'u' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('SESSION');
    });

    it('returns AuthResult with session data on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: { id: 'user-123', username: 'testuser' },
          jwt: 'test-jwt-token',
        }),
      });

      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.authenticate({ method: 'SESSION', username: 'testuser', password: 'pass123' });

      expect(result.success).toBe(true);
      expect(result.externalUsername).toBe('testuser');
      expect(result.sessionData).toBeTruthy();
    });

    it('returns error for invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid username or password' }),
      });

      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.authenticate({ method: 'SESSION', username: 'bad', password: 'bad' });

      expect(result.success).toBe(false);
      expect(result.accessToken).toBeNull();
    });
  });

  describe('fetchListings', () => {
    it('returns empty when no session data', async () => {
      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.fetchListings(buildAccount({ sessionData: null }));
      expect(result.listings).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('returns paginated ExternalListing array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [buildPoshmarkItem('item-1'), buildPoshmarkItem('item-2')],
          more_available: false,
        }),
      });

      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(2);
      expect(result.listings[0]?.priceCents).toBe(2500);
      expect(result.hasMore).toBe(false);
    });

    it('handles empty closet', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [], more_available: false }),
      });

      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(0);
      expect(result.cursor).toBeNull();
    });

    it('handles pagination (has_more + cursor)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [buildPoshmarkItem('item-1')],
          more_available: true,
          next_max_id: 'cursor-abc',
        }),
      });

      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('cursor-abc');
    });
  });

  describe('refreshAuth', () => {
    it('returns error for expired session (401 on test call)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.refreshAuth(buildAccount());

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session expired');
    });

    it('returns success when session is still valid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [], more_available: false }),
      });

      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.refreshAuth(buildAccount());

      expect(result.success).toBe(true);
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when API responds 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [], more_available: false }),
      });

      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy on error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(false);
    });

    it('returns unhealthy when no session data', async () => {
      const { PoshmarkConnector } = await import('../poshmark-connector');
      const connector = new PoshmarkConnector();
      const result = await connector.healthCheck(buildAccount({ sessionData: null }));

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('session');
    });
  });
});
