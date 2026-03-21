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

function buildWhatnotListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing-abc123',
    title: 'Test Listing',
    description: 'A test listing description',
    price: { amount: '49.99', currencyCode: 'USD' },
    status: 'PUBLISHED',
    media: [{ url: 'https://cdn.whatnot.com/img1.jpg', type: 'IMAGE' }],
    product: {
      id: 'product-1',
      title: 'Test Product',
      variants: [{ id: 'v1', title: 'Default', price: { amount: '49.99', currencyCode: 'USD' }, inventoryQuantity: 1 }],
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    ...overrides,
  };
}

function buildTransformedListing(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Item',
    description: 'Test description',
    descriptionHtml: null,
    priceCents: 4999,
    quantity: 1,
    condition: 'GOOD',
    category: { externalCategoryId: 'cat-123', externalCategoryName: 'Clothing', path: ['Clothing'] },
    brand: null,
    images: [{ url: 'https://cdn.twicely.co/img1.jpg', sortOrder: 0, isPrimary: true }],
    itemSpecifics: {},
    shipping: { type: 'FREE' as const, flatRateCents: null, weightOz: null, dimensions: null, handlingTimeDays: 1 },
    ...overrides,
  };
}

function makeGraphQLResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
  };
}

function makeGraphQLErrorResponse(errors: Array<{ message: string }>, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data: null, errors }),
  };
}

/** Helper to get the parsed request body of a fetch call by index */
function getCallBody<T>(callIndex: number): T {
  const calls = mockFetch.mock.calls;
  const call = calls[callIndex]!;
  return JSON.parse(call[1].body as string) as T;
}

/** Helper to get the URL of a fetch call by index */
function getCallUrl(callIndex: number): string {
  return mockFetch.mock.calls[callIndex]![0] as string;
}

describe('WhatnotConnector - BIN Crosslist (H2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  // -------------------------------------------------------------------------
  describe('fetchListings', () => {
    it('returns paginated listings from GraphQL response', async () => {
      const listing = buildWhatnotListing();
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listings: {
            nodes: [listing],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const connector = new WhatnotConnector();
      const result = await connector.fetchListings(buildAccount());
      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]?.externalId).toBe('listing-abc123');
    });

    it('maps cursor from pageInfo.endCursor', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listings: {
            nodes: [],
            pageInfo: { hasNextPage: true, endCursor: 'cursor-abc' },
          },
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().fetchListings(buildAccount());
      expect(result.cursor).toBe('cursor-abc');
    });

    it('sets hasMore from pageInfo.hasNextPage', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listings: {
            nodes: [],
            pageInfo: { hasNextPage: true, endCursor: 'cursor-xyz' },
          },
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().fetchListings(buildAccount());
      expect(result.hasMore).toBe(true);
    });

    it('filters to ACTIVE status only (PUBLISHED -> ACTIVE)', async () => {
      const listings = [
        buildWhatnotListing({ id: 'l1', status: 'PUBLISHED' }),
        buildWhatnotListing({ id: 'l2', status: 'UNPUBLISHED' }),
        buildWhatnotListing({ id: 'l3', status: 'SOLD' }),
      ];
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listings: { nodes: listings, pageInfo: { hasNextPage: false, endCursor: null } },
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().fetchListings(buildAccount());
      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]?.externalId).toBe('l1');
    });

    it('normalizes WhatnotListing to ExternalListing via normalizer', async () => {
      const listing = buildWhatnotListing({ price: { amount: '25.00', currencyCode: 'USD' } });
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listings: { nodes: [listing], pageInfo: { hasNextPage: false, endCursor: null } },
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().fetchListings(buildAccount());
      expect(result.listings[0]?.priceCents).toBe(2500);
      expect(result.listings[0]?.title).toBe('Test Listing');
    });

    it('skips invalid listings without throwing', async () => {
      const listings = [
        buildWhatnotListing({ id: 'l-valid' }),
        { notAValidListing: true },
      ];
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listings: { nodes: listings, pageInfo: { hasNextPage: false, endCursor: null } },
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().fetchListings(buildAccount());
      // l-valid is PUBLISHED -> included; invalid one is skipped
      expect(result.listings).toHaveLength(1);
    });

    it('returns empty result when accessToken is null', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().fetchListings(buildAccount({ accessToken: null }));
      expect(result.listings).toHaveLength(0);
      expect(result.cursor).toBeNull();
      expect(result.hasMore).toBe(false);
      expect(result.totalEstimate).toBeNull();
    });

    it('returns empty result on HTTP 401 (token expired)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ data: null, errors: [{ message: 'Unauthorized' }] }),
      });
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().fetchListings(buildAccount());
      expect(result.listings).toHaveLength(0);
    });

    it('returns empty result on GraphQL errors', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLErrorResponse([{ message: 'Internal server error' }]),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().fetchListings(buildAccount());
      expect(result.listings).toHaveLength(0);
    });

    it('returns empty result on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().fetchListings(buildAccount());
      expect(result.listings).toHaveLength(0);
    });

    it('sends first: 50 batch size', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listings: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().fetchListings(buildAccount());
      const body = getCallBody<{ variables: { first: number } }>(0);
      expect(body.variables.first).toBe(50);
    });

    it('sends after: cursor when cursor provided', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listings: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().fetchListings(buildAccount(), 'my-cursor');
      const body = getCallBody<{ variables: { after: string } }>(0);
      expect(body.variables.after).toBe('my-cursor');
    });

    it('sends after: null when no cursor', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listings: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().fetchListings(buildAccount());
      const body = getCallBody<{ variables: { after: null } }>(0);
      expect(body.variables.after).toBeNull();
    });

    it('uses production GraphQL URL by default', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listings: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().fetchListings(buildAccount());
      expect(getCallUrl(0)).toBe('https://api.whatnot.com/seller-api/graphql');
    });

    it('uses staging GraphQL URL when environment is STAGING', async () => {
      setupDbMock(mockStagingConfig);
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listings: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().fetchListings(buildAccount());
      expect(getCallUrl(0)).toBe('https://api.stage.whatnot.com/seller-api/graphql');
    });
  });

  // -------------------------------------------------------------------------
  describe('fetchSingleListing', () => {
    it('returns ExternalListing for valid listing ID', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({ listing: buildWhatnotListing() }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().fetchSingleListing(buildAccount(), 'listing-abc123');
      expect(result.externalId).toBe('listing-abc123');
      expect(result.priceCents).toBe(4999);
    });

    it('throws Error when accessToken is null', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      await expect(
        new WhatnotConnector().fetchSingleListing(buildAccount({ accessToken: null }), 'id'),
      ).rejects.toThrow('No access token');
    });

    it('throws Error when listing not found (null data)', async () => {
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({ listing: null }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      await expect(
        new WhatnotConnector().fetchSingleListing(buildAccount(), 'nonexistent'),
      ).rejects.toThrow('Whatnot listing not found');
    });

    it('throws Error when GraphQL returns errors', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLErrorResponse([{ message: 'Not found' }]),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      await expect(
        new WhatnotConnector().fetchSingleListing(buildAccount(), 'id'),
      ).rejects.toThrow('Whatnot listing not found');
    });
  });

  // -------------------------------------------------------------------------
  describe('createListing', () => {
    it('performs 2-step create: listingCreate then listingPublish', async () => {
      mockFetch
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingCreate: {
            listing: { id: 'new-listing-id', title: 'Test', status: 'DRAFT' },
            userErrors: [],
          },
        }))
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingPublish: {
            listing: { id: 'new-listing-id', status: 'PUBLISHED' },
            userErrors: [],
          },
        }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing());
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('converts TransformedListing to WhatnotListingInput correctly', async () => {
      mockFetch
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingCreate: { listing: { id: 'lid', title: 'T', status: 'DRAFT' }, userErrors: [] },
        }))
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingPublish: { listing: { id: 'lid', status: 'PUBLISHED' }, userErrors: [] },
        }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing({ title: 'My Item' }));
      const body = getCallBody<{ variables: { input: { title: string } } }>(0);
      expect(body.variables.input.title).toBe('My Item');
    });

    it('converts priceCents to Money decimal string', async () => {
      mockFetch
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingCreate: { listing: { id: 'lid', title: 'T', status: 'DRAFT' }, userErrors: [] },
        }))
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingPublish: { listing: { id: 'lid', status: 'PUBLISHED' }, userErrors: [] },
        }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing({ priceCents: 4999 }));
      const body = getCallBody<{ variables: { input: { price: { amount: string; currencyCode: string } } } }>(0);
      expect(body.variables.input.price.amount).toBe('49.99');
      expect(body.variables.input.price.currencyCode).toBe('USD');
    });

    it('truncates title to 200 characters', async () => {
      const longTitle = 'A'.repeat(300);
      mockFetch
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingCreate: { listing: { id: 'lid', title: 'T', status: 'DRAFT' }, userErrors: [] },
        }))
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingPublish: { listing: { id: 'lid', status: 'PUBLISHED' }, userErrors: [] },
        }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing({ title: longTitle }));
      const body = getCallBody<{ variables: { input: { title: string } } }>(0);
      expect(body.variables.input.title).toHaveLength(200);
    });

    it('truncates description to 5000 characters', async () => {
      const longDesc = 'B'.repeat(6000);
      mockFetch
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingCreate: { listing: { id: 'lid', title: 'T', status: 'DRAFT' }, userErrors: [] },
        }))
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingPublish: { listing: { id: 'lid', status: 'PUBLISHED' }, userErrors: [] },
        }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing({ description: longDesc }));
      const body = getCallBody<{ variables: { input: { description: string } } }>(0);
      expect(body.variables.input.description).toHaveLength(5000);
    });

    it('limits images to 10, sorted by sortOrder', async () => {
      const images = Array.from({ length: 15 }, (_, i) => ({
        url: `https://cdn.twicely.co/img${i}.jpg`,
        sortOrder: i,
        isPrimary: i === 0,
      }));
      mockFetch
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingCreate: { listing: { id: 'lid', title: 'T', status: 'DRAFT' }, userErrors: [] },
        }))
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingPublish: { listing: { id: 'lid', status: 'PUBLISHED' }, userErrors: [] },
        }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing({ images }));
      const body = getCallBody<{ variables: { input: { media: Array<{ url: string }> } } }>(0);
      expect(body.variables.input.media).toHaveLength(10);
    });

    it('maps category.externalCategoryId to productTaxonomyNodeId', async () => {
      mockFetch
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingCreate: { listing: { id: 'lid', title: 'T', status: 'DRAFT' }, userErrors: [] },
        }))
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingPublish: { listing: { id: 'lid', status: 'PUBLISHED' }, userErrors: [] },
        }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().createListing(
        buildAccount(),
        buildTransformedListing({
          category: { externalCategoryId: 'tax-node-456', externalCategoryName: 'Sneakers', path: [] },
        }),
      );
      const body = getCallBody<{ variables: { input: { productTaxonomyNodeId: string } } }>(0);
      expect(body.variables.input.productTaxonomyNodeId).toBe('tax-node-456');
    });

    it('returns success with externalId and externalUrl', async () => {
      mockFetch
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingCreate: { listing: { id: 'listing-999', title: 'T', status: 'DRAFT' }, userErrors: [] },
        }))
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingPublish: { listing: { id: 'listing-999', status: 'PUBLISHED' }, userErrors: [] },
        }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing());
      expect(result.success).toBe(true);
      expect(result.externalId).toBe('listing-999');
    });

    it('returns externalUrl in correct format', async () => {
      mockFetch
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingCreate: { listing: { id: 'listing-999', title: 'T', status: 'DRAFT' }, userErrors: [] },
        }))
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingPublish: { listing: { id: 'listing-999', status: 'PUBLISHED' }, userErrors: [] },
        }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing());
      expect(result.externalUrl).toBe('https://www.whatnot.com/listings/listing-999');
    });

    it('returns failure with userErrors from create step', async () => {
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({
        listingCreate: {
          listing: null,
          userErrors: [{ field: ['title'], message: 'Title is too short' }],
        },
      }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Title is too short');
      expect(result.retryable).toBe(false);
    });

    it('returns partial failure when publish step fails (retryable)', async () => {
      mockFetch
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingCreate: { listing: { id: 'listing-draft', title: 'T', status: 'DRAFT' }, userErrors: [] },
        }))
        .mockResolvedValueOnce(makeGraphQLResponse({
          listingPublish: {
            listing: null,
            userErrors: [{ field: [], message: 'Publish failed: listing incomplete' }],
          },
        }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing());
      expect(result.success).toBe(false);
      expect(result.externalId).toBe('listing-draft');
      expect(result.retryable).toBe(true);
      expect(result.error).toContain('Created but publish failed');
    });

    it('returns failure when accessToken is null', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(
        buildAccount({ accessToken: null }),
        buildTransformedListing(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('No credentials');
      expect(result.retryable).toBe(false);
    });

    it('returns retryable: true on HTTP 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ data: null }),
      });
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing());
      expect(result.retryable).toBe(true);
    });

    it('returns retryable: true on HTTP 5xx', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ data: null }),
      });
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing());
      expect(result.retryable).toBe(true);
    });

    it('returns retryable: false on HTTP 4xx (non-429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ data: null }),
      });
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing());
      expect(result.retryable).toBe(false);
    });

    it('returns retryable: true on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing());
      expect(result.retryable).toBe(true);
    });

    it('returns retryable:true when createResult.data is null (no response data)', async () => {
      // Tests the `if (!createData)` guard on line 458-460 of connector
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: null }),
      });
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing());
      expect(result.success).toBe(false);
      expect(result.error).toBe('No response data');
      expect(result.retryable).toBe(true);
    });

    it('returns retryable:true when create returns listing with null ID', async () => {
      // Tests the `if (!listingId)` guard on line 472-475 of connector
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({
        listingCreate: {
          listing: { id: null, title: 'T', status: 'DRAFT' },
          userErrors: [],
        },
      }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().createListing(buildAccount(), buildTransformedListing());
      expect(result.success).toBe(false);
      expect(result.error).toBe('No listing ID returned');
      expect(result.retryable).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('updateListing', () => {
    it('sends only changed fields in mutation input', async () => {
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({
        listingUpdate: {
          listing: { id: 'lid', title: 'T', status: 'PUBLISHED' },
          userErrors: [],
        },
      }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().updateListing(buildAccount(), 'lid', { priceCents: 1999 });
      const body = getCallBody<{ variables: { input: { price: { amount: string }; title?: string } } }>(0);
      expect(body.variables.input.price).toBeDefined();
      expect(body.variables.input.title).toBeUndefined();
    });

    it('converts priceCents to Money string', async () => {
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({
        listingUpdate: { listing: { id: 'lid', title: 'T', status: 'PUBLISHED' }, userErrors: [] },
      }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().updateListing(buildAccount(), 'lid', { priceCents: 1999 });
      const body = getCallBody<{ variables: { input: { price: { amount: string } } } }>(0);
      expect(body.variables.input.price.amount).toBe('19.99');
    });

    it('returns success on valid update', async () => {
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({
        listingUpdate: { listing: { id: 'lid', title: 'T', status: 'PUBLISHED' }, userErrors: [] },
      }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().updateListing(buildAccount(), 'lid', { title: 'New Title' });
      expect(result.success).toBe(true);
    });

    it('returns failure with userErrors', async () => {
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({
        listingUpdate: {
          listing: null,
          userErrors: [{ field: ['price'], message: 'Price below minimum' }],
        },
      }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().updateListing(buildAccount(), 'lid', { priceCents: 1 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Price below minimum');
    });

    it('returns failure when accessToken is null', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().updateListing(
        buildAccount({ accessToken: null }),
        'lid',
        {},
      );
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
    });

    it('returns retryable based on HTTP status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ data: null }) });
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().updateListing(buildAccount(), 'lid', {});
      expect(result.retryable).toBe(true);
    });

    it('sends request even when changes is empty object (no short-circuit)', async () => {
      // The connector does not short-circuit on empty changes — it still fires the mutation.
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({
        listingUpdate: { listing: { id: 'lid', title: 'T', status: 'PUBLISHED' }, userErrors: [] },
      }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().updateListing(buildAccount(), 'lid', {});
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it('returns retryable:true on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().updateListing(buildAccount(), 'lid', { title: 'X' });
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('delistListing', () => {
    it('calls listingUnpublish mutation', async () => {
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({
        listingUnpublish: { listing: { id: 'lid', status: 'UNPUBLISHED' }, userErrors: [] },
      }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      await new WhatnotConnector().delistListing(buildAccount(), 'lid');
      const body = getCallBody<{ query: string }>(0);
      expect(body.query).toContain('listingUnpublish');
    });

    it('returns success on successful unpublish', async () => {
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({
        listingUnpublish: { listing: { id: 'lid', status: 'UNPUBLISHED' }, userErrors: [] },
      }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().delistListing(buildAccount(), 'lid');
      expect(result.success).toBe(true);
    });

    it('returns success when listing already unpublished (idempotent)', async () => {
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({
        listingUnpublish: {
          listing: null,
          userErrors: [{ field: [], message: 'Listing is already unpublished' }],
        },
      }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().delistListing(buildAccount(), 'lid');
      expect(result.success).toBe(true);
    });

    it('returns success when listing not found (idempotent)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ data: null, errors: [{ message: 'Not found' }] }),
      });
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().delistListing(buildAccount(), 'lid');
      expect(result.success).toBe(true);
    });

    it('returns failure when accessToken is null', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().delistListing(
        buildAccount({ accessToken: null }),
        'lid',
      );
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
    });

    it('returns retryable based on HTTP status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ data: null }) });
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().delistListing(buildAccount(), 'lid');
      expect(result.retryable).toBe(true);
    });

    it('returns success when GraphQL errors array contains "not found" (idempotent)', async () => {
      // This tests the hasGraphQLNotFound path: result.errors array with "not found" message
      // even when HTTP status is 200.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { listingUnpublish: { listing: null, userErrors: [] } },
          errors: [{ message: 'Listing not found' }],
        }),
      });
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().delistListing(buildAccount(), 'lid');
      expect(result.success).toBe(true);
      expect(result.retryable).toBe(false);
    });

    it('returns failure with retryable:false on non-retryable userError', async () => {
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({
        listingUnpublish: {
          listing: null,
          userErrors: [{ field: [], message: 'Listing is in a show and cannot be unpublished' }],
        },
      }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().delistListing(buildAccount(), 'lid');
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be unpublished');
      expect(result.retryable).toBe(false);
    });

    it('returns failure on catch with retryable:true on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().delistListing(buildAccount(), 'lid');
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('verifyListing', () => {
    it('returns exists: true with ACTIVE status for PUBLISHED listing', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({ listing: buildWhatnotListing({ status: 'PUBLISHED' }) }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(buildAccount(), 'listing-abc123');
      expect(result.exists).toBe(true);
      expect(result.status).toBe('ACTIVE');
    });

    it('returns exists: true with ENDED status for UNPUBLISHED listing', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({ listing: buildWhatnotListing({ status: 'UNPUBLISHED' }) }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(buildAccount(), 'listing-abc123');
      expect(result.exists).toBe(true);
      expect(result.status).toBe('ENDED');
    });

    it('returns exists: true with SOLD status for SOLD listing', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({ listing: buildWhatnotListing({ status: 'SOLD' }) }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(buildAccount(), 'listing-abc123');
      expect(result.exists).toBe(true);
      expect(result.status).toBe('SOLD');
    });

    it('returns priceCents parsed from Money type', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({
          listing: buildWhatnotListing({ price: { amount: '99.99', currencyCode: 'USD' } }),
        }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(buildAccount(), 'listing-abc123');
      expect(result.priceCents).toBe(9999);
    });

    it('returns lastModifiedAt from updatedAt', async () => {
      const updatedAt = '2024-06-15T12:00:00Z';
      mockFetch.mockResolvedValueOnce(
        makeGraphQLResponse({ listing: buildWhatnotListing({ updatedAt }) }),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(buildAccount(), 'listing-abc123');
      expect(result.lastModifiedAt).toBeInstanceOf(Date);
      expect(result.lastModifiedAt?.toISOString()).toBe(new Date(updatedAt).toISOString());
    });

    it('returns exists: false, status: REMOVED when listing not found', async () => {
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({ listing: null }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(buildAccount(), 'nonexistent');
      expect(result.exists).toBe(false);
      expect(result.status).toBe('REMOVED');
    });

    it('returns exists: false when accessToken is null', async () => {
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(
        buildAccount({ accessToken: null }),
        'lid',
      );
      expect(result.exists).toBe(false);
      expect(result.status).toBe('UNKNOWN');
    });

    it('returns quantity from first product variant inventoryQuantity', async () => {
      const listing = buildWhatnotListing({
        product: {
          id: 'prod-1',
          title: 'Test',
          variants: [{ id: 'v1', title: 'Default', price: { amount: '49.99', currencyCode: 'USD' }, inventoryQuantity: 7 }],
        },
      });
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({ listing }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(buildAccount(), 'listing-abc123');
      expect(result.quantity).toBe(7);
    });

    it('falls back to quantity 1 when no variants present', async () => {
      const listing = buildWhatnotListing({
        product: { id: 'prod-1', title: 'Test', variants: [] },
      });
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({ listing }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(buildAccount(), 'listing-abc123');
      expect(result.quantity).toBe(1);
    });

    it('returns lastModifiedAt:null when updatedAt is invalid', async () => {
      const listing = buildWhatnotListing({ updatedAt: 'not-a-date' });
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({ listing }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(buildAccount(), 'listing-abc123');
      expect(result.lastModifiedAt).toBeNull();
    });

    it('returns lastModifiedAt:null when updatedAt is null', async () => {
      const listing = buildWhatnotListing({ updatedAt: null });
      mockFetch.mockResolvedValueOnce(makeGraphQLResponse({ listing }));
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(buildAccount(), 'listing-abc123');
      expect(result.lastModifiedAt).toBeNull();
    });

    it('returns exists:false and status:REMOVED when GraphQL returns errors', async () => {
      mockFetch.mockResolvedValueOnce(
        makeGraphQLErrorResponse([{ message: 'Listing not found' }]),
      );
      const { WhatnotConnector } = await import('../whatnot-connector');
      const result = await new WhatnotConnector().verifyListing(buildAccount(), 'listing-abc123');
      expect(result.exists).toBe(false);
      expect(result.status).toBe('REMOVED');
    });
  });
});
