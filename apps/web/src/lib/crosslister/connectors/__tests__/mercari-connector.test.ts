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
  { key: 'crosslister.mercari.clientId', value: 'test-client-id' },
  { key: 'crosslister.mercari.clientSecret', value: 'test-secret' },
  { key: 'crosslister.mercari.redirectUri', value: 'https://twicely.co/api/crosslister/mercari/callback' },
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
    channel: 'MERCARI' as const,
    externalAccountId: 'mercari-user-123',
    externalUsername: 'MercariUser',
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

function buildMercariItem(id = 'item-1') {
  return {
    id,
    name: 'Test Item',
    description: 'A test item',
    price: 5000,
    status: 'on_sale',
    condition_id: 2,
    photos: [{ url: 'https://static.mercdn.net/img.jpg' }],
    brand: { id: 10, name: 'Nike' },
    categories: [{ id: 100, name: 'Shoes' }],
    shipping: { method_id: 1, payer_id: 1 },
    created: 1705312800,
    updated: 1705399200,
  };
}

describe('MercariConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  describe('channel and tier', () => {
    it('channel is "MERCARI"', async () => {
      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      expect(connector.channel).toBe('MERCARI');
    });

    it('tier is "B"', async () => {
      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      expect(connector.tier).toBe('B');
    });
  });

  describe('authenticate', () => {
    it('returns error for non-OAUTH auth method', async () => {
      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      const result = await connector.authenticate({ method: 'SESSION', username: 'u', password: 'p' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('OAUTH');
    });

    it('returns AuthResult with tokens on success', async () => {
      // Token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'new-token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new-refresh',
        }),
      });
      // User profile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'user-123', name: 'Test User' }),
      });

      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'auth-code-123',
        redirectUri: 'https://twicely.co/api/crosslister/mercari/callback',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-token');
      expect(result.refreshToken).toBe('new-refresh');
      expect(result.tokenExpiresAt).toBeInstanceOf(Date);
    });

    it('fetches user profile for externalAccountId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'mercari-user-456', name: 'Mercari User' }),
      });

      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      const result = await connector.authenticate({ method: 'OAUTH', code: 'code', redirectUri: 'u' });

      expect(result.externalAccountId).toBe('mercari-user-456');
      expect(result.externalUsername).toBe('Mercari User');
    });

    it('returns error on invalid code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'The authorization code is invalid',
        }),
      });

      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      const result = await connector.authenticate({ method: 'OAUTH', code: 'bad', redirectUri: 'u' });

      expect(result.success).toBe(false);
      expect(result.accessToken).toBeNull();
    });
  });

  describe('fetchListings', () => {
    it('returns empty when no access token', async () => {
      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      const result = await connector.fetchListings(buildAccount({ accessToken: null }));
      expect(result.listings).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('returns paginated ExternalListing array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: 'OK',
          data: [buildMercariItem('item-1'), buildMercariItem('item-2')],
          meta: { has_next: false },
        }),
      });

      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(2);
      expect(result.listings[0]?.priceCents).toBe(5000);
      expect(result.hasMore).toBe(false);
    });

    it('handles empty inventory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'OK', data: [], meta: { has_next: false } }),
      });

      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(0);
      expect(result.cursor).toBeNull();
    });

    it('handles pagination', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: 'OK',
          data: [buildMercariItem('item-1')],
          meta: { has_next: true, next_page_token: 'page-token-2' },
        }),
      });

      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('page-token-2');
    });
  });

  describe('refreshAuth', () => {
    it('refreshes expired tokens successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'new-access',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new-refresh',
        }),
      });

      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      const result = await connector.refreshAuth(buildAccount());

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access');
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when API responds 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'user-123', name: 'Test' }),
      });

      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const { MercariConnector } = await import('../mercari-connector');
      const connector = new MercariConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('503');
    });
  });
});
