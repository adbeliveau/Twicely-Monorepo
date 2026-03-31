import { describe, it, expect, vi } from 'vitest';

// Mock all channel-specific normalizers
vi.mock('@twicely/crosslister/connectors/ebay-normalizer', () => ({
  normalizeEbayListing: vi.fn().mockReturnValue({ externalId: 'ebay-1', title: 'eBay Item' }),
  toExternalListing: vi.fn().mockImplementation((d) => ({
    ...d,
    priceCents: 1000,
    currencyCode: 'USD',
    quantity: 1,
    condition: null,
    category: null,
    brand: null,
    images: [],
    itemSpecifics: {},
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
    url: 'https://ebay.com',
    status: 'ACTIVE',
    listedAt: null,
    soldAt: null,
    description: '',
  })),
}));

vi.mock('@twicely/crosslister/connectors/poshmark-normalizer', () => ({
  normalizePoshmarkListing: vi.fn().mockReturnValue({ externalId: 'pm-1', title: 'Poshmark Item' }),
  toExternalListing: vi.fn().mockImplementation((d) => ({
    ...d,
    priceCents: 2500,
    currencyCode: 'USD',
    quantity: 1,
    condition: null,
    category: null,
    brand: null,
    images: [],
    itemSpecifics: {},
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
    url: 'https://poshmark.com/listing/pm-1',
    status: 'ACTIVE',
    listedAt: null,
    soldAt: null,
    description: '',
  })),
}));

vi.mock('@twicely/crosslister/connectors/mercari-normalizer', () => ({
  normalizeMercariListing: vi.fn().mockReturnValue({ externalId: 'mc-1', title: 'Mercari Item' }),
  toExternalListing: vi.fn().mockImplementation((d) => ({
    ...d,
    priceCents: 5000,
    currencyCode: 'USD',
    quantity: 1,
    condition: null,
    category: null,
    brand: null,
    images: [],
    itemSpecifics: {},
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
    url: 'https://www.mercari.com/us/item/mc-1/',
    status: 'ACTIVE',
    listedAt: null,
    soldAt: null,
    description: '',
  })),
}));

vi.mock('@twicely/crosslister/connectors/whatnot-normalizer', () => ({
  normalizeWhatnotListing: vi.fn().mockReturnValue({ externalId: 'wn-1', title: 'Whatnot Item' }),
  toExternalListing: vi.fn().mockImplementation((d) => ({
    ...d,
    priceCents: 4999,
    currencyCode: 'USD',
    quantity: 1,
    condition: null,
    category: null,
    brand: null,
    images: [],
    itemSpecifics: {},
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
    url: 'https://www.whatnot.com/listings/wn-1',
    status: 'ACTIVE',
    listedAt: null,
    soldAt: null,
    description: '',
  })),
}));

vi.mock('@twicely/crosslister/connectors/shopify-normalizer', () => ({
  normalizeShopifyProduct: vi.fn().mockReturnValue({ externalId: 'shopify-1', title: 'Shopify Item' }),
  toExternalListing: vi.fn().mockImplementation((d) => ({
    ...d,
    priceCents: 8999,
    currencyCode: 'USD',
    quantity: 1,
    condition: null,
    category: 'Jeans',
    brand: "Levi's",
    images: [],
    itemSpecifics: {},
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
    url: 'https://my-store.myshopify.com/products/test',
    status: 'ACTIVE',
    listedAt: null,
    soldAt: null,
    description: 'Classic denim',
  })),
}));

vi.mock('@twicely/crosslister/connectors/vestiaire-normalizer', () => ({
  normalizeVestiaireListing: vi.fn().mockReturnValue({ externalId: 'vc-1', title: 'Vestiaire Item' }),
  toExternalListing: vi.fn().mockImplementation((d) => ({
    ...d,
    priceCents: 35000,
    currencyCode: 'EUR',
    quantity: 1,
    condition: 'VERY_GOOD',
    category: 'Handbags',
    brand: 'Chanel',
    images: [],
    itemSpecifics: {},
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
    url: 'https://www.vestiairecollective.com/products/p-vc-1.html',
    status: 'ACTIVE',
    listedAt: null,
    soldAt: null,
    description: 'Luxury handbag',
  })),
}));

describe('normalizeExternalListing', () => {
  it('dispatches to eBay normalizer for channel EBAY', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    const { normalizeEbayListing } = await import('@twicely/crosslister/connectors/ebay-normalizer');

    const raw = { sku: 'SKU-001' };
    normalizeExternalListing(raw as Record<string, unknown>, 'EBAY');

    expect(normalizeEbayListing).toHaveBeenCalledWith(raw);
  });

  it('dispatches to Poshmark normalizer for channel POSHMARK', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    const { normalizePoshmarkListing } = await import('@twicely/crosslister/connectors/poshmark-normalizer');

    const raw = { id: 'pm-1', title: 'Test' };
    normalizeExternalListing(raw as Record<string, unknown>, 'POSHMARK');

    expect(normalizePoshmarkListing).toHaveBeenCalledWith(raw);
  });

  it('dispatches to Mercari normalizer for channel MERCARI', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    const { normalizeMercariListing } = await import('@twicely/crosslister/connectors/mercari-normalizer');

    const raw = { id: 'mc-1', name: 'Test' };
    normalizeExternalListing(raw as Record<string, unknown>, 'MERCARI');

    expect(normalizeMercariListing).toHaveBeenCalledWith(raw);
  });

  it('throws for unsupported channel (UNKNOWN)', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    expect(() =>
      normalizeExternalListing({}, 'UNKNOWN' as never),
    ).toThrow('No normalizer for channel: UNKNOWN');
  });

  it('returns valid ExternalListing shape for POSHMARK', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    const result = normalizeExternalListing({ id: 'pm-1' }, 'POSHMARK');
    expect(result).toHaveProperty('externalId');
    expect(result).toHaveProperty('priceCents');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('images');
  });

  it('returns valid ExternalListing shape for MERCARI', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    const result = normalizeExternalListing({ id: 'mc-1' }, 'MERCARI');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('externalId');
    expect(result).toHaveProperty('priceCents');
    expect(result!.priceCents).toBe(5000);
  });

  it('dispatches to Shopify normalizer for SHOPIFY channel', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    const { normalizeShopifyProduct } = await import('@twicely/crosslister/connectors/shopify-normalizer');

    // Valid Shopify product data that passes ShopifyProductSchema
    const raw = {
      id: 1234567890,
      title: 'Test Product',
      body_html: '<p>Description</p>',
      vendor: 'Nike',
      product_type: 'Shoes',
      status: 'active',
      tags: 'shoes, sneakers',
      handle: 'test-product',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      variants: [],
      images: [],
    };

    const result = normalizeExternalListing(raw as Record<string, unknown>, 'SHOPIFY');
    expect(normalizeShopifyProduct).toHaveBeenCalled();
    expect(result).not.toBeNull();
  });

  it('dispatches to Whatnot normalizer for WHATNOT channel', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    const { normalizeWhatnotListing } = await import('@twicely/crosslister/connectors/whatnot-normalizer');

    // Valid Whatnot listing data that passes WhatnotListingSchema
    const raw = {
      id: 'listing-wn-1',
      title: 'Test Whatnot Item',
      status: 'PUBLISHED',
    };

    const result = normalizeExternalListing(raw as Record<string, unknown>, 'WHATNOT');
    expect(normalizeWhatnotListing).toHaveBeenCalled();
    expect(result).not.toBeNull();
  });

  it('returns null for invalid Shopify product data', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    // Missing required fields — will fail ShopifyProductSchema
    const result = normalizeExternalListing({}, 'SHOPIFY');
    expect(result).toBeNull();
  });

  it('returns null for invalid Whatnot listing data', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    // Whatnot schema requires id to be a string — number should fail
    const result = normalizeExternalListing({ id: 99999 }, 'WHATNOT');
    // WhatnotListingSchema has id: z.string() — numeric id fails
    expect(result).toBeNull();
  });

  it('dispatches to Vestiaire normalizer for VESTIAIRE channel', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    const { normalizeVestiaireListing } = await import('@twicely/crosslister/connectors/vestiaire-normalizer');
    const raw = { id: 'vc-1', title: 'Chanel Bag' };
    const result = normalizeExternalListing(raw as Record<string, unknown>, 'VESTIAIRE');
    expect(normalizeVestiaireListing).toHaveBeenCalled();
    expect(result).not.toBeNull();
  });

  it('returns null for invalid Vestiaire listing data', async () => {
    const { normalizeExternalListing } = await import('../normalizer-dispatch');
    // VestiaireListingSchema requires id to be a string — missing id fails
    const result = normalizeExternalListing({}, 'VESTIAIRE');
    expect(result).toBeNull();
  });
});
