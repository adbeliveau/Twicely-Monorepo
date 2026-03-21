import { describe, it, expect } from 'vitest';
import { normalizeEbayListing, parseEbayPrice } from '../ebay-normalizer';
import type { EbayInventoryItem } from '../ebay-types';

function buildItem(overrides: Partial<EbayInventoryItem> = {}): EbayInventoryItem {
  return {
    sku: 'SKU-123',
    condition: 'LIKE_NEW',
    product: {
      title: 'Nike Air Jordan 1 Retro High OG Chicago',
      description: '<p>Great shoes in like-new condition.</p>',
      imageUrls: ['https://i.ebayimg.com/images/img1.jpg', 'https://i.ebayimg.com/images/img2.jpg'],
      aspects: { Brand: ['Nike'], Size: ['10'] },
    },
    availability: { shipToLocationAvailability: { quantity: 1 } },
    offers: [
      {
        listingId: '123456789',
        pricingSummary: { price: { value: '89.99', currency: 'USD' } },
      },
    ],
    ...overrides,
  };
}

describe('parseEbayPrice', () => {
  it('converts decimal string to integer cents', () => {
    expect(parseEbayPrice('89.99')).toBe(8999);
  });

  it('handles whole dollar amounts', () => {
    expect(parseEbayPrice('100')).toBe(10000);
  });

  it('handles zero', () => {
    expect(parseEbayPrice('0')).toBe(0);
  });

  it('handles invalid string as 0', () => {
    expect(parseEbayPrice('abc')).toBe(0);
  });

  it('rounds dollar amounts with standard rounding', () => {
    // 1.50 = 150 cents exactly
    expect(parseEbayPrice('1.50')).toBe(150);
  });
});

describe('normalizeEbayListing', () => {
  it('normalizes title correctly (trimming)', () => {
    const item = buildItem({ product: { title: '  Nike Air Jordan  ' } });
    const result = normalizeEbayListing(item);
    expect(result.title).toBe('Nike Air Jordan');
  });

  it('truncates title to 200 chars', () => {
    const longTitle = 'A'.repeat(250);
    const item = buildItem({ product: { title: longTitle } });
    const result = normalizeEbayListing(item);
    expect(result.title.length).toBe(200);
  });

  it('converts eBay price string to integer cents', () => {
    const result = normalizeEbayListing(buildItem());
    expect(result.priceCents).toBe(8999);
  });

  it('maps LIKE_NEW condition correctly', () => {
    const result = normalizeEbayListing(buildItem({ condition: 'LIKE_NEW' }));
    expect(result.condition).toBe('LIKE_NEW');
  });

  it('maps NEW condition to NEW_WITH_TAGS', () => {
    const result = normalizeEbayListing(buildItem({ condition: 'NEW' }));
    expect(result.condition).toBe('NEW_WITH_TAGS');
  });

  it('maps VERY_GOOD condition correctly', () => {
    const result = normalizeEbayListing(buildItem({ condition: 'VERY_GOOD' }));
    expect(result.condition).toBe('VERY_GOOD');
  });

  it('returns null condition for unknown eBay condition values', () => {
    const result = normalizeEbayListing(buildItem({ condition: 'FOR_PARTS_ONLY' }));
    expect(result.condition).toBeNull();
  });

  it('maps image URLs to ExternalImage array', () => {
    const result = normalizeEbayListing(buildItem());
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toEqual({ url: 'https://i.ebayimg.com/images/img1.jpg', isPrimary: true, sortOrder: 0 });
    expect(result.images[1]).toEqual({ url: 'https://i.ebayimg.com/images/img2.jpg', isPrimary: false, sortOrder: 1 });
  });

  it('handles missing optional fields gracefully', () => {
    const item: EbayInventoryItem = { sku: 'SKU-BARE' };
    const result = normalizeEbayListing(item);
    expect(result.externalId).toBe('SKU-BARE');
    expect(result.title).toBe('');
    expect(result.priceCents).toBe(0);
    expect(result.condition).toBeNull();
    expect(result.images).toHaveLength(0);
    expect(result.brand).toBeNull();
  });

  it('strips HTML from description', () => {
    const item = buildItem({ product: { description: '<p>Great <b>shoes</b>.</p>' } });
    const result = normalizeEbayListing(item);
    expect(result.description).toBe('Great shoes.');
  });

  it('extracts brand from aspects', () => {
    const result = normalizeEbayListing(buildItem());
    expect(result.brand).toBe('Nike');
  });

  it('sets quantity from availability', () => {
    const result = normalizeEbayListing(buildItem());
    expect(result.quantity).toBe(1);
  });

  it('builds eBay listing URL from listingId', () => {
    const result = normalizeEbayListing(buildItem());
    expect(result.url).toBe('https://www.ebay.com/itm/123456789');
  });
});
