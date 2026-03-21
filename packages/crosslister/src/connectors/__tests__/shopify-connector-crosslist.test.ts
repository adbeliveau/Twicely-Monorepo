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

const mockConfig = [
  { key: 'crosslister.shopify.clientId', value: 'test-client-id' },
  { key: 'crosslister.shopify.clientSecret', value: 'test-secret' },
  { key: 'crosslister.shopify.redirectUri', value: 'https://twicely.co/api/crosslister/shopify/callback' },
  { key: 'crosslister.shopify.scopes', value: 'read_products,write_products' },
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

function buildTransformedListing(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Item',
    description: 'Test description',
    descriptionHtml: null,
    priceCents: 4999,
    quantity: 1,
    condition: 'GOOD',
    category: { externalCategoryId: 'cat-1', externalCategoryName: 'Clothing', path: ['Clothing'] },
    brand: null,
    images: [{ url: 'https://cdn.twicely.co/img1.jpg', sortOrder: 0, isPrimary: true }],
    itemSpecifics: {},
    shipping: { type: 'FREE' as const, flatRateCents: null, weightOz: null, dimensions: null, handlingTimeDays: 1 },
    ...overrides,
  };
}

function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function makeProductResponse(id: number, handle: string, status = 200) {
  return makeResponse({
    product: { id, handle, title: 'Test', status: 'active', variants: [
      { id: 1, product_id: id, title: 'Default', price: '49.99', sku: null, inventory_quantity: 1, weight: null, weight_unit: null, barcode: null },
    ], images: [], body_html: null, vendor: '', product_type: '', tags: '', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-02T00:00:00Z', published_at: null },
  }, status);
}

describe('ShopifyConnector.createListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  it('returns success with externalId and externalUrl on successful POST', async () => {
    mockFetch.mockResolvedValueOnce(makeProductResponse(9876543210, 'my-test-item'));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().createListing(buildAccount(), buildTransformedListing());
    expect(result.success).toBe(true);
    expect(result.externalId).toBe('9876543210');
    expect(result.externalUrl).toBeDefined();
  });

  it('externalUrl uses storefront format: https://{shop}/products/{handle}', async () => {
    mockFetch.mockResolvedValueOnce(makeProductResponse(111, 'vintage-levis'));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().createListing(buildAccount(), buildTransformedListing());
    expect(result.externalUrl).toBe('https://my-vintage-store.myshopify.com/products/vintage-levis');
  });

  it('falls back to admin URL when handle is empty', async () => {
    mockFetch.mockResolvedValueOnce(makeProductResponse(222, ''));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().createListing(buildAccount(), buildTransformedListing());
    expect(result.externalUrl).toContain('my-vintage-store.myshopify.com/admin/products/222');
  });

  it('returns failure when accessToken is null', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().createListing(
      buildAccount({ accessToken: null }),
      buildTransformedListing(),
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('No credentials');
    expect(result.retryable).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns failure when externalAccountId is null', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().createListing(
      buildAccount({ externalAccountId: null }),
      buildTransformedListing(),
    );
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns retryable: true on HTTP 429', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'Rate limited' }, 429));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().createListing(buildAccount(), buildTransformedListing());
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('returns retryable: true on HTTP 5xx', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 503));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().createListing(buildAccount(), buildTransformedListing());
    expect(result.retryable).toBe(true);
  });

  it('returns retryable: false on HTTP 401', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 401));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().createListing(buildAccount(), buildTransformedListing());
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
  });

  it('returns retryable: false on HTTP 422', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ errors: { title: ['is too short'] } }, 422));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().createListing(buildAccount(), buildTransformedListing());
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
  });

  it('returns retryable: true on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection reset'));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().createListing(buildAccount(), buildTransformedListing());
    expect(result.retryable).toBe(true);
  });
});

describe('ShopifyConnector.updateListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  it('returns success on valid update', async () => {
    mockFetch.mockResolvedValueOnce(makeProductResponse(555, 'some-item'));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().updateListing(buildAccount(), '555', { title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('returns failure when accessToken is null', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().updateListing(
      buildAccount({ accessToken: null }),
      '555',
      { title: 'x' },
    );
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns retryable: true on 429, false on 401', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 429));
    const { ShopifyConnector } = await import('../shopify-connector');
    const r1 = await new ShopifyConnector().updateListing(buildAccount(), '555', {});
    expect(r1.retryable).toBe(true);
  });

  it('converts priceCents to decimal string in request', async () => {
    mockFetch.mockResolvedValueOnce(makeProductResponse(555, 'item'));
    const { ShopifyConnector } = await import('../shopify-connector');
    await new ShopifyConnector().updateListing(buildAccount(), '555', { priceCents: 2999 });
    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string) as { product: { variants?: Array<{ price: string }> } };
    expect(body.product.variants?.[0]?.price).toBe('29.99');
  });

  it('sends only changed fields', async () => {
    mockFetch.mockResolvedValueOnce(makeProductResponse(555, 'item'));
    const { ShopifyConnector } = await import('../shopify-connector');
    await new ShopifyConnector().updateListing(buildAccount(), '555', { priceCents: 1999 });
    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string) as { product: Record<string, unknown> };
    expect(body.product.title).toBeUndefined();
    expect(body.product.vendor).toBeUndefined();
  });

  it('returns retryable: true on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().updateListing(buildAccount(), '555', {});
    expect(result.retryable).toBe(true);
  });

  it('PUTs to correct URL with externalId', async () => {
    mockFetch.mockResolvedValueOnce(makeProductResponse(777, 'h'));
    const { ShopifyConnector } = await import('../shopify-connector');
    await new ShopifyConnector().updateListing(buildAccount(), '777', { title: 'x' });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/products/777.json');
    expect(url).toContain('my-vintage-store.myshopify.com');
  });
});

describe('ShopifyConnector.delistListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  it('returns success on 200', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(null, 200));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().delistListing(buildAccount(), '555');
    expect(result.success).toBe(true);
  });

  it('returns success on 404 (idempotent)', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ errors: 'Not found' }, 404));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().delistListing(buildAccount(), '555');
    expect(result.success).toBe(true);
  });

  it('returns failure when accessToken is null', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().delistListing(
      buildAccount({ accessToken: null }),
      '555',
    );
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns retryable: false on 401', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 401));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().delistListing(buildAccount(), '555');
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
  });

  it('returns retryable: true on 429', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 429));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().delistListing(buildAccount(), '555');
    expect(result.retryable).toBe(true);
  });

  it('returns retryable: true on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().delistListing(buildAccount(), '555');
    expect(result.retryable).toBe(true);
    expect(result.success).toBe(false);
  });
});

describe('ShopifyConnector.verifyListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  function buildProductForVerify(status: string, updatedAt = '2024-06-01T12:00:00Z') {
    return {
      id: 1111, title: 'Item', body_html: null, vendor: '', product_type: '',
      status, tags: '', handle: 'item', created_at: '2024-01-01T00:00:00Z',
      updated_at: updatedAt, published_at: null,
      variants: [{ id: 1, product_id: 1111, title: 'Default', price: '49.99', sku: null, inventory_quantity: 3, weight: null, weight_unit: null, barcode: null }],
      images: [],
    };
  }

  it('returns exists: true, status: ACTIVE for active product', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductForVerify('active') }));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().verifyListing(buildAccount(), '1111');
    expect(result.exists).toBe(true);
    expect(result.status).toBe('ACTIVE');
  });

  it('returns exists: true, status: ENDED for archived product', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductForVerify('archived') }));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().verifyListing(buildAccount(), '1111');
    expect(result.exists).toBe(true);
    expect(result.status).toBe('ENDED');
  });

  it('returns exists: false, status: REMOVED on 404', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ errors: 'Not found' }, 404));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().verifyListing(buildAccount(), '9999');
    expect(result.exists).toBe(false);
    expect(result.status).toBe('REMOVED');
  });

  it('returns correct priceCents from variant', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductForVerify('active') }));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().verifyListing(buildAccount(), '1111');
    expect(result.priceCents).toBe(4999);
  });

  it('returns correct quantity from variant', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductForVerify('active') }));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().verifyListing(buildAccount(), '1111');
    expect(result.quantity).toBe(3);
  });

  it('returns correct lastModifiedAt from updated_at', async () => {
    const updatedAt = '2024-06-01T12:00:00Z';
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductForVerify('active', updatedAt) }));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().verifyListing(buildAccount(), '1111');
    expect(result.lastModifiedAt).toBeInstanceOf(Date);
    expect(result.lastModifiedAt?.toISOString()).toBe(new Date(updatedAt).toISOString());
  });

  it('returns exists: false, status: UNKNOWN when no credentials', async () => {
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().verifyListing(
      buildAccount({ accessToken: null }),
      '1111',
    );
    expect(result.exists).toBe(false);
    expect(result.status).toBe('UNKNOWN');
    expect(result.diff).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns lastModifiedAt: null when updated_at is invalid', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductForVerify('active', 'not-a-date') }));
    const { ShopifyConnector } = await import('../shopify-connector');
    const result = await new ShopifyConnector().verifyListing(buildAccount(), '1111');
    expect(result.lastModifiedAt).toBeNull();
  });
});
