import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeRobotsDirective, generateListingMeta, generateCategoryMeta, generateSearchMeta, generateStoreMeta } from '../meta-tags';
import type { ListingForSeo } from '../structured-data';

function makeListing(overrides: Partial<ListingForSeo> = {}): ListingForSeo {
  return {
    id: 'lst_abc123',
    slug: 'nike-air-jordan-abc123',
    title: 'Nike Air Jordan Retro',
    description: 'Brand new with tags',
    priceCents: 14999,
    status: 'ACTIVE',
    condition: 'NEW_WITH_TAGS',
    brand: 'Nike',
    quantity: 1,
    availableQuantity: 1,
    soldAt: null,
    hasVariations: false,
    sellerName: 'Jane Doe',
    sellerUsername: 'janedoe',
    sellerAverageRating: 4.8,
    sellerTotalReviews: 42,
    images: [
      { url: 'https://cdn.twicely.com/img1.jpg', altText: 'Front view' },
    ],
    ...overrides,
  };
}

describe('computeRobotsDirective', () => {
  it('returns undefined for ACTIVE listings', () => {
    expect(computeRobotsDirective({ status: 'ACTIVE', soldAt: null })).toBeUndefined();
  });

  it('returns noindex for ENDED', () => {
    expect(computeRobotsDirective({ status: 'ENDED', soldAt: null })).toBe('noindex');
  });

  it('returns noindex for PAUSED', () => {
    expect(computeRobotsDirective({ status: 'PAUSED', soldAt: null })).toBe('noindex');
  });

  it('returns noindex for RESERVED', () => {
    expect(computeRobotsDirective({ status: 'RESERVED', soldAt: null })).toBe('noindex');
  });

  it('returns noindex, nofollow for REMOVED', () => {
    expect(computeRobotsDirective({ status: 'REMOVED', soldAt: null })).toBe('noindex, nofollow');
  });

  it('returns undefined for recently SOLD listing within window', () => {
    const recentSold = new Date(Date.now() - 30 * 86_400_000); // 30 days ago
    expect(computeRobotsDirective({ status: 'SOLD', soldAt: recentSold }, true, 90)).toBeUndefined();
  });

  it('returns noindex for SOLD listing outside window', () => {
    const oldSold = new Date(Date.now() - 100 * 86_400_000); // 100 days ago
    expect(computeRobotsDirective({ status: 'SOLD', soldAt: oldSold }, true, 90)).toBe('noindex');
  });

  it('returns noindex for SOLD when indexing disabled', () => {
    const recentSold = new Date(Date.now() - 10 * 86_400_000);
    expect(computeRobotsDirective({ status: 'SOLD', soldAt: recentSold }, false, 90)).toBe('noindex');
  });

  it('returns noindex for SOLD without soldAt date', () => {
    expect(computeRobotsDirective({ status: 'SOLD', soldAt: null }, true, 90)).toBe('noindex');
  });
});

describe('generateListingMeta', () => {
  it('generates correct meta for a listing', () => {
    const result = generateListingMeta(makeListing(), undefined);
    expect(result.title).toContain('Nike Air Jordan Retro');
    expect(result.title).toContain('$149.99');
    expect(result.title).toContain('Twicely');
  });

  it('includes product:price:amount in other', () => {
    const result = generateListingMeta(makeListing({ priceCents: 1999 }), undefined);
    expect(result.other).toBeDefined();
    expect(result.other!['product:price:amount']).toBe('19.99');
    expect(result.other!['product:price:currency']).toBe('USD');
  });

  it('includes canonical URL', () => {
    const result = generateListingMeta(makeListing(), undefined);
    expect(result.alternates?.canonical).toBe('https://twicely.co/i/nike-air-jordan-abc123');
  });

  it('includes OG image from first listing image', () => {
    const result = generateListingMeta(makeListing(), undefined);
    const og = result.openGraph;
    expect(og).toBeDefined();
    if (og && 'images' in og && Array.isArray(og.images)) {
      expect(og.images[0]).toEqual({
        url: 'https://cdn.twicely.com/img1.jpg',
        width: 1200,
        height: 630,
        alt: 'Nike Air Jordan Retro',
      });
    }
  });

  it('shows price range for variation listings', () => {
    const result = generateListingMeta(
      makeListing({
        hasVariations: true,
        minPriceCents: 2999,
        maxPriceCents: 5999,
      }),
      undefined,
    );
    expect(result.title).toContain('$29.99');
    expect(result.title).toContain('$59.99');
  });

  it('passes robots directive through', () => {
    const result = generateListingMeta(makeListing(), 'noindex');
    expect(result.robots).toBe('noindex');
  });
});

describe('generateCategoryMeta', () => {
  it('generates title from category name', () => {
    const result = generateCategoryMeta({
      slug: 'shoes',
      name: 'Shoes',
      metaTitle: null,
      metaDescription: null,
      ogImageUrl: null,
    }, 150);
    expect(result.title).toBe('Shoes | Twicely');
  });

  it('uses custom metaTitle when set', () => {
    const result = generateCategoryMeta({
      slug: 'shoes',
      name: 'Shoes',
      metaTitle: 'Buy Shoes Online',
      metaDescription: null,
      ogImageUrl: null,
    }, 150);
    expect(result.title).toBe('Buy Shoes Online | Twicely');
  });

  it('adds page number for paginated pages', () => {
    const result = generateCategoryMeta({
      slug: 'shoes',
      name: 'Shoes',
      metaTitle: null,
      metaDescription: null,
      ogImageUrl: null,
    }, 150, 3);
    expect(result.title).toBe('Shoes - Page 3 | Twicely');
  });

  it('includes canonical URL', () => {
    const result = generateCategoryMeta({
      slug: 'shoes',
      name: 'Shoes',
      metaTitle: null,
      metaDescription: null,
      ogImageUrl: null,
    }, 0);
    expect(result.alternates?.canonical).toBe('https://twicely.co/c/shoes');
  });
});

describe('generateSearchMeta', () => {
  it('returns noindex, follow for search pages', () => {
    const result = generateSearchMeta('nike dunks', 42);
    expect(result.robots).toEqual({ index: false, follow: true });
  });

  it('includes query in title', () => {
    const result = generateSearchMeta('nike dunks', 42);
    expect(result.title).toContain('nike dunks');
  });

  it('handles empty query', () => {
    const result = generateSearchMeta('', 0);
    expect(result.title).toBe('Search | Twicely');
  });
});

describe('generateStoreMeta', () => {
  it('generates correct title', () => {
    const result = generateStoreMeta({
      username: 'vintagefinds',
      displayName: 'Vintage Finds',
      bio: 'Curated vintage picks',
      avatarUrl: null,
    });
    expect(result.title).toContain("Vintage Finds");
    expect(result.title).toContain('Twicely');
  });

  it('includes canonical URL', () => {
    const result = generateStoreMeta({
      username: 'vintagefinds',
      displayName: 'Vintage Finds',
      bio: null,
      avatarUrl: null,
    });
    expect(result.alternates?.canonical).toBe('https://twicely.co/st/vintagefinds');
  });
});
