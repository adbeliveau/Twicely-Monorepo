import { describe, it, expect } from 'vitest';
import {
  normalizeVestiaireListing,
  toExternalListing,
  parseVestiairePrice,
} from '../vestiaire-normalizer';
import type { VestiaireListing } from '../vestiaire-types';

function buildListing(overrides: Partial<VestiaireListing> = {}): VestiaireListing {
  return {
    id: 'vc-listing-abc123',
    title: 'Chanel Classic Flap Bag',
    description: 'Classic Chanel flap bag in very good condition.',
    price: '3500.00',
    currency: 'EUR',
    condition: 'Very good condition',
    status: 'on_sale',
    brand: { id: 1, name: 'Chanel', slug: 'chanel' },
    category: { id: 5, name: 'Handbags', path: 'women/handbags' },
    images: [
      { id: 'img-1', url: 'https://cdn.vestiaire.com/img1.jpg', position: 1, is_primary: true },
      { id: 'img-2', url: 'https://cdn.vestiaire.com/img2.jpg', position: 2, is_primary: false },
    ],
    created_at: '2024-02-10T08:00:00Z',
    size: 'One Size',
    color: 'Black',
    material: 'Lambskin',
    ...overrides,
  };
}

describe('parseVestiairePrice', () => {
  it('parses "450.00" to 45000', () => {
    expect(parseVestiairePrice('450.00')).toBe(45000);
  });

  it('parses "1299.50" to 129950', () => {
    expect(parseVestiairePrice('1299.50')).toBe(129950);
  });

  it('parses "0" to 0', () => {
    expect(parseVestiairePrice('0')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parseVestiairePrice('')).toBe(0);
  });

  it('returns 0 for negative values', () => {
    expect(parseVestiairePrice('-100.00')).toBe(0);
  });

  it('returns 0 for NaN strings', () => {
    expect(parseVestiairePrice('abc')).toBe(0);
  });
});

describe('normalizeVestiaireListing', () => {
  it('maps a fully-populated Vestiaire listing', () => {
    const result = normalizeVestiaireListing(buildListing());
    expect(result.externalId).toBe('vc-listing-abc123');
    expect(result.title).toBe('Chanel Classic Flap Bag');
    expect(result.description).toBe('Classic Chanel flap bag in very good condition.');
    expect(result.priceCents).toBe(350000);
    expect(result.currencyCode).toBe('EUR');
    expect(result.quantity).toBe(1);
    expect(result.brand).toBe('Chanel');
    expect(result.category).toBe('Handbags');
  });

  it('maps condition "Never worn" to NEW_WITHOUT_TAGS', () => {
    const result = normalizeVestiaireListing(buildListing({ condition: 'Never worn' }));
    expect(result.condition).toBe('NEW_WITHOUT_TAGS');
  });

  it('maps condition "Never worn, with tag" to NEW_WITH_TAGS', () => {
    const result = normalizeVestiaireListing(buildListing({ condition: 'Never worn, with tag' }));
    expect(result.condition).toBe('NEW_WITH_TAGS');
  });

  it('maps condition "Very good condition" to VERY_GOOD', () => {
    const result = normalizeVestiaireListing(buildListing({ condition: 'Very good condition' }));
    expect(result.condition).toBe('VERY_GOOD');
  });

  it('maps condition "Good condition" to GOOD', () => {
    const result = normalizeVestiaireListing(buildListing({ condition: 'Good condition' }));
    expect(result.condition).toBe('GOOD');
  });

  it('maps condition "Fair condition" to ACCEPTABLE', () => {
    const result = normalizeVestiaireListing(buildListing({ condition: 'Fair condition' }));
    expect(result.condition).toBe('ACCEPTABLE');
  });

  it('maps status "on_sale" to ACTIVE', () => {
    const result = normalizeVestiaireListing(buildListing({ status: 'on_sale' }));
    expect(result.status).toBe('ACTIVE');
  });

  it('maps status "sold" to SOLD', () => {
    const result = normalizeVestiaireListing(buildListing({ status: 'sold' }));
    expect(result.status).toBe('SOLD');
  });

  it('maps status "withdrawn" to ENDED', () => {
    const result = normalizeVestiaireListing(buildListing({ status: 'withdrawn' }));
    expect(result.status).toBe('ENDED');
  });

  it('maps status "reserved" to ACTIVE', () => {
    const result = normalizeVestiaireListing(buildListing({ status: 'reserved' }));
    expect(result.status).toBe('ACTIVE');
  });

  it('defaults currency to EUR when omitted', () => {
    const result = normalizeVestiaireListing(buildListing({ currency: undefined }));
    expect(result.currencyCode).toBe('EUR');
  });

  it('preserves non-EUR currency codes (GBP)', () => {
    const result = normalizeVestiaireListing(buildListing({ currency: 'GBP' }));
    expect(result.currencyCode).toBe('GBP');
  });

  it('preserves CHF currency code', () => {
    const result = normalizeVestiaireListing(buildListing({ currency: 'CHF' }));
    expect(result.currencyCode).toBe('CHF');
  });

  it('handles missing optional fields gracefully', () => {
    const minimal: VestiaireListing = { id: 'vc-min-1', title: 'Minimal Item', price: '50.00' };
    const result = normalizeVestiaireListing(minimal);
    expect(result.externalId).toBe('vc-min-1');
    expect(result.brand).toBeNull();
    expect(result.category).toBeNull();
    expect(result.images).toHaveLength(0);
    expect(result.condition).toBeNull();
    expect(result.listedAt).toBeNull();
    expect(result.soldAt).toBeNull();
  });

  it('sets quantity to 1 always', () => {
    const result = normalizeVestiaireListing(buildListing());
    expect(result.quantity).toBe(1);
  });

  it('populates itemSpecifics with size, color, material', () => {
    const result = normalizeVestiaireListing(buildListing());
    expect(result.itemSpecifics['size']).toBe('One Size');
    expect(result.itemSpecifics['color']).toBe('Black');
    expect(result.itemSpecifics['material']).toBe('Lambskin');
    expect(result.itemSpecifics['vestiaireCondition']).toBe('Very good condition');
  });

  it('constructs URL from product ID', () => {
    const result = normalizeVestiaireListing(buildListing({ slug: undefined }));
    expect(result.url).toBe(
      'https://www.vestiairecollective.com/products/p-vc-listing-abc123.html',
    );
  });

  it('uses slug in URL when available', () => {
    const result = normalizeVestiaireListing(buildListing({ slug: 'chanel-classic-flap' }));
    expect(result.url).toBe('https://www.vestiairecollective.com/chanel-classic-flap');
  });

  it('sorts images by position with primary first', () => {
    const result = normalizeVestiaireListing(buildListing());
    expect(result.images).toHaveLength(2);
    expect(result.images[0]?.isPrimary).toBe(true);
    expect(result.images[0]?.url).toBe('https://cdn.vestiaire.com/img1.jpg');
  });

  it('parses created_at ISO string to listedAt Date', () => {
    const result = normalizeVestiaireListing(buildListing());
    expect(result.listedAt).toBeInstanceOf(Date);
  });

  it('parses sold_at when present', () => {
    const result = normalizeVestiaireListing(
      buildListing({ sold_at: '2024-05-01T10:00:00Z', status: 'sold' }),
    );
    expect(result.soldAt).toBeInstanceOf(Date);
  });

  it('handles invalid created_at date string', () => {
    const result = normalizeVestiaireListing(buildListing({ created_at: 'not-a-date' }));
    expect(result.listedAt).toBeNull();
  });

  it('shipping fields are all null', () => {
    const result = normalizeVestiaireListing(buildListing());
    expect(result.shippingType).toBeNull();
    expect(result.shippingPriceCents).toBeNull();
    expect(result.weight).toBeNull();
    expect(result.dimensions).toBeNull();
  });

  it('truncates title to 200 chars', () => {
    const result = normalizeVestiaireListing(buildListing({ title: 'Z'.repeat(250) }));
    expect(result.title.length).toBe(200);
  });

  it('handles empty images array', () => {
    const result = normalizeVestiaireListing(buildListing({ images: [] }));
    expect(result.images).toHaveLength(0);
  });

  it('omits vestiaireCondition from itemSpecifics when condition is missing', () => {
    const result = normalizeVestiaireListing(buildListing({ condition: undefined }));
    expect(result.itemSpecifics['vestiaireCondition']).toBeUndefined();
  });
});

describe('toExternalListing', () => {
  it('converts normalized data to ExternalListing shape', () => {
    const normalized = normalizeVestiaireListing(buildListing());
    const external = toExternalListing(normalized);

    expect(external.externalId).toBe('vc-listing-abc123');
    expect(external.priceCents).toBe(350000);
    expect(external.currencyCode).toBe('EUR');
    expect(external.quantity).toBe(1);
  });

  it('includes all required ExternalListing fields', () => {
    const normalized = normalizeVestiaireListing(buildListing());
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
