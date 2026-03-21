import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB (needed because shopify-crosslist imports normalizer which may chain)
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

const SHOPIFY_CONFIG = { apiVersion: '2024-01' };
const SHOP_DOMAIN = 'my-store.myshopify.com';
const ACCESS_TOKEN = 'shpat_test-token';

function buildTransformedListing(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Vintage Levi Jeans',
    description: 'Classic raw denim in great condition.',
    descriptionHtml: null,
    priceCents: 4999,
    quantity: 1,
    condition: 'GOOD',
    category: { externalCategoryId: 'cat-1', externalCategoryName: 'Jeans', path: ['Clothing', 'Jeans'] },
    brand: "Levi's",
    images: [
      { url: 'https://cdn.twicely.co/img1.jpg', sortOrder: 0, isPrimary: true },
      { url: 'https://cdn.twicely.co/img2.jpg', sortOrder: 1, isPrimary: false },
    ],
    itemSpecifics: { tags: 'vintage, denim', sku: 'SKU-001', barcode: '012345678901' },
    shipping: { type: 'FLAT' as const, flatRateCents: 800, weightOz: 16, dimensions: null, handlingTimeDays: 2 },
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

describe('toShopifyProductInput', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('maps title (truncated to 255 chars)', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const longTitle = 'A'.repeat(300);
    const result = toShopifyProductInput(buildTransformedListing({ title: longTitle }));
    expect(result.title).toHaveLength(255);
  });

  it('maps descriptionHtml to body_html when present', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const html = '<p>Nice jeans</p>';
    const result = toShopifyProductInput(buildTransformedListing({ descriptionHtml: html }));
    expect(result.body_html).toBe(html);
  });

  it('wraps description in <p> tags when descriptionHtml is null', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const result = toShopifyProductInput(buildTransformedListing({ descriptionHtml: null, description: 'Plain text' }));
    expect(result.body_html).toBe('<p>Plain text</p>');
  });

  it('truncates description text to 5000 chars', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const longDesc = 'B'.repeat(6000);
    const result = toShopifyProductInput(buildTransformedListing({ descriptionHtml: null, description: longDesc }));
    // body_html is <p>BBBBB...</p> — the inner text is 5000 chars
    expect(result.body_html).toBe(`<p>${'B'.repeat(5000)}</p>`);
  });

  it('maps brand to vendor (empty string when null)', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const withBrand = toShopifyProductInput(buildTransformedListing({ brand: 'Nike' }));
    expect(withBrand.vendor).toBe('Nike');

    const noBrand = toShopifyProductInput(buildTransformedListing({ brand: null }));
    expect(noBrand.vendor).toBe('');
  });

  it('maps category.externalCategoryName to product_type', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const result = toShopifyProductInput(buildTransformedListing({
      category: { externalCategoryId: 'c1', externalCategoryName: 'Sneakers', path: [] },
    }));
    expect(result.product_type).toBe('Sneakers');
  });

  it('maps itemSpecifics.tags to tags string', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const result = toShopifyProductInput(buildTransformedListing({ itemSpecifics: { tags: 'retro, 90s' } }));
    expect(result.tags).toBe('retro, 90s');
  });

  it('sets status to active', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const result = toShopifyProductInput(buildTransformedListing());
    expect(result.status).toBe('active');
  });

  it('converts priceCents to decimal string on variants[0].price', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const result = toShopifyProductInput(buildTransformedListing({ priceCents: 4999 }));
    expect(result.variants[0]?.price).toBe('49.99');
  });

  it('sets inventory_quantity from quantity', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const result = toShopifyProductInput(buildTransformedListing({ quantity: 5 }));
    expect(result.variants[0]?.inventory_quantity).toBe(5);
  });

  it('maps sku and barcode from itemSpecifics (null when absent)', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const withSpecifics = toShopifyProductInput(buildTransformedListing({
      itemSpecifics: { sku: 'ABC-123', barcode: '999' },
    }));
    expect(withSpecifics.variants[0]?.sku).toBe('ABC-123');
    expect(withSpecifics.variants[0]?.barcode).toBe('999');

    const noSpecifics = toShopifyProductInput(buildTransformedListing({ itemSpecifics: {} }));
    expect(noSpecifics.variants[0]?.sku).toBeNull();
    expect(noSpecifics.variants[0]?.barcode).toBeNull();
  });

  it('maps weightOz to weight with weight_unit oz (null when no weight)', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const withWeight = toShopifyProductInput(buildTransformedListing({
      shipping: { type: 'FLAT' as const, flatRateCents: 800, weightOz: 16, dimensions: null, handlingTimeDays: 2 },
    }));
    expect(withWeight.variants[0]?.weight).toBe(16);
    expect(withWeight.variants[0]?.weight_unit).toBe('oz');

    const noWeight = toShopifyProductInput(buildTransformedListing({
      shipping: { type: 'FREE' as const, flatRateCents: null, weightOz: null, dimensions: null, handlingTimeDays: 1 },
    }));
    expect(noWeight.variants[0]?.weight).toBeNull();
    expect(noWeight.variants[0]?.weight_unit).toBeNull();
  });

  it('limits images to 250, sorted by sortOrder, with 1-based positions', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const images = Array.from({ length: 12 }, (_, i) => ({
      url: `https://cdn.twicely.co/img${i}.jpg`,
      sortOrder: 11 - i, // reversed to test sorting
      isPrimary: i === 0,
    }));
    const result = toShopifyProductInput(buildTransformedListing({ images }));
    // Should be sorted by sortOrder 0..11, all 12 included (under 250 cap)
    expect(result.images).toHaveLength(12);
    expect(result.images[0]?.position).toBe(1);
    expect(result.images[11]?.position).toBe(12);
    // First image after sort should be sortOrder 0
    expect(result.images[0]?.src).toBe('https://cdn.twicely.co/img11.jpg');
  });

  it('creates condition metafield when condition is non-empty', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const result = toShopifyProductInput(buildTransformedListing({ condition: 'LIKE_NEW' }));
    expect(result.metafields).toHaveLength(1);
    expect(result.metafields?.[0]).toMatchObject({
      namespace: 'twicely', key: 'condition', value: 'LIKE_NEW', type: 'single_line_text_field',
    });
  });

  it('omits metafields when condition is empty', async () => {
    const { toShopifyProductInput } = await import('../shopify-crosslist');
    const result = toShopifyProductInput(buildTransformedListing({ condition: '' }));
    expect(result.metafields).toBeUndefined();
  });
});

describe('toShopifyPartialInput', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('includes only title when only title changed', async () => {
    const { toShopifyPartialInput } = await import('../shopify-crosslist');
    const result = toShopifyPartialInput({ title: 'New Title' });
    expect(result.title).toBe('New Title');
    expect(result.body_html).toBeUndefined();
    expect(result.vendor).toBeUndefined();
    expect(result.variants).toBeUndefined();
  });

  it('includes only body_html when only description changed', async () => {
    const { toShopifyPartialInput } = await import('../shopify-crosslist');
    const result = toShopifyPartialInput({ description: 'New description' });
    expect(result.body_html).toBe('<p>New description</p>');
    expect(result.title).toBeUndefined();
  });

  it('converts priceCents to decimal string in variants array', async () => {
    const { toShopifyPartialInput } = await import('../shopify-crosslist');
    const result = toShopifyPartialInput({ priceCents: 1999 });
    expect(result.variants?.[0]?.price).toBe('19.99');
    expect(result.title).toBeUndefined();
    expect(result.vendor).toBeUndefined();
  });

  it('includes only inventory_quantity when only quantity changed', async () => {
    const { toShopifyPartialInput } = await import('../shopify-crosslist');
    const result = toShopifyPartialInput({ quantity: 3 });
    expect(result.variants?.[0]?.inventory_quantity).toBe(3);
    expect(result.title).toBeUndefined();
  });

  it('maps brand to vendor', async () => {
    const { toShopifyPartialInput } = await import('../shopify-crosslist');
    const result = toShopifyPartialInput({ brand: 'Adidas' });
    expect(result.vendor).toBe('Adidas');
    expect(result.title).toBeUndefined();
  });

  it('maps images with correct 1-based positions', async () => {
    const { toShopifyPartialInput } = await import('../shopify-crosslist');
    const images = [
      { url: 'https://cdn.twicely.co/a.jpg', sortOrder: 1, isPrimary: false },
      { url: 'https://cdn.twicely.co/b.jpg', sortOrder: 0, isPrimary: true },
    ];
    const result = toShopifyPartialInput({ images });
    expect(result.images?.[0]?.src).toBe('https://cdn.twicely.co/b.jpg');
    expect(result.images?.[0]?.position).toBe(1);
    expect(result.images?.[1]?.position).toBe(2);
  });

  it('returns empty object when changes is empty (no short-circuit)', async () => {
    const { toShopifyPartialInput } = await import('../shopify-crosslist');
    const result = toShopifyPartialInput({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('maps category to product_type', async () => {
    const { toShopifyPartialInput } = await import('../shopify-crosslist');
    const result = toShopifyPartialInput({
      category: { externalCategoryId: 'c2', externalCategoryName: 'Boots', path: [] },
    });
    expect(result.product_type).toBe('Boots');
  });
});

describe('createShopifyProduct', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const minimalInput = {
    title: 'Test', body_html: '<p>Test</p>', vendor: '', product_type: '',
    tags: '', status: 'active' as const,
    variants: [{ price: '49.99', inventory_quantity: 1, sku: null, barcode: null, weight: null, weight_unit: null }],
    images: [],
  };

  it('POSTs to correct URL with X-Shopify-Access-Token header', async () => {
    const { createShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ product: { id: 123, handle: 'test', title: 'Test', status: 'active', variants: [] } }));
    await createShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, minimalInput);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://${SHOP_DOMAIN}/admin/api/2024-01/products.json`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Shopify-Access-Token': ACCESS_TOKEN }),
      }),
    );
  });

  it('returns success with productId and handle on 201', async () => {
    const { createShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ product: { id: 9876543210, handle: 'my-product', title: 'T', status: 'active', variants: [] } }, 201));
    const result = await createShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, minimalInput);
    expect(result.success).toBe(true);
    expect(result.productId).toBe('9876543210');
    expect(result.handle).toBe('my-product');
  });

  it('returns retryable: false on 401', async () => {
    const { createShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'Unauthorized' }, 401));
    const result = await createShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, minimalInput);
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns retryable: false on 422 with error message', async () => {
    const { createShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ errors: { title: ['is too short'] } }, 422));
    const result = await createShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, minimalInput);
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toBe('is too short');
  });

  it('returns retryable: true on 429', async () => {
    const { createShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'Rate limited' }, 429));
    const result = await createShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, minimalInput);
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('returns retryable: true on 500', async () => {
    const { createShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'Internal server error' }, 500));
    const result = await createShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, minimalInput);
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('returns retryable: true on 503', async () => {
    const { createShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({}, 503));
    const result = await createShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, minimalInput);
    expect(result.retryable).toBe(true);
  });

  it('returns retryable: true on network error', async () => {
    const { createShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await createShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, minimalInput);
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('sends JSON body with { product: input }', async () => {
    const { createShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ product: { id: 1, handle: 'h', title: 'T', status: 'active', variants: [] } }));
    await createShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, minimalInput);
    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string) as { product: typeof minimalInput };
    expect(body.product.title).toBe('Test');
  });
});

describe('updateShopifyProduct', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('PUTs to correct URL with product ID', async () => {
    const { updateShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ product: { id: 555 } }));
    await updateShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '555', { title: 'Updated' });
    expect(mockFetch).toHaveBeenCalledWith(
      `https://${SHOP_DOMAIN}/admin/api/2024-01/products/555.json`,
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('returns success on 200', async () => {
    const { updateShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ product: {} }));
    const result = await updateShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '555', {});
    expect(result.success).toBe(true);
  });

  it('returns retryable: false on 401', async () => {
    const { updateShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({}, 401));
    const result = await updateShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '555', {});
    expect(result.retryable).toBe(false);
    expect(result.success).toBe(false);
  });

  it('returns retryable: false on 422', async () => {
    const { updateShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ errors: { title: ['too long'] } }, 422));
    const result = await updateShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '555', {});
    expect(result.retryable).toBe(false);
  });

  it('returns retryable: true on 429', async () => {
    const { updateShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({}, 429));
    const result = await updateShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '555', {});
    expect(result.retryable).toBe(true);
  });

  it('returns retryable: true on network error', async () => {
    const { updateShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockRejectedValueOnce(new Error('timeout'));
    const result = await updateShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '555', {});
    expect(result.retryable).toBe(true);
  });
});

describe('deleteShopifyProduct', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sends DELETE to correct URL', async () => {
    const { deleteShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse(null, 200));
    await deleteShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '888');
    expect(mockFetch).toHaveBeenCalledWith(
      `https://${SHOP_DOMAIN}/admin/api/2024-01/products/888.json`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('returns success on 200', async () => {
    const { deleteShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse(null, 200));
    const result = await deleteShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '888');
    expect(result.success).toBe(true);
  });

  it('returns success on 404 (idempotent)', async () => {
    const { deleteShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ errors: 'Not found' }, 404));
    const result = await deleteShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '888');
    expect(result.success).toBe(true);
  });

  it('returns retryable: false on 401', async () => {
    const { deleteShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({}, 401));
    const result = await deleteShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '888');
    expect(result.retryable).toBe(false);
    expect(result.success).toBe(false);
  });

  it('returns retryable: true on 429', async () => {
    const { deleteShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({}, 429));
    const result = await deleteShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '888');
    expect(result.retryable).toBe(true);
  });

  it('returns retryable: true on network error', async () => {
    const { deleteShopifyProduct } = await import('../shopify-crosslist');
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));
    const result = await deleteShopifyProduct(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '888');
    expect(result.retryable).toBe(true);
    expect(result.success).toBe(false);
  });
});

describe('fetchShopifyProductForVerify', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function buildProductResponse(overrides: Record<string, unknown> = {}) {
    return {
      id: 1234567890,
      title: "Vintage Item",
      body_html: '<p>Description</p>',
      vendor: 'Brand',
      product_type: 'Jeans',
      status: 'active',
      tags: 'vintage',
      handle: 'vintage-item',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-06-01T12:00:00Z',
      published_at: '2024-01-15T10:30:00Z',
      variants: [
        { id: 1, product_id: 1234567890, title: 'Default', price: '49.99', sku: null, inventory_quantity: 2, weight: null, weight_unit: null, barcode: null },
      ],
      images: [],
      ...overrides,
    };
  }

  it('returns exists: true, status: ACTIVE for active product', async () => {
    const { fetchShopifyProductForVerify } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductResponse({ status: 'active' }) }));
    const result = await fetchShopifyProductForVerify(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '123');
    expect(result.exists).toBe(true);
    expect(result.status).toBe('ACTIVE');
  });

  it('returns exists: true, status: ENDED for archived product', async () => {
    const { fetchShopifyProductForVerify } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductResponse({ status: 'archived' }) }));
    const result = await fetchShopifyProductForVerify(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '123');
    expect(result.exists).toBe(true);
    expect(result.status).toBe('ENDED');
  });

  it('returns exists: true, status: ENDED for draft product (draft maps to ENDED)', async () => {
    const { fetchShopifyProductForVerify } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductResponse({ status: 'draft' }) }));
    const result = await fetchShopifyProductForVerify(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '123');
    expect(result.exists).toBe(true);
    expect(result.status).toBe('ENDED');
  });

  it('returns exists: false, status: REMOVED on 404', async () => {
    const { fetchShopifyProductForVerify } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ errors: 'Not found' }, 404));
    const result = await fetchShopifyProductForVerify(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '999');
    expect(result.exists).toBe(false);
    expect(result.status).toBe('REMOVED');
    expect(result.priceCents).toBeNull();
    expect(result.quantity).toBeNull();
    expect(result.lastModifiedAt).toBeNull();
  });

  it('parses priceCents from variant price string', async () => {
    const { fetchShopifyProductForVerify } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductResponse() }));
    const result = await fetchShopifyProductForVerify(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '123');
    expect(result.priceCents).toBe(4999);
  });

  it('sums quantity from all variants (min 1)', async () => {
    const { fetchShopifyProductForVerify } = await import('../shopify-crosslist');
    const product = buildProductResponse({
      variants: [
        { id: 1, product_id: 1, title: 'S', price: '10.00', sku: null, inventory_quantity: 3, weight: null, weight_unit: null, barcode: null },
        { id: 2, product_id: 1, title: 'M', price: '10.00', sku: null, inventory_quantity: 5, weight: null, weight_unit: null, barcode: null },
      ],
    });
    mockFetch.mockResolvedValueOnce(makeResponse({ product }));
    const result = await fetchShopifyProductForVerify(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '123');
    expect(result.quantity).toBe(8);
  });

  it('parses lastModifiedAt from updated_at ISO string', async () => {
    const { fetchShopifyProductForVerify } = await import('../shopify-crosslist');
    const updatedAt = '2024-06-01T12:00:00Z';
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductResponse({ updated_at: updatedAt }) }));
    const result = await fetchShopifyProductForVerify(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '123');
    expect(result.lastModifiedAt).toBeInstanceOf(Date);
    expect(result.lastModifiedAt?.toISOString()).toBe(new Date(updatedAt).toISOString());
  });

  it('returns lastModifiedAt: null when updated_at is invalid', async () => {
    const { fetchShopifyProductForVerify } = await import('../shopify-crosslist');
    mockFetch.mockResolvedValueOnce(makeResponse({ product: buildProductResponse({ updated_at: 'not-a-date' }) }));
    const result = await fetchShopifyProductForVerify(SHOPIFY_CONFIG, SHOP_DOMAIN, ACCESS_TOKEN, '123');
    expect(result.lastModifiedAt).toBeNull();
  });
});
