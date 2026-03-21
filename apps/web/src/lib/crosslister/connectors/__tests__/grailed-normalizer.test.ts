import { describe, it, expect } from 'vitest';
import { normalizeGrailedListing, parseGrailedPrice } from '../grailed-normalizer';
import type { GrailedListing } from '../grailed-types';

function buildListing(overrides: Partial<GrailedListing> = {}): GrailedListing {
  return {
    id: 7654321,
    title: 'Stone Island Jacket Size L',
    description: 'Gently used Stone Island jacket. Great condition.',
    price: '350.00',
    currency: 'USD',
    is_new: false,
    is_gently_used: true,
    is_used: false,
    is_very_worn: false,
    sold: false,
    bumped: false,
    deleted: false,
    designer: { id: 100, name: 'Stone Island', slug: 'stone-island' },
    category: { id: 5, name: 'outerwear', display_name: 'Outerwear' },
    photos: [
      { id: 1, url: 'https://media.grailed.com/img1.jpg', position: 1 },
      { id: 2, url: 'https://media.grailed.com/img2.jpg', position: 2 },
    ],
    link: 'https://www.grailed.com/listings/7654321-stone-island-jacket',
    created_at: '2024-03-01T09:00:00Z',
    updated_at: '2024-03-05T12:00:00Z',
    size: 'L',
    location: 'New York, US',
    ...overrides,
  };
}

describe('parseGrailedPrice', () => {
  it('converts decimal string to integer cents', () => {
    expect(parseGrailedPrice('89.99')).toBe(8999);
  });

  it('handles whole dollar amounts', () => {
    expect(parseGrailedPrice('350')).toBe(35000);
  });

  it('handles zero', () => {
    expect(parseGrailedPrice('0')).toBe(0);
  });

  it('handles invalid string as 0', () => {
    expect(parseGrailedPrice('abc')).toBe(0);
  });

  it('handles negative as 0', () => {
    expect(parseGrailedPrice('-10.00')).toBe(0);
  });

  it('rounds standard amounts', () => {
    expect(parseGrailedPrice('1.50')).toBe(150);
  });
});

describe('normalizeGrailedListing', () => {
  it('maps externalId from id', () => {
    const result = normalizeGrailedListing(buildListing());
    expect(result.externalId).toBe('7654321');
  });

  it('trims and normalizes title', () => {
    const result = normalizeGrailedListing(buildListing({ title: '  Stone Island  ' }));
    expect(result.title).toBe('Stone Island');
  });

  it('truncates title to 200 chars', () => {
    const result = normalizeGrailedListing(buildListing({ title: 'X'.repeat(250) }));
    expect(result.title.length).toBe(200);
  });

  it('parses price string to integer cents', () => {
    const result = normalizeGrailedListing(buildListing());
    expect(result.priceCents).toBe(35000);
  });

  it('maps is_new to NEW_WITH_TAGS', () => {
    const result = normalizeGrailedListing(buildListing({
      is_new: true, is_gently_used: false, is_used: false, is_very_worn: false,
    }));
    expect(result.condition).toBe('NEW_WITH_TAGS');
  });

  it('maps is_gently_used to LIKE_NEW', () => {
    const result = normalizeGrailedListing(buildListing());
    expect(result.condition).toBe('LIKE_NEW');
  });

  it('maps is_used to GOOD', () => {
    const result = normalizeGrailedListing(buildListing({
      is_new: false, is_gently_used: false, is_used: true, is_very_worn: false,
    }));
    expect(result.condition).toBe('GOOD');
  });

  it('maps is_very_worn to ACCEPTABLE', () => {
    const result = normalizeGrailedListing(buildListing({
      is_new: false, is_gently_used: false, is_used: false, is_very_worn: true,
    }));
    expect(result.condition).toBe('ACCEPTABLE');
  });

  it('returns null condition when no flag is set', () => {
    const result = normalizeGrailedListing(buildListing({
      is_new: false, is_gently_used: false, is_used: false, is_very_worn: false,
    }));
    expect(result.condition).toBeNull();
  });

  it('extracts brand from designer', () => {
    const result = normalizeGrailedListing(buildListing());
    expect(result.brand).toBe('Stone Island');
  });

  it('extracts brand from designers array when present', () => {
    const result = normalizeGrailedListing(buildListing({
      designer: undefined,
      designers: [{ id: 1, name: 'Acne Studios', slug: 'acne-studios' }],
    }));
    expect(result.brand).toBe('Acne Studios');
  });

  it('sets brand to null when no designer', () => {
    const result = normalizeGrailedListing(buildListing({ designer: undefined, designers: [] }));
    expect(result.brand).toBeNull();
  });

  it('maps photos sorted by position with primary first', () => {
    const result = normalizeGrailedListing(buildListing());
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toEqual({ url: 'https://media.grailed.com/img1.jpg', isPrimary: true, sortOrder: 0 });
    expect(result.images[1]).toEqual({ url: 'https://media.grailed.com/img2.jpg', isPrimary: false, sortOrder: 1 });
  });

  it('handles missing photos gracefully', () => {
    const result = normalizeGrailedListing(buildListing({ photos: undefined }));
    expect(result.images).toHaveLength(0);
  });

  it('maps active listing to ACTIVE', () => {
    const result = normalizeGrailedListing(buildListing({ sold: false, deleted: false }));
    expect(result.status).toBe('ACTIVE');
  });

  it('maps sold listing to SOLD', () => {
    const result = normalizeGrailedListing(buildListing({ sold: true }));
    expect(result.status).toBe('SOLD');
  });

  it('maps deleted listing to ENDED', () => {
    const result = normalizeGrailedListing(buildListing({ deleted: true }));
    expect(result.status).toBe('ENDED');
  });

  it('extracts category display name', () => {
    const result = normalizeGrailedListing(buildListing());
    expect(result.category).toBe('Outerwear');
  });

  it('sets category to null when absent', () => {
    const result = normalizeGrailedListing(buildListing({ category: undefined }));
    expect(result.category).toBeNull();
  });

  it('parses listedAt from created_at', () => {
    const result = normalizeGrailedListing(buildListing());
    expect(result.listedAt).toBeInstanceOf(Date);
  });

  it('stores size in itemSpecifics', () => {
    const result = normalizeGrailedListing(buildListing());
    expect(result.itemSpecifics['size']).toBe('L');
  });

  it('uses link field for URL', () => {
    const result = normalizeGrailedListing(buildListing());
    expect(result.url).toBe('https://www.grailed.com/listings/7654321-stone-island-jacket');
  });

  it('quantity is always 1', () => {
    const result = normalizeGrailedListing(buildListing());
    expect(result.quantity).toBe(1);
  });
});
