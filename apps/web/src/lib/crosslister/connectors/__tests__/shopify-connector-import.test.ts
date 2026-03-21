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
  { key: 'crosslister.shopify.clientId', value: 'test-client-id' },
  { key: 'crosslister.shopify.clientSecret', value: 'test-secret' },
  { key: 'crosslister.shopify.redirectUri', value: 'https://twicely.co/api/crosslister/shopify/callback' },
  { key: 'crosslister.shopify.scopes', value: 'read_products,write_products,read_inventory,write_inventory,read_orders' },
  { key: 'crosslister.shopify.apiVersion', value: '2024-01' },
];

function setupDbMock(config = mockConfig) {
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
    channel: 'SHOPIFY' as const,
    externalAccountId: 'my-vintage-store.myshopify.com',
    externalUsername: 'My Vintage Store',
    authMethod: 'OAUTH' as const,
    accessToken: 'shpat_valid-access-token',
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

function buildShopifyProductRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: 1234567890,
    title: "Vintage Levi's 501",
    body_html: '<p>Classic raw denim</p>',
    vendor: "Levi's",
    product_type: 'Jeans',
    status: 'active',
    tags: 'vintage, denim',
    handle: 'vintage-levis-501',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-03-01T14:22:00Z',
    published_at: '2024-01-15T10:30:00Z',
    variants: [
      {
        id: 9876543210,
        product_id: 1234567890,
        title: 'Default Title',
        price: '89.99',
        sku: 'LV501-32-34',
        inventory_quantity: 1,
        weight: 1.5,
        weight_unit: 'lb',
        barcode: null,
      },
    ],
    images: [
      {
        id: 111222333,
        product_id: 1234567890,
        position: 1,
        src: 'https://cdn.shopify.com/s/files/levis-front.jpg',
        width: 1200,
        height: 1600,
        alt: 'Front view',
      },
    ],
    ...overrides,
  };
}

function makeProductsResponse(
  products: unknown[],
  linkHeader?: string,
  status = 200,
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ products }),
    headers: {
      get: (name: string) => {
        if (name === 'link') return linkHeader ?? null;
        return null;
      },
    },
  };
}

function makeSingleProductResponse(product: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ product }),
    headers: {
      get: () => null,
    },
  };
}

describe('ShopifyConnector.fetchListings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  it('returns paginated listings from products.json response', async () => {
    const product = buildShopifyProductRaw();
    mockFetch.mockResolvedValueOnce(makeProductsResponse([product]));

    const { ShopifyConnector } = await import('../shopify-connector');
    const connector = new ShopifyConnector();
    const result = await connector.fetchListings(buildAccount());

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.externalId).toBe('1234567890');
  });

  it('sends correct X-Shopify-Access-Token header', async () => {
    mockFetch.mockResolvedValueOnce(makeProductsResponse([]));

    const { ShopifyConnector } = await import('../shopify-connector');
    await new ShopifyConnector().fetchListings(buildAccount());

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Shopify-Access-Token': 'shpat_valid-access-token',
        }),
      }),
    );
  });

  it('sends URL with status=active and limit=50 on first page', async () => {
    mockFetch.mockResolvedValueOnce(makeProductsResponse([]));

    const { ShopifyConnector } = await import('../shopify-connector');
    await new ShopifyConnector().fetchListings(buildAccount());

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('status=active');
    expect(url).toContain('limit=50');
    expect(url).not.toContain('page_info');
  });

  it('sends page_info cursor on subsequent pages without status param', async () => {
    mockFetch.mockResolvedValueOnce(makeProductsResponse([]));

    const { ShopifyConnector } = await import('../shopify-connector');
    await new ShopifyConnector().fetchListings(buildAccount(), 'cursor-abc123');

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('page_info=cursor-abc123');
    expect(url).not.toContain('status=active');
  });

  it('parses Link header to extract next page cursor', async () => {
    const linkHeader = '<https://my-vintage-store.myshopify.com/admin/api/2024-01/products.json?page_info=nextCursor&limit=50>; rel="next"';
    mockFetch.mockResolvedValueOnce(makeProductsResponse([], linkHeader));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount());

    expect(result.cursor).toBe('nextCursor');
  });

  it('sets hasMore=true when Link header has rel="next"', async () => {
    const linkHeader = '<https://my-vintage-store.myshopify.com/admin/api/2024-01/products.json?page_info=next&limit=50>; rel="next"';
    mockFetch.mockResolvedValueOnce(makeProductsResponse([], linkHeader));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount());

    expect(result.hasMore).toBe(true);
  });

  it('sets hasMore=false when no Link header', async () => {
    mockFetch.mockResolvedValueOnce(makeProductsResponse([]));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount());

    expect(result.hasMore).toBe(false);
    expect(result.cursor).toBeNull();
  });

  it('filters to active products only', async () => {
    const activeProduct = buildShopifyProductRaw({ id: 1, status: 'active' });
    const draftProduct = buildShopifyProductRaw({ id: 2, status: 'draft' });
    const archivedProduct = buildShopifyProductRaw({ id: 3, status: 'archived' });
    mockFetch.mockResolvedValueOnce(makeProductsResponse([activeProduct, draftProduct, archivedProduct]));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount());

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.externalId).toBe('1');
  });

  it('skips invalid products without throwing', async () => {
    const validProduct = buildShopifyProductRaw({ id: 999 });
    const invalidProduct = { notAProduct: true };
    mockFetch.mockResolvedValueOnce(makeProductsResponse([validProduct, invalidProduct]));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount());

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.externalId).toBe('999');
  });

  it('normalizes price from first variant to integer cents', async () => {
    const product = buildShopifyProductRaw({
      variants: [
        { id: 1, product_id: 1, title: 'Default', price: '49.99', sku: null, inventory_quantity: 1, weight: null, weight_unit: null, barcode: null },
      ],
    });
    mockFetch.mockResolvedValueOnce(makeProductsResponse([product]));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount());

    expect(result.listings[0]?.priceCents).toBe(4999);
  });

  it('returns empty result when accessToken is null', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount({ accessToken: null }));

    expect(result.listings).toHaveLength(0);
    expect(result.cursor).toBeNull();
    expect(result.hasMore).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty result when externalAccountId is null', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount({ externalAccountId: null }));

    expect(result.listings).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty result on 401 response', async () => {
    mockFetch.mockResolvedValueOnce(makeProductsResponse([], undefined, 401));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount());

    expect(result.listings).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it('returns empty result on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce(makeProductsResponse([], undefined, 500));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount());

    expect(result.listings).toHaveLength(0);
  });

  it('returns empty result on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount());

    expect(result.listings).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it('totalEstimate is always null', async () => {
    mockFetch.mockResolvedValueOnce(makeProductsResponse([]));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount());

    expect(result.totalEstimate).toBeNull();
  });

  it('handles Link header with only rel="previous" — no next page', async () => {
    const linkHeader = '<https://my-vintage-store.myshopify.com/admin/api/2024-01/products.json?page_info=prev&limit=50>; rel="previous"';
    mockFetch.mockResolvedValueOnce(makeProductsResponse([], linkHeader));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchListings(buildAccount());

    expect(result.hasMore).toBe(false);
    expect(result.cursor).toBeNull();
  });

  it('uses apiVersion from platform_settings', async () => {
    const customConfig = [
      ...mockConfig.filter((c) => c.key !== 'crosslister.shopify.apiVersion'),
      { key: 'crosslister.shopify.apiVersion', value: '2025-01' },
    ];
    setupDbMock(customConfig);
    mockFetch.mockResolvedValueOnce(makeProductsResponse([]));

    const { ShopifyConnector } = await import('../shopify-connector');
    await new ShopifyConnector().fetchListings(buildAccount());

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('2025-01');
  });
});

describe('ShopifyConnector.fetchSingleListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  it('fetches single product by ID and returns ExternalListing', async () => {
    const product = buildShopifyProductRaw({ id: 9876543210 });
    mockFetch.mockResolvedValueOnce(makeSingleProductResponse(product));

    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().fetchSingleListing(buildAccount(), '9876543210');

    expect(result.externalId).toBe('9876543210');
    expect(result.priceCents).toBe(8999);
  });

  it('sends correct URL with product ID', async () => {
    const product = buildShopifyProductRaw({ id: 111 });
    mockFetch.mockResolvedValueOnce(makeSingleProductResponse(product));

    const { ShopifyConnector } = await import('../shopify-connector');
    await new ShopifyConnector().fetchSingleListing(buildAccount(), '111');

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/products/111.json');
    expect(url).toContain('my-vintage-store.myshopify.com');
  });

  it('throws when no access token', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    await expect(
      new ShopifyConnector().fetchSingleListing(buildAccount({ accessToken: null }), '123'),
    ).rejects.toThrow('No access token or shop domain');
  });

  it('throws when no externalAccountId', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    await expect(
      new ShopifyConnector().fetchSingleListing(buildAccount({ externalAccountId: null }), '123'),
    ).rejects.toThrow('No access token or shop domain');
  });

  it('throws when API returns non-200', async () => {
    mockFetch.mockResolvedValueOnce(makeSingleProductResponse(null, 404));

    const { ShopifyConnector } = await import('../shopify-connector');
    await expect(
      new ShopifyConnector().fetchSingleListing(buildAccount(), '999'),
    ).rejects.toThrow('404');
  });

  it('throws when product not found in response (null product)', async () => {
    mockFetch.mockResolvedValueOnce(makeSingleProductResponse(null));

    const { ShopifyConnector } = await import('../shopify-connector');
    await expect(
      new ShopifyConnector().fetchSingleListing(buildAccount(), '999'),
    ).rejects.toThrow();
  });

  it('validates product with ShopifyProductSchema', async () => {
    const invalidProduct = { notAProduct: true };
    mockFetch.mockResolvedValueOnce(makeSingleProductResponse(invalidProduct));

    const { ShopifyConnector } = await import('../shopify-connector');
    await expect(
      new ShopifyConnector().fetchSingleListing(buildAccount(), '999'),
    ).rejects.toThrow();
  });
});

// parseShopifyLinkHeader tests placed after connector tests so module is already
// cached and import is fast (avoids 5000ms cold-start timeout on first import)
describe('parseShopifyLinkHeader', () => {
  it('extracts page_info from rel="next" link', async () => {
    const { parseShopifyLinkHeader } = await import('../shopify-import');
    const header = '<https://my-store.myshopify.com/admin/api/2024-01/products.json?page_info=abc123&limit=50>; rel="next"';
    expect(parseShopifyLinkHeader(header)).toBe('abc123');
  });

  it('returns null when no Link header', async () => {
    const { parseShopifyLinkHeader } = await import('../shopify-import');
    expect(parseShopifyLinkHeader(null)).toBeNull();
  });

  it('returns null when Link header has no rel="next"', async () => {
    const { parseShopifyLinkHeader } = await import('../shopify-import');
    const header = '<https://my-store.myshopify.com/admin/api/2024-01/products.json?page_info=prev123&limit=50>; rel="previous"';
    expect(parseShopifyLinkHeader(header)).toBeNull();
  });

  it('handles Link header with both rel="previous" and rel="next"', async () => {
    const { parseShopifyLinkHeader } = await import('../shopify-import');
    const header = [
      '<https://my-store.myshopify.com/admin/api/2024-01/products.json?page_info=prev123&limit=50>; rel="previous"',
      '<https://my-store.myshopify.com/admin/api/2024-01/products.json?page_info=next456&limit=50>; rel="next"',
    ].join(', ');
    expect(parseShopifyLinkHeader(header)).toBe('next456');
  });

  it('returns null for malformed URL in Link header', async () => {
    const { parseShopifyLinkHeader } = await import('../shopify-import');
    const header = '<not-a-valid-url>; rel="next"';
    expect(parseShopifyLinkHeader(header)).toBeNull();
  });
});
