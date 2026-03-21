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

const mockProductionConfig = [
  { key: 'crosslister.whatnot.clientId', value: 'test-client-id' },
  { key: 'crosslister.whatnot.clientSecret', value: 'test-secret' },
  { key: 'crosslister.whatnot.redirectUri', value: 'https://twicely.co/api/crosslister/whatnot/callback' },
  { key: 'crosslister.whatnot.environment', value: 'PRODUCTION' },
];

const mockStagingConfig = [
  { key: 'crosslister.whatnot.clientId', value: 'staging-client-id' },
  { key: 'crosslister.whatnot.clientSecret', value: 'staging-secret' },
  { key: 'crosslister.whatnot.redirectUri', value: 'https://twicely.co/api/crosslister/whatnot/callback' },
  { key: 'crosslister.whatnot.environment', value: 'STAGING' },
];

function setupDbMock(config = mockProductionConfig) {
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
    channel: 'WHATNOT' as const,
    externalAccountId: 'whatnot-user-123',
    externalUsername: 'WhatnotUser',
    authMethod: 'OAUTH' as const,
    accessToken: 'wn_access_tk_valid-token',
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

describe('WhatnotConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  describe('channel and tier', () => {
    it('channel is "WHATNOT"', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      expect(connector.channel).toBe('WHATNOT');
    });

    it('tier is "B"', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      expect(connector.tier).toBe('B');
    });

    it('capabilities match expected', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      expect(connector.capabilities.canImport).toBe(true);
      expect(connector.capabilities.canPublish).toBe(true);
      expect(connector.capabilities.canUpdate).toBe(true);
      expect(connector.capabilities.canDelist).toBe(true);
      expect(connector.capabilities.hasWebhooks).toBe(true); // H2.3: sale webhook handler
      expect(connector.capabilities.hasStructuredCategories).toBe(true);
      expect(connector.capabilities.canAutoRelist).toBe(false);
      expect(connector.capabilities.canMakeOffers).toBe(false);
      expect(connector.capabilities.canShare).toBe(false);
      expect(connector.capabilities.maxImagesPerListing).toBe(10);
      expect(connector.capabilities.maxTitleLength).toBe(200);
      expect(connector.capabilities.maxDescriptionLength).toBe(5000);
    });
  });

  describe('buildAuthUrl', () => {
    it('generates correct production URL', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const url = await connector.buildAuthUrl('test-state');
      expect(url).toContain('https://api.whatnot.com/seller-api/rest/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=read%3Ainventory+write%3Ainventory+read%3Aorders');
      expect(url).toContain('state=test-state');
    });

    it('uses staging URL when environment is STAGING', async () => {
      setupDbMock(mockStagingConfig);
      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const url = await connector.buildAuthUrl('test-state');
      expect(url).toContain('https://api.stage.whatnot.com/seller-api/rest/oauth/authorize');
    });
  });

  describe('authenticate', () => {
    it('returns error for non-OAUTH auth method', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
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
          access_token: 'wn_access_tk_new-token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new-refresh-token',
          scope: 'read:inventory write:inventory read:orders',
        }),
      });
      // GraphQL me query
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { me: { id: 'user-123', username: 'WhatnotSeller' } } }),
      });

      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'auth-code-123',
        redirectUri: 'https://twicely.co/api/crosslister/whatnot/callback',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('wn_access_tk_new-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.tokenExpiresAt).toBeInstanceOf(Date);
    });

    it('fetches user profile for externalAccountId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'wn_access_tk_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'refresh-token',
          scope: 'read:inventory',
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { me: { id: 'whatnot-user-456', username: 'WhatnotSeller456' } } }),
      });

      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.authenticate({ method: 'OAUTH', code: 'code', redirectUri: 'u' });

      expect(result.externalAccountId).toBe('whatnot-user-456');
      expect(result.externalUsername).toBe('WhatnotSeller456');
    });

    it('returns error on invalid code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'The authorization code is invalid or has expired',
        }),
      });

      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.authenticate({ method: 'OAUTH', code: 'bad-code', redirectUri: 'u' });

      expect(result.success).toBe(false);
      expect(result.accessToken).toBeNull();
    });

    it('handles network error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.authenticate({ method: 'OAUTH', code: 'code', redirectUri: 'u' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('handles profile fetch failure gracefully — token succeeds, profile fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'wn_access_tk_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'refresh-token',
          scope: 'read:inventory',
        }),
      });
      // Profile fetch fails
      mockFetch.mockRejectedValueOnce(new Error('Profile fetch failed'));

      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.authenticate({ method: 'OAUTH', code: 'code', redirectUri: 'u' });

      // Should still succeed with token — profile failure is non-fatal
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('wn_access_tk_token');
      expect(result.externalAccountId).toBeNull();
    });
  });

  describe('refreshAuth', () => {
    it('refreshes expired tokens successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'wn_access_tk_new-access',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'brand-new-refresh-token',
          scope: 'read:inventory write:inventory read:orders',
        }),
      });

      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.refreshAuth(buildAccount());

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('wn_access_tk_new-access');
    });

    it('returns error when no refresh token', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.refreshAuth(buildAccount({ refreshToken: null }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No refresh token available');
    });

    it('stores new refresh token — Whatnot invalidates used refresh tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'wn_access_tk_new-access',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'rotated-refresh-token-xyz',
          scope: 'read:inventory write:inventory read:orders',
        }),
      });

      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.refreshAuth(buildAccount({ refreshToken: 'old-refresh-token' }));

      // Must store the new refresh token, not the old one
      expect(result.refreshToken).toBe('rotated-refresh-token-xyz');
      expect(result.refreshToken).not.toBe('old-refresh-token');
    });

    it('handles token refresh failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'invalid_token',
          error_description: 'Refresh token is expired or revoked',
        }),
      });

      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.refreshAuth(buildAccount());

      expect(result.success).toBe(false);
      expect(result.accessToken).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when GraphQL responds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { me: { id: 'user-123', username: 'WhatnotUser' } } }),
      });

      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy on error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('503');
    });

    it('returns unhealthy when no access token', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.healthCheck(buildAccount({ accessToken: null }));

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('No access token');
    });
  });
});
