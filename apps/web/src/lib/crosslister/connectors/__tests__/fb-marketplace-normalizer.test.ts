import { describe, it, expect } from 'vitest';
import { normalizeFbMarketplaceListing } from '../fb-marketplace-normalizer';
import type { FbCommerceListing } from '../fb-marketplace-types';

function buildListing(overrides: Partial<FbCommerceListing> = {}): FbCommerceListing {
  return {
    id: 'fb-listing-123',
    name: 'Nike Air Force 1 Size 10',
    description: 'Great condition sneakers, barely worn.',
    price: { amount: 7500, currency: 'USD' },
    condition: 'USED_LIKE_NEW',
    availability: 'in stock',
    category: 'Sneakers',
    brand: 'Nike',
    images: [
      { id: 'img-1', url: 'https://scontent.facebook.com/img1.jpg' },
      { id: 'img-2', url: 'https://scontent.facebook.com/img2.jpg' },
    ],
    product_item_id: 'fb-listing-123',
    created_time: '2024-01-15T10:00:00+0000',
    retailer_id: 'RETAILER-ABC',
    ...overrides,
  };
}

describe('normalizeFbMarketplaceListing', () => {
  it('maps externalId from id', () => {
    const result = normalizeFbMarketplaceListing(buildListing());
    expect(result.externalId).toBe('fb-listing-123');
  });

  it('trims and normalizes title', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ name: '  Nike Shoes  ' }));
    expect(result.title).toBe('Nike Shoes');
  });

  it('truncates title to 200 chars', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ name: 'A'.repeat(250) }));
    expect(result.title.length).toBe(200);
  });

  it('maps price.amount to integer priceCents', () => {
    const result = normalizeFbMarketplaceListing(buildListing());
    expect(result.priceCents).toBe(7500);
  });

  it('sets priceCents to 0 when price is absent', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ price: undefined }));
    expect(result.priceCents).toBe(0);
  });

  it('maps NEW condition to NEW_WITHOUT_TAGS', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ condition: 'NEW' }));
    expect(result.condition).toBe('NEW_WITHOUT_TAGS');
  });

  it('maps USED_LIKE_NEW condition to LIKE_NEW', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ condition: 'USED_LIKE_NEW' }));
    expect(result.condition).toBe('LIKE_NEW');
  });

  it('maps USED_GOOD condition to GOOD', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ condition: 'USED_GOOD' }));
    expect(result.condition).toBe('GOOD');
  });

  it('maps USED_FAIR condition to ACCEPTABLE', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ condition: 'USED_FAIR' }));
    expect(result.condition).toBe('ACCEPTABLE');
  });

  it('returns null for unknown condition', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ condition: 'UNKNOWN_CONDITION' }));
    expect(result.condition).toBeNull();
  });

  it('maps images with first as primary', () => {
    const result = normalizeFbMarketplaceListing(buildListing());
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toEqual({
      url: 'https://scontent.facebook.com/img1.jpg',
      isPrimary: true,
      sortOrder: 0,
    });
    expect(result.images[1]).toEqual({
      url: 'https://scontent.facebook.com/img2.jpg',
      isPrimary: false,
      sortOrder: 1,
    });
  });

  it('handles missing images gracefully', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ images: undefined }));
    expect(result.images).toHaveLength(0);
  });

  it('maps in stock availability to ACTIVE', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ availability: 'in stock' }));
    expect(result.status).toBe('ACTIVE');
  });

  it('maps out of stock availability to ENDED', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ availability: 'out of stock' }));
    expect(result.status).toBe('ENDED');
  });

  it('maps preorder availability to ACTIVE', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ availability: 'preorder' }));
    expect(result.status).toBe('ACTIVE');
  });

  it('extracts brand', () => {
    const result = normalizeFbMarketplaceListing(buildListing());
    expect(result.brand).toBe('Nike');
  });

  it('sets brand to null when absent', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ brand: undefined }));
    expect(result.brand).toBeNull();
  });

  it('extracts category', () => {
    const result = normalizeFbMarketplaceListing(buildListing());
    expect(result.category).toBe('Sneakers');
  });

  it('parses listedAt from created_time', () => {
    const result = normalizeFbMarketplaceListing(buildListing());
    expect(result.listedAt).toBeInstanceOf(Date);
  });

  it('builds URL from product_item_id', () => {
    const result = normalizeFbMarketplaceListing(buildListing());
    expect(result.url).toContain('fb-listing-123');
  });

  it('stores raw condition in itemSpecifics', () => {
    const result = normalizeFbMarketplaceListing(buildListing({ condition: 'USED_LIKE_NEW' }));
    expect(result.itemSpecifics['fbCondition']).toBe('USED_LIKE_NEW');
  });

  it('quantity is always 1', () => {
    const result = normalizeFbMarketplaceListing(buildListing());
    expect(result.quantity).toBe(1);
  });

  it('shipping fields are always null', () => {
    const result = normalizeFbMarketplaceListing(buildListing());
    expect(result.shippingType).toBeNull();
    expect(result.shippingPriceCents).toBeNull();
  });
});
