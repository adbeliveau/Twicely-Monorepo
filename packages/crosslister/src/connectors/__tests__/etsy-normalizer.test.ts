import { describe, it, expect } from 'vitest';
import { normalizeEtsyListing, parseEtsyPrice } from '../etsy-normalizer';
import type { EtsyListing } from '../etsy-types';

function buildListing(overrides: Partial<EtsyListing> = {}): EtsyListing {
  return {
    listing_id: 123456789,
    user_id: 987,
    shop_id: 555,
    title: 'Vintage Denim Jacket 1980s Size Medium',
    description: 'Beautiful vintage denim jacket in great condition.',
    state: 'active',
    creation_timestamp: 1700000000,
    ending_timestamp: null,
    original_creation_timestamp: 1700000000,
    last_modified_timestamp: 1700001000,
    state_timestamp: 1700000000,
    quantity: 1,
    shop_section_id: null,
    featured_rank: 0,
    url: 'https://www.etsy.com/listing/123456789/vintage-denim-jacket',
    num_favorers: 10,
    non_taxable: false,
    is_taxable: true,
    is_customizable: false,
    is_personalizable: false,
    personalization_is_required: false,
    personalization_char_count_max: null,
    personalization_instructions: null,
    listing_type: 'physical',
    tags: ['vintage', 'denim', 'jacket'],
    materials: ['denim', 'cotton'],
    shipping_profile_id: 123,
    return_policy_id: null,
    processing_min: 1,
    processing_max: 3,
    who_made: 'someone_else',
    when_made: '1980s',
    is_supply: false,
    item_weight: null,
    item_weight_unit: null,
    item_length: null,
    item_width: null,
    item_height: null,
    item_dimensions_unit: null,
    is_private: false,
    taxonomy_id: 111,
    price: { amount: 4500, divisor: 100, currency_code: 'USD' },
    images: [
      { listing_image_id: 1, url_fullxfull: 'https://i.etsystatic.com/img1.jpg', rank: 1, is_watermarked: false },
      { listing_image_id: 2, url_fullxfull: 'https://i.etsystatic.com/img2.jpg', rank: 2, is_watermarked: false },
    ],
    taxonomy_path: ['Clothing', 'Outerwear', 'Jackets & Coats'],
    ...overrides,
  };
}

describe('parseEtsyPrice', () => {
  it('returns amount directly when divisor is 100', () => {
    expect(parseEtsyPrice(4500, 100)).toBe(4500);
  });

  it('normalizes amount when divisor is not 100', () => {
    // 4500 / 1000 * 100 = 450
    expect(parseEtsyPrice(4500, 1000)).toBe(450);
  });

  it('handles zero', () => {
    expect(parseEtsyPrice(0, 100)).toBe(0);
  });

  it('handles negative amount as 0', () => {
    expect(parseEtsyPrice(-100, 100)).toBe(0);
  });

  it('handles invalid divisor as 0', () => {
    expect(parseEtsyPrice(100, 0)).toBe(0);
  });

  it('rounds fractional cents', () => {
    // 100 / 3 * 100 = 3333.33... → rounds to 3333
    expect(parseEtsyPrice(100, 3)).toBe(3333);
  });
});

describe('normalizeEtsyListing', () => {
  it('maps externalId from listing_id', () => {
    const result = normalizeEtsyListing(buildListing());
    expect(result.externalId).toBe('123456789');
  });

  it('trims and normalizes title', () => {
    const result = normalizeEtsyListing(buildListing({ title: '  Vintage Jacket  ' }));
    expect(result.title).toBe('Vintage Jacket');
  });

  it('truncates title to 200 chars', () => {
    const longTitle = 'A'.repeat(250);
    const result = normalizeEtsyListing(buildListing({ title: longTitle }));
    expect(result.title.length).toBe(200);
  });

  it('converts Etsy price amount to integer cents', () => {
    const result = normalizeEtsyListing(buildListing());
    expect(result.priceCents).toBe(4500);
  });

  it('sets currency code from price', () => {
    const result = normalizeEtsyListing(buildListing());
    expect(result.currencyCode).toBe('USD');
  });

  it('condition is always null (Etsy has no condition field)', () => {
    const result = normalizeEtsyListing(buildListing());
    expect(result.condition).toBeNull();
  });

  it('brand is always null (Etsy has no brand field)', () => {
    const result = normalizeEtsyListing(buildListing());
    expect(result.brand).toBeNull();
  });

  it('maps images sorted by rank with primary first', () => {
    const result = normalizeEtsyListing(buildListing());
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toEqual({
      url: 'https://i.etsystatic.com/img1.jpg',
      isPrimary: true,
      sortOrder: 0,
    });
    expect(result.images[1]).toEqual({
      url: 'https://i.etsystatic.com/img2.jpg',
      isPrimary: false,
      sortOrder: 1,
    });
  });

  it('handles missing images gracefully', () => {
    const result = normalizeEtsyListing(buildListing({ images: [] }));
    expect(result.images).toHaveLength(0);
  });

  it('maps active state to ACTIVE', () => {
    const result = normalizeEtsyListing(buildListing({ state: 'active' }));
    expect(result.status).toBe('ACTIVE');
  });

  it('maps sold_out state to SOLD', () => {
    const result = normalizeEtsyListing(buildListing({ state: 'sold_out' }));
    expect(result.status).toBe('SOLD');
  });

  it('maps draft state to DRAFT', () => {
    const result = normalizeEtsyListing(buildListing({ state: 'draft' }));
    expect(result.status).toBe('DRAFT');
  });

  it('maps expired/removed states to ENDED', () => {
    expect(normalizeEtsyListing(buildListing({ state: 'expired' })).status).toBe('ENDED');
    expect(normalizeEtsyListing(buildListing({ state: 'removed' })).status).toBe('ENDED');
  });

  it('extracts category from taxonomy_path (last entry)', () => {
    const result = normalizeEtsyListing(buildListing());
    expect(result.category).toBe('Jackets & Coats');
  });

  it('sets category to null when taxonomy_path is absent', () => {
    const result = normalizeEtsyListing(buildListing({ taxonomy_path: undefined }));
    expect(result.category).toBeNull();
  });

  it('builds listedAt from creation_timestamp', () => {
    const result = normalizeEtsyListing(buildListing());
    expect(result.listedAt).toBeInstanceOf(Date);
    expect(result.listedAt?.getTime()).toBe(1700000000 * 1000);
  });

  it('populates itemSpecifics with tags and materials', () => {
    const result = normalizeEtsyListing(buildListing());
    expect(result.itemSpecifics['tags']).toBe('vintage, denim, jacket');
    expect(result.itemSpecifics['materials']).toBe('denim, cotton');
  });

  it('handles missing price gracefully', () => {
    const result = normalizeEtsyListing(buildListing({ price: undefined }));
    expect(result.priceCents).toBe(0);
    expect(result.currencyCode).toBe('USD');
  });

  it('uses url field directly if present', () => {
    const result = normalizeEtsyListing(buildListing());
    expect(result.url).toBe('https://www.etsy.com/listing/123456789/vintage-denim-jacket');
  });

  it('shipping fields are always null', () => {
    const result = normalizeEtsyListing(buildListing());
    expect(result.shippingType).toBeNull();
    expect(result.shippingPriceCents).toBeNull();
    expect(result.weight).toBeNull();
    expect(result.dimensions).toBeNull();
  });
});
