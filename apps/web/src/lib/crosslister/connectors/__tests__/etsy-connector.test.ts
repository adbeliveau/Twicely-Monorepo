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
  { key: 'crosslister.etsy.clientId', value: 'test-etsy-client-id' },
  { key: 'crosslister.etsy.clientSecret', value: 'test-etsy-secret' },
  { key: 'crosslister.etsy.redirectUri', value: 'https://twicely.co/api/crosslister/etsy/callback' },
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
    id: 'account-etsy-1',
    sellerId: 'seller-1',
    channel: 'ETSY' as const,
    externalAccountId: 'shop-12345',
    externalUsername: 'myetsyshop',
    authMethod: 'OAUTH' as const,
    accessToken: 'valid-etsy-access-token',
    refreshToken: 'valid-etsy-refresh-token',
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

describe('EtsyConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  describe('authenticate', () => {
    it('returns AuthResult with tokens on success', async () => {
      // First call: token exchange; second call: profile fetch
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'new-etsy-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'new-etsy-refresh-token',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            user_id: 123,
            login_name: 'myetsyshop',
            primary_email: 'seller@example.com',
            shop_id: 12345,
          }),
        });

      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'etsy-auth-code-123',
        redirectUri: 'https://twicely.co/api/crosslister/etsy/callback',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-etsy-access-token');
      expect(result.refreshToken).toBe('new-etsy-refresh-token');
      expect(result.tokenExpiresAt).toBeInstanceOf(Date);
      expect(result.externalUsername).toBe('myetsyshop');
      expect(result.externalAccountId).toBe('12345');
    });

    it('returns error result on failed token exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'The authorization code is invalid or expired',
        }),
      });

      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'bad-code',
        redirectUri: 'https://twicely.co/api/crosslister/etsy/callback',
      });

      expect(result.success).toBe(false);
      expect(result.accessToken).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('returns error for non-OAUTH auth method', async () => {
      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.authenticate({ method: 'API_KEY', apiKey: 'key' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAUTH');
    });

    it('succeeds even if profile fetch fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'new-etsy-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'new-etsy-refresh-token',
          }),
        })
        .mockRejectedValueOnce(new Error('Profile fetch failed'));

      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.authenticate({
        method: 'OAUTH',
        code: 'auth-code',
        redirectUri: 'https://twicely.co/api/crosslister/etsy/callback',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-etsy-access-token');
      expect(result.externalAccountId).toBeNull();
    });
  });

  describe('fetchListings', () => {
    it('returns paginated ExternalListing array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          count: 1,
          results: [
            {
              listing_id: 999888777,
              user_id: 123,
              shop_id: 12345,
              title: 'Vintage Sweater',
              description: 'Cozy vintage sweater',
              state: 'active',
              creation_timestamp: 1700000000,
              ending_timestamp: null,
              original_creation_timestamp: 1700000000,
              last_modified_timestamp: 1700001000,
              state_timestamp: 1700000000,
              quantity: 1,
              shop_section_id: null,
              featured_rank: 0,
              url: 'https://www.etsy.com/listing/999888777',
              num_favorers: 5,
              non_taxable: false,
              is_taxable: true,
              is_customizable: false,
              is_personalizable: false,
              personalization_is_required: false,
              personalization_char_count_max: null,
              personalization_instructions: null,
              listing_type: 'physical',
              tags: [],
              materials: [],
              shipping_profile_id: null,
              return_policy_id: null,
              processing_min: null,
              processing_max: null,
              who_made: 'someone_else',
              when_made: '1990s',
              is_supply: false,
              item_weight: null,
              item_weight_unit: null,
              item_length: null,
              item_width: null,
              item_height: null,
              item_dimensions_unit: null,
              is_private: false,
              taxonomy_id: null,
              price: { amount: 3500, divisor: 100, currency_code: 'USD' },
              images: [
                { listing_image_id: 1, url_fullxfull: 'https://i.etsystatic.com/img1.jpg', rank: 1, is_watermarked: false },
              ],
            },
          ],
        }),
      });

      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]?.externalId).toBe('999888777');
      expect(result.listings[0]?.priceCents).toBe(3500);
      expect(result.listings[0]?.status).toBe('ACTIVE');
      expect(result.hasMore).toBe(false);
    });

    it('returns empty when no access token', async () => {
      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.fetchListings(buildAccount({ accessToken: null }));

      expect(result.listings).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('returns empty when no externalAccountId', async () => {
      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.fetchListings(buildAccount({ externalAccountId: null }));

      expect(result.listings).toHaveLength(0);
    });

    it('handles 401 gracefully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.listings).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('handles pagination (hasMore + cursor)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          count: 100,
          results: Array.from({ length: 25 }, (_, i) => ({
            listing_id: i + 1,
            user_id: 123,
            shop_id: 12345,
            title: `Item ${i}`,
            description: 'desc',
            state: 'active',
            creation_timestamp: 1700000000,
            ending_timestamp: null,
            original_creation_timestamp: 1700000000,
            last_modified_timestamp: 1700001000,
            state_timestamp: 1700000000,
            quantity: 1,
            shop_section_id: null,
            featured_rank: 0,
            url: `https://www.etsy.com/listing/${i + 1}`,
            num_favorers: 0,
            non_taxable: false,
            is_taxable: true,
            is_customizable: false,
            is_personalizable: false,
            personalization_is_required: false,
            personalization_char_count_max: null,
            personalization_instructions: null,
            listing_type: 'physical',
            tags: [],
            materials: [],
            shipping_profile_id: null,
            return_policy_id: null,
            processing_min: null,
            processing_max: null,
            who_made: 'someone_else',
            when_made: 'made_to_order',
            is_supply: false,
            item_weight: null,
            item_weight_unit: null,
            item_length: null,
            item_width: null,
            item_height: null,
            item_dimensions_unit: null,
            is_private: false,
            taxonomy_id: null,
            price: { amount: 1000, divisor: 100, currency_code: 'USD' },
            images: [],
          })),
        }),
      });

      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.fetchListings(buildAccount());

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('25');
      expect(result.totalEstimate).toBe(100);
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when API responds 200', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ application_id: 123 }) });

      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy when API responds with error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.healthCheck(buildAccount());

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('503');
    });

    it('returns unhealthy with no access token', async () => {
      const { EtsyConnector } = await import('../etsy-connector');
      const connector = new EtsyConnector();
      const result = await connector.healthCheck(buildAccount({ accessToken: null }));

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('No access token');
    });
  });
});
