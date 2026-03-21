import { describe, it, expect } from 'vitest';
import {
  parsePoshmarkPrice,
  normalizePoshmarkListing,
  toExternalListing,
} from '../poshmark-normalizer';
import type { PoshmarkListing } from '../poshmark-types';

function buildRaw(overrides: Partial<PoshmarkListing> = {}): PoshmarkListing {
  return {
    id: 'listing-abc123',
    title: 'Nike Air Force 1',
    description: 'Great condition sneakers',
    price_amount: { val: '89.99', currency_code: 'USD' },
    inventory: { size_quantities: [{ size_id: '10', quantity_available: 1 }] },
    catalog: { category_obj: { display: 'Sneakers' } },
    pictures: [
      { url: 'https://poshmark.com/img1.jpg' },
      { url: 'https://poshmark.com/img2.jpg' },
    ],
    brand: { display: 'Nike' },
    condition: 'Like New',
    status: 'available',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-16T10:00:00Z',
    ...overrides,
  };
}

describe('parsePoshmarkPrice', () => {
  it('converts "89.99" to 8999 cents', () => {
    expect(parsePoshmarkPrice('89.99')).toBe(8999);
  });

  it('converts "25.00" to 2500 cents', () => {
    expect(parsePoshmarkPrice('25.00')).toBe(2500);
  });

  it('handles "0" as 0 cents', () => {
    expect(parsePoshmarkPrice('0')).toBe(0);
  });

  it('handles invalid string as 0', () => {
    expect(parsePoshmarkPrice('not-a-number')).toBe(0);
  });

  it('handles empty string as 0', () => {
    expect(parsePoshmarkPrice('')).toBe(0);
  });
});

describe('normalizePoshmarkListing', () => {
  it('maps title correctly with trimming', () => {
    const raw = buildRaw({ title: '  Nike Shoes  ' });
    const result = normalizePoshmarkListing(raw);
    expect(result.title).toBe('Nike Shoes');
  });

  it('truncates title to 200 chars', () => {
    const longTitle = 'A'.repeat(250);
    const raw = buildRaw({ title: longTitle });
    const result = normalizePoshmarkListing(raw);
    expect(result.title).toHaveLength(200);
  });

  it('maps NWT condition to NEW_WITH_TAGS', () => {
    const raw = buildRaw({ condition: 'NWT' });
    const result = normalizePoshmarkListing(raw);
    expect(result.condition).toBe('NEW_WITH_TAGS');
  });

  it('maps NWOT condition to NEW_WITHOUT_TAGS', () => {
    const raw = buildRaw({ condition: 'NWOT' });
    const result = normalizePoshmarkListing(raw);
    expect(result.condition).toBe('NEW_WITHOUT_TAGS');
  });

  it('maps Like New condition to LIKE_NEW', () => {
    const raw = buildRaw({ condition: 'Like New' });
    const result = normalizePoshmarkListing(raw);
    expect(result.condition).toBe('LIKE_NEW');
  });

  it('maps Good condition to GOOD', () => {
    const raw = buildRaw({ condition: 'Good' });
    const result = normalizePoshmarkListing(raw);
    expect(result.condition).toBe('GOOD');
  });

  it('maps Fair condition to ACCEPTABLE', () => {
    const raw = buildRaw({ condition: 'Fair' });
    const result = normalizePoshmarkListing(raw);
    expect(result.condition).toBe('ACCEPTABLE');
  });

  it('returns null condition for unknown values', () => {
    const raw = buildRaw({ condition: 'Terrible' });
    const result = normalizePoshmarkListing(raw);
    expect(result.condition).toBeNull();
  });

  it('maps image URLs with covershot as primary', () => {
    const raw = buildRaw({
      covershot: { url: 'https://poshmark.com/cover.jpg' },
      pictures: [
        { url: 'https://poshmark.com/img1.jpg' },
        { url: 'https://poshmark.com/img2.jpg' },
      ],
    });
    const result = normalizePoshmarkListing(raw);
    expect(result.images[0]?.url).toBe('https://poshmark.com/cover.jpg');
    expect(result.images[0]?.isPrimary).toBe(true);
  });

  it('uses first picture as primary when no covershot', () => {
    const raw = buildRaw({ covershot: undefined });
    const result = normalizePoshmarkListing(raw);
    expect(result.images[0]?.isPrimary).toBe(true);
    expect(result.images[0]?.url).toBe('https://poshmark.com/img1.jpg');
  });

  it('handles missing optional fields gracefully', () => {
    const raw = buildRaw({
      brand: undefined,
      condition: undefined,
      catalog: {},
      covershot: undefined,
    });
    const result = normalizePoshmarkListing(raw);
    expect(result.brand).toBeNull();
    expect(result.condition).toBeNull();
    expect(result.category).toBeNull();
  });

  it('maps "available" status to ACTIVE', () => {
    const raw = buildRaw({ status: 'available' });
    const result = normalizePoshmarkListing(raw);
    expect(result.status).toBe('ACTIVE');
  });

  it('maps "sold" status to SOLD', () => {
    const raw = buildRaw({ status: 'sold' });
    const result = normalizePoshmarkListing(raw);
    expect(result.status).toBe('SOLD');
  });

  it('maps "not_for_sale" status to ENDED', () => {
    const raw = buildRaw({ status: 'not_for_sale' });
    const result = normalizePoshmarkListing(raw);
    expect(result.status).toBe('ENDED');
  });

  it('extracts brand from brand object', () => {
    const raw = buildRaw({ brand: { display: 'Adidas' } });
    const result = normalizePoshmarkListing(raw);
    expect(result.brand).toBe('Adidas');
  });

  it('builds correct Poshmark listing URL', () => {
    const raw = buildRaw({ id: 'listing-abc123' });
    const result = normalizePoshmarkListing(raw);
    expect(result.url).toBe('https://poshmark.com/listing/listing-abc123');
  });

  it('converts price string to integer cents', () => {
    const raw = buildRaw({ price_amount: { val: '89.99', currency_code: 'USD' } });
    const result = normalizePoshmarkListing(raw);
    expect(result.priceCents).toBe(8999);
  });
});

describe('toExternalListing', () => {
  it('converts PoshmarkNormalizedData to ExternalListing shape', () => {
    const raw = buildRaw();
    const normalized = normalizePoshmarkListing(raw);
    const external = toExternalListing(normalized);
    expect(external.externalId).toBe(normalized.externalId);
    expect(external.priceCents).toBe(normalized.priceCents);
    expect(external.status).toBe(normalized.status);
    expect(external.images).toEqual(normalized.images);
  });
});
