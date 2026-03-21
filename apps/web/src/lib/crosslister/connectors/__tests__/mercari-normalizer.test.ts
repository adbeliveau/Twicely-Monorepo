import { describe, it, expect } from 'vitest';
import { normalizeMercariListing, toExternalListing } from '../mercari-normalizer';
import type { MercariItem } from '../mercari-types';

function buildRaw(overrides: Partial<MercariItem> = {}): MercariItem {
  return {
    id: 'item-xyz789',
    name: 'Nike Air Max 90',
    description: 'Clean pair of shoes',
    price: 7500,
    status: 'on_sale',
    condition_id: 2,
    photos: [
      { url: 'https://static.mercdn.net/item1.jpg' },
      { url: 'https://static.mercdn.net/item2.jpg' },
    ],
    brand: { id: 10, name: 'Nike' },
    categories: [{ id: 100, name: 'Shoes' }],
    shipping: { method_id: 1, payer_id: 1, fee: 0 },
    created: 1705312800,
    updated: 1705399200,
    ...overrides,
  };
}

describe('normalizeMercariListing', () => {
  it('maps title correctly with trimming', () => {
    const raw = buildRaw({ name: '  Nike Shoes  ' });
    const result = normalizeMercariListing(raw);
    expect(result.title).toBe('Nike Shoes');
  });

  it('truncates title to 200 chars', () => {
    const raw = buildRaw({ name: 'A'.repeat(250) });
    const result = normalizeMercariListing(raw);
    expect(result.title).toHaveLength(200);
  });

  it('uses integer cents price directly', () => {
    const raw = buildRaw({ price: 7500 });
    const result = normalizeMercariListing(raw);
    expect(result.priceCents).toBe(7500);
  });

  it('quantity is always 1 (Mercari single-quantity)', () => {
    const raw = buildRaw();
    const result = normalizeMercariListing(raw);
    expect(result.quantity).toBe(1);
  });

  it('maps condition_id 1 to NEW_WITH_TAGS', () => {
    const result = normalizeMercariListing(buildRaw({ condition_id: 1 }));
    expect(result.condition).toBe('NEW_WITH_TAGS');
  });

  it('maps condition_id 2 to LIKE_NEW', () => {
    const result = normalizeMercariListing(buildRaw({ condition_id: 2 }));
    expect(result.condition).toBe('LIKE_NEW');
  });

  it('maps condition_id 3 to GOOD', () => {
    const result = normalizeMercariListing(buildRaw({ condition_id: 3 }));
    expect(result.condition).toBe('GOOD');
  });

  it('maps condition_id 4 to GOOD (Mercari Fair = Twicely Good)', () => {
    const result = normalizeMercariListing(buildRaw({ condition_id: 4 }));
    expect(result.condition).toBe('GOOD');
  });

  it('maps condition_id 5 to ACCEPTABLE (Mercari Poor)', () => {
    const result = normalizeMercariListing(buildRaw({ condition_id: 5 }));
    expect(result.condition).toBe('ACCEPTABLE');
  });

  it('maps condition_id 6 to NEW_WITHOUT_TAGS', () => {
    const result = normalizeMercariListing(buildRaw({ condition_id: 6 }));
    expect(result.condition).toBe('NEW_WITHOUT_TAGS');
  });

  it('returns null condition for unknown condition_id', () => {
    const result = normalizeMercariListing(buildRaw({ condition_id: 99 }));
    expect(result.condition).toBeNull();
  });

  it('maps image URLs with first as primary', () => {
    const result = normalizeMercariListing(buildRaw());
    expect(result.images[0]?.isPrimary).toBe(true);
    expect(result.images[1]?.isPrimary).toBe(false);
    expect(result.images[0]?.url).toBe('https://static.mercdn.net/item1.jpg');
  });

  it('handles missing optional fields gracefully', () => {
    const result = normalizeMercariListing(buildRaw({
      brand: undefined,
      categories: undefined,
      shipping: undefined,
    }));
    expect(result.brand).toBeNull();
    expect(result.category).toBeNull();
    expect(result.shippingPriceCents).toBeNull();
  });

  it('maps "on_sale" status to ACTIVE', () => {
    const result = normalizeMercariListing(buildRaw({ status: 'on_sale' }));
    expect(result.status).toBe('ACTIVE');
  });

  it('maps "sold_out" status to SOLD', () => {
    const result = normalizeMercariListing(buildRaw({ status: 'sold_out' }));
    expect(result.status).toBe('SOLD');
  });

  it('maps "trading" status to SOLD', () => {
    const result = normalizeMercariListing(buildRaw({ status: 'trading' }));
    expect(result.status).toBe('SOLD');
  });

  it('maps "inactive" status to ENDED', () => {
    const result = normalizeMercariListing(buildRaw({ status: 'inactive' }));
    expect(result.status).toBe('ENDED');
  });

  it('builds correct Mercari listing URL', () => {
    const result = normalizeMercariListing(buildRaw({ id: 'item-xyz789' }));
    expect(result.url).toBe('https://www.mercari.com/us/item/item-xyz789/');
  });

  it('sets shippingType to FREE when payer_id is 1 (seller pays)', () => {
    const result = normalizeMercariListing(buildRaw({ shipping: { method_id: 1, payer_id: 1 } }));
    expect(result.shippingType).toBe('FREE');
  });

  it('sets shippingType to FLAT when payer_id is 2 (buyer pays)', () => {
    const result = normalizeMercariListing(buildRaw({ shipping: { method_id: 1, payer_id: 2, fee: 500 } }));
    expect(result.shippingType).toBe('FLAT');
    expect(result.shippingPriceCents).toBe(500);
  });
});

describe('toExternalListing', () => {
  it('converts MercariNormalizedData to ExternalListing shape', () => {
    const raw = buildRaw();
    const normalized = normalizeMercariListing(raw);
    const external = toExternalListing(normalized);
    expect(external.externalId).toBe(normalized.externalId);
    expect(external.priceCents).toBe(normalized.priceCents);
    expect(external.status).toBe(normalized.status);
  });
});
