import { describe, it, expect } from 'vitest';
import { normalizeDepopListing, parseDepopPrice } from '../depop-normalizer';
import type { DepopProduct } from '../depop-types';

function buildProduct(overrides: Partial<DepopProduct> = {}): DepopProduct {
  return {
    id: 'depop-prod-555',
    slug: 'vintage-levi-501-jeans-w32-l30',
    description: 'Classic Levi\'s 501 jeans in excellent condition.',
    price: { price_amount: '45.00', currency_name: 'USD' },
    status: 'active',
    condition: 'like_new',
    category: { id: 3, name: 'Jeans' },
    brand: { id: 10, name: "Levi's" },
    pictures: [
      { id: 1, url: 'https://d2h2ings7v5y7r.cloudfront.net/img1.jpg' },
      { id: 2, url: 'https://d2h2ings7v5y7r.cloudfront.net/img2.jpg' },
    ],
    created_at: '2024-04-15T12:00:00Z',
    size: 'W32 L30',
    color1: 'Blue',
    national_shipping_cost: '4.99',
    ...overrides,
  };
}

describe('parseDepopPrice', () => {
  it('converts decimal string to integer cents', () => {
    expect(parseDepopPrice('25.00')).toBe(2500);
  });

  it('handles whole dollar amounts', () => {
    expect(parseDepopPrice('45')).toBe(4500);
  });

  it('handles zero', () => {
    expect(parseDepopPrice('0')).toBe(0);
  });

  it('handles invalid string as 0', () => {
    expect(parseDepopPrice('abc')).toBe(0);
  });

  it('handles negative as 0', () => {
    expect(parseDepopPrice('-5.00')).toBe(0);
  });

  it('rounds fractional amounts', () => {
    expect(parseDepopPrice('9.99')).toBe(999);
  });
});

describe('normalizeDepopListing', () => {
  it('maps externalId from id', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.externalId).toBe('depop-prod-555');
  });

  it('generates title from slug', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.title).toBe('Vintage Levi 501 Jeans W32 L30');
  });

  it('uses id in title when slug is absent', () => {
    const result = normalizeDepopListing(buildProduct({ slug: undefined }));
    expect(result.title).toContain('depop-prod-555');
  });

  it('parses price_amount string to integer cents', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.priceCents).toBe(4500);
  });

  it('uses currency_name as currencyCode', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.currencyCode).toBe('USD');
  });

  it('maps brand_new condition to NEW_WITHOUT_TAGS', () => {
    const result = normalizeDepopListing(buildProduct({ condition: 'brand_new' }));
    expect(result.condition).toBe('NEW_WITHOUT_TAGS');
  });

  it('maps like_new condition to LIKE_NEW', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.condition).toBe('LIKE_NEW');
  });

  it('maps good condition to GOOD', () => {
    const result = normalizeDepopListing(buildProduct({ condition: 'good' }));
    expect(result.condition).toBe('GOOD');
  });

  it('maps fair condition to ACCEPTABLE', () => {
    const result = normalizeDepopListing(buildProduct({ condition: 'fair' }));
    expect(result.condition).toBe('ACCEPTABLE');
  });

  it('returns null for unknown condition', () => {
    const result = normalizeDepopListing(buildProduct({ condition: 'vintage' }));
    expect(result.condition).toBeNull();
  });

  it('extracts brand name', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.brand).toBe("Levi's");
  });

  it('sets brand to null when absent', () => {
    const result = normalizeDepopListing(buildProduct({ brand: undefined }));
    expect(result.brand).toBeNull();
  });

  it('maps pictures with first as primary', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toEqual({
      url: 'https://d2h2ings7v5y7r.cloudfront.net/img1.jpg',
      isPrimary: true,
      sortOrder: 0,
    });
  });

  it('limits images to 4 (Depop max)', () => {
    const manyPictures = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      url: `https://example.com/img${i}.jpg`,
    }));
    const result = normalizeDepopListing(buildProduct({ pictures: manyPictures }));
    expect(result.images).toHaveLength(4);
  });

  it('handles missing pictures gracefully', () => {
    const result = normalizeDepopListing(buildProduct({ pictures: undefined }));
    expect(result.images).toHaveLength(0);
  });

  it('maps active status to ACTIVE', () => {
    const result = normalizeDepopListing(buildProduct({ status: 'active' }));
    expect(result.status).toBe('ACTIVE');
  });

  it('maps sold status to SOLD', () => {
    const result = normalizeDepopListing(buildProduct({ status: 'sold' }));
    expect(result.status).toBe('SOLD');
  });

  it('maps deleted status to ENDED', () => {
    const result = normalizeDepopListing(buildProduct({ status: 'deleted' }));
    expect(result.status).toBe('ENDED');
  });

  it('maps draft status to DRAFT', () => {
    const result = normalizeDepopListing(buildProduct({ status: 'draft' }));
    expect(result.status).toBe('DRAFT');
  });

  it('extracts category name', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.category).toBe('Jeans');
  });

  it('parses listedAt from created_at', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.listedAt).toBeInstanceOf(Date);
  });

  it('parses soldAt when present', () => {
    const result = normalizeDepopListing(buildProduct({ sold_at: '2024-06-01T00:00:00Z', status: 'sold' }));
    expect(result.soldAt).toBeInstanceOf(Date);
  });

  it('parses national_shipping_cost as shippingPriceCents', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.shippingType).toBe('FLAT');
    expect(result.shippingPriceCents).toBe(499);
  });

  it('sets shippingType FREE when cost is 0', () => {
    const result = normalizeDepopListing(buildProduct({ national_shipping_cost: '0' }));
    expect(result.shippingType).toBe('FREE');
    expect(result.shippingPriceCents).toBeNull();
  });

  it('stores size and color in itemSpecifics', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.itemSpecifics['size']).toBe('W32 L30');
    expect(result.itemSpecifics['color1']).toBe('Blue');
  });

  it('quantity is always 1', () => {
    const result = normalizeDepopListing(buildProduct());
    expect(result.quantity).toBe(1);
  });
});
