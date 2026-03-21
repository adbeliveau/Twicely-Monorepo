import { describe, it, expect } from 'vitest';
import {
  normalizeShopifyProduct,
  toExternalListing,
  parseShopifyPrice,
  mapShopifyStatus,
  stripHtml,
  convertWeightToGrams,
} from '../shopify-normalizer';
import type { ShopifyProductParsed } from '../shopify-schemas';

function buildShopifyProduct(overrides: Partial<ShopifyProductParsed> = {}): ShopifyProductParsed {
  return {
    id: 1234567890,
    title: "Vintage Levi's 501",
    body_html: '<p>Classic raw denim jeans</p>',
    vendor: "Levi's",
    product_type: 'Jeans',
    status: 'active',
    tags: 'vintage, denim, levi',
    handle: 'vintage-levis-501',
    created_at: '2024-01-15T10:30:00-05:00',
    updated_at: '2024-03-01T14:22:00-05:00',
    published_at: '2024-01-15T10:30:00-05:00',
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

describe('normalizeShopifyProduct', () => {
  it('normalizes Shopify product to ExternalListing shape', () => {
    const raw = buildShopifyProduct();
    const normalized = normalizeShopifyProduct(raw, 'my-store.myshopify.com');
    const external = toExternalListing(normalized);

    expect(external.externalId).toBe('1234567890');
    expect(external.title).toBe("Vintage Levi's 501");
    expect(external.priceCents).toBe(8999);
    expect(external.currencyCode).toBe('USD');
    expect(external.quantity).toBe(1);
    expect(external.condition).toBeNull();
    expect(external.soldAt).toBeNull();
  });

  it('strips HTML from body_html to produce plain text description', () => {
    const raw = buildShopifyProduct({ body_html: '<p>Some <b>bold</b> text</p>' });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.description).toBe('Some bold text');
  });

  it('handles null body_html as empty string', () => {
    const raw = buildShopifyProduct({ body_html: null });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.description).toBe('');
  });

  it('maps first variant price to integer cents', () => {
    const raw = buildShopifyProduct({
      variants: [
        { id: 1, product_id: 1234567890, title: 'S', price: '29.99', sku: null, inventory_quantity: 2, weight: null, weight_unit: null, barcode: null },
        { id: 2, product_id: 1234567890, title: 'M', price: '39.99', sku: null, inventory_quantity: 3, weight: null, weight_unit: null, barcode: null },
      ],
    });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.priceCents).toBe(2999);
  });

  it('sums inventory_quantity across all variants', () => {
    const raw = buildShopifyProduct({
      variants: [
        { id: 1, product_id: 1, title: 'S', price: '10.00', sku: null, inventory_quantity: 3, weight: null, weight_unit: null, barcode: null },
        { id: 2, product_id: 1, title: 'M', price: '10.00', sku: null, inventory_quantity: 5, weight: null, weight_unit: null, barcode: null },
        { id: 3, product_id: 1, title: 'L', price: '10.00', sku: null, inventory_quantity: 2, weight: null, weight_unit: null, barcode: null },
      ],
    });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.quantity).toBe(10);
  });

  it('defaults quantity to 1 when variant sum is 0', () => {
    const raw = buildShopifyProduct({
      variants: [
        { id: 1, product_id: 1, title: 'S', price: '10.00', sku: null, inventory_quantity: 0, weight: null, weight_unit: null, barcode: null },
      ],
    });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.quantity).toBe(1);
  });

  it('handles product with no variants — price 0, quantity 1', () => {
    const raw = buildShopifyProduct({ variants: [] });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.priceCents).toBe(0);
    expect(normalized.quantity).toBe(1);
    expect(normalized.weight).toBeNull();
  });

  it('maps vendor to brand field', () => {
    const raw = buildShopifyProduct({ vendor: 'Nike' });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.brand).toBe('Nike');
  });

  it('returns null brand for empty vendor', () => {
    const raw = buildShopifyProduct({ vendor: '' });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.brand).toBeNull();
  });

  it('maps product_type to category field', () => {
    const raw = buildShopifyProduct({ product_type: 'Sneakers' });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.category).toBe('Sneakers');
  });

  it('returns null category for empty product_type', () => {
    const raw = buildShopifyProduct({ product_type: '' });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.category).toBeNull();
  });

  it('sorts images by position, first is primary', () => {
    const raw = buildShopifyProduct({
      images: [
        { id: 3, product_id: 1, position: 3, src: 'https://cdn.shopify.com/img3.jpg', width: null, height: null, alt: null },
        { id: 1, product_id: 1, position: 1, src: 'https://cdn.shopify.com/img1.jpg', width: null, height: null, alt: null },
        { id: 2, product_id: 1, position: 2, src: 'https://cdn.shopify.com/img2.jpg', width: null, height: null, alt: null },
      ],
    });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.images).toHaveLength(3);
    expect(normalized.images[0]?.url).toBe('https://cdn.shopify.com/img1.jpg');
    expect(normalized.images[0]?.isPrimary).toBe(true);
    expect(normalized.images[1]?.isPrimary).toBe(false);
    expect(normalized.images[2]?.isPrimary).toBe(false);
    expect(normalized.images[0]?.sortOrder).toBe(0);
    expect(normalized.images[1]?.sortOrder).toBe(1);
    expect(normalized.images[2]?.sortOrder).toBe(2);
  });

  it('handles product with no images — empty array', () => {
    const raw = buildShopifyProduct({ images: [] });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.images).toHaveLength(0);
  });

  it('puts tags into itemSpecifics.tags', () => {
    const raw = buildShopifyProduct({ tags: 'vintage, denim' });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.itemSpecifics['tags']).toBe('vintage, denim');
  });

  it('puts sku and barcode into itemSpecifics when present', () => {
    const raw = buildShopifyProduct({
      variants: [
        { id: 1, product_id: 1, title: 'Default', price: '10.00', sku: 'SKU-001', inventory_quantity: 1, weight: null, weight_unit: null, barcode: '012345678901' },
      ],
    });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.itemSpecifics['sku']).toBe('SKU-001');
    expect(normalized.itemSpecifics['barcode']).toBe('012345678901');
  });

  it('builds correct product URL when shopDomain provided', () => {
    const raw = buildShopifyProduct({ handle: 'vintage-levis-501' });
    const normalized = normalizeShopifyProduct(raw, 'my-store.myshopify.com');
    expect(normalized.url).toBe('https://my-store.myshopify.com/products/vintage-levis-501');
  });

  it('uses empty URL when shopDomain not provided', () => {
    const raw = buildShopifyProduct({ handle: 'vintage-levis-501' });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.url).toBe('');
  });

  it('parses created_at as listedAt date', () => {
    const raw = buildShopifyProduct({ created_at: '2024-01-15T10:30:00Z' });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.listedAt).toBeInstanceOf(Date);
    expect(normalized.listedAt?.toISOString()).toBe(new Date('2024-01-15T10:30:00Z').toISOString());
  });

  it('converts numeric product ID to string externalId', () => {
    const raw = buildShopifyProduct({ id: 9876543210 });
    const normalized = normalizeShopifyProduct(raw);
    expect(normalized.externalId).toBe('9876543210');
    expect(typeof normalized.externalId).toBe('string');
  });
});

describe('parseShopifyPrice', () => {
  it('parses "29.99" to 2999', () => {
    expect(parseShopifyPrice('29.99')).toBe(2999);
  });

  it('parses "100.00" to 10000', () => {
    expect(parseShopifyPrice('100.00')).toBe(10000);
  });

  it('parses "0.99" to 99', () => {
    expect(parseShopifyPrice('0.99')).toBe(99);
  });

  it('parses "0" to 0', () => {
    expect(parseShopifyPrice('0')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parseShopifyPrice('')).toBe(0);
  });

  it('returns 0 for NaN input', () => {
    expect(parseShopifyPrice('not-a-number')).toBe(0);
  });
});

describe('mapShopifyStatus', () => {
  it('maps active to ACTIVE', () => {
    expect(mapShopifyStatus('active')).toBe('ACTIVE');
  });

  it('maps draft to DRAFT', () => {
    expect(mapShopifyStatus('draft')).toBe('DRAFT');
  });

  it('maps archived to ENDED', () => {
    expect(mapShopifyStatus('archived')).toBe('ENDED');
  });

  it('maps unknown status to ENDED', () => {
    expect(mapShopifyStatus('unknown-status')).toBe('ENDED');
  });
});

describe('stripHtml', () => {
  it('strips HTML tags leaving plain text', () => {
    expect(stripHtml('<p>Some <b>bold</b> text</p>')).toBe('Some bold text');
  });

  it('trims surrounding whitespace', () => {
    expect(stripHtml('  hello  ')).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });
});

describe('toExternalListing', () => {
  it('converts ShopifyNormalizedData to ExternalListing with all fields', () => {
    const raw = buildShopifyProduct();
    const normalized = normalizeShopifyProduct(raw, 'my-store.myshopify.com');
    const external = toExternalListing(normalized);

    expect(external).toHaveProperty('externalId');
    expect(external).toHaveProperty('title');
    expect(external).toHaveProperty('description');
    expect(external).toHaveProperty('priceCents');
    expect(external).toHaveProperty('currencyCode');
    expect(external).toHaveProperty('quantity');
    expect(external).toHaveProperty('condition');
    expect(external).toHaveProperty('category');
    expect(external).toHaveProperty('brand');
    expect(external).toHaveProperty('images');
    expect(external).toHaveProperty('itemSpecifics');
    expect(external).toHaveProperty('shippingType');
    expect(external).toHaveProperty('shippingPriceCents');
    expect(external).toHaveProperty('weight');
    expect(external).toHaveProperty('dimensions');
    expect(external).toHaveProperty('url');
    expect(external).toHaveProperty('status');
    expect(external).toHaveProperty('listedAt');
    expect(external).toHaveProperty('soldAt');
  });
});

describe('convertWeightToGrams', () => {
  it('converts lb to grams — 2.5 lb ~ 1134g', () => {
    expect(convertWeightToGrams(2.5, 'lb')).toBe(1134);
  });

  it('converts oz to grams — 16 oz ~ 454g', () => {
    expect(convertWeightToGrams(16, 'oz')).toBe(454);
  });

  it('converts kg to grams — 1.5 kg = 1500g', () => {
    expect(convertWeightToGrams(1.5, 'kg')).toBe(1500);
  });

  it('passes g through unchanged', () => {
    expect(convertWeightToGrams(250, 'g')).toBe(250);
  });

  it('returns null for null weight', () => {
    expect(convertWeightToGrams(null, 'lb')).toBeNull();
  });

  it('returns null for zero weight', () => {
    expect(convertWeightToGrams(0, 'lb')).toBeNull();
  });

  it('treats null unit as grams', () => {
    expect(convertWeightToGrams(300, null)).toBe(300);
  });
});
