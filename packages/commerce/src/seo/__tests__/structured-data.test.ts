import { describe, it, expect } from 'vitest';
import {
  generateProductJsonLd,
  generateBreadcrumbJsonLd,
  generateItemListJsonLd,
  mapConditionToSchemaOrg,
  organizationJsonLd,
  websiteJsonLd,
  generateSellerJsonLd,
} from '../structured-data';
import type { ListingForSeo, Breadcrumb, ListingCardForSeo } from '../structured-data';

function makeListing(overrides: Partial<ListingForSeo> = {}): ListingForSeo {
  return {
    id: 'lst_abc123',
    slug: 'nike-air-jordan-abc123',
    title: 'Nike Air Jordan Retro',
    description: 'Brand new with tags Nike Air Jordan',
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
      { url: 'https://cdn.twicely.com/img2.jpg', altText: 'Side view' },
    ],
    ...overrides,
  };
}

describe('generateProductJsonLd', () => {
  it('generates valid Product JSON-LD for an active listing', () => {
    const result = generateProductJsonLd(makeListing());
    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('Product');
    expect(result.name).toBe('Nike Air Jordan Retro');
    expect(result.sku).toBe('lst_abc123');
  });

  it('includes brand when present', () => {
    const result = generateProductJsonLd(makeListing({ brand: 'Nike' }));
    expect(result.brand).toEqual({ '@type': 'Brand', name: 'Nike' });
  });

  it('omits brand when null', () => {
    const result = generateProductJsonLd(makeListing({ brand: null }));
    expect(result.brand).toBeUndefined();
  });

  it('sets correct price from integer cents', () => {
    const result = generateProductJsonLd(makeListing({ priceCents: 1999 }));
    if (!Array.isArray(result.offers)) {
      expect(result.offers.price).toBe('19.99');
      expect(result.offers.priceCurrency).toBe('USD');
    }
  });

  it('sets InStock for active listing', () => {
    const result = generateProductJsonLd(makeListing({ status: 'ACTIVE', availableQuantity: 3 }));
    if (!Array.isArray(result.offers)) {
      expect(result.offers.availability).toBe('https://schema.org/InStock');
    }
  });

  it('sets SoldOut for sold listing', () => {
    const result = generateProductJsonLd(makeListing({ status: 'SOLD' }));
    if (!Array.isArray(result.offers)) {
      expect(result.offers.availability).toBe('https://schema.org/SoldOut');
    }
  });

  it('includes aggregateRating when present', () => {
    const result = generateProductJsonLd(makeListing({ sellerAverageRating: 4.8, sellerTotalReviews: 42 }));
    expect(result.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '42',
    });
  });

  it('omits aggregateRating when no reviews', () => {
    const result = generateProductJsonLd(makeListing({ sellerAverageRating: null, sellerTotalReviews: 0 }));
    expect(result.aggregateRating).toBeUndefined();
  });

  it('omits image when no images', () => {
    const result = generateProductJsonLd(makeListing({ images: [] }));
    expect(result.image).toBeUndefined();
  });
});

describe('mapConditionToSchemaOrg', () => {
  it('maps NEW_WITH_TAGS to NewCondition', () => {
    expect(mapConditionToSchemaOrg('NEW_WITH_TAGS')).toBe('https://schema.org/NewCondition');
  });

  it('maps NEW_WITHOUT_TAGS to NewCondition', () => {
    expect(mapConditionToSchemaOrg('NEW_WITHOUT_TAGS')).toBe('https://schema.org/NewCondition');
  });

  it('maps GOOD to UsedCondition', () => {
    expect(mapConditionToSchemaOrg('GOOD')).toBe('https://schema.org/UsedCondition');
  });

  it('maps unknown condition to UsedCondition', () => {
    expect(mapConditionToSchemaOrg('VINTAGE')).toBe('https://schema.org/UsedCondition');
  });
});

describe('generateBreadcrumbJsonLd', () => {
  it('generates correct BreadcrumbList with 1-indexed positions', () => {
    const breadcrumbs: Breadcrumb[] = [
      { name: 'Home', href: '/' },
      { name: 'Electronics', href: '/c/electronics' },
      { name: 'Phones', href: '/c/electronics/phones' },
    ];
    const result = generateBreadcrumbJsonLd(breadcrumbs);
    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('BreadcrumbList');
    expect(result.itemListElement).toHaveLength(3);
    expect(result.itemListElement[0].position).toBe(1);
    expect(result.itemListElement[2].position).toBe(3);
  });

  it('omits item URL for the last breadcrumb', () => {
    const result = generateBreadcrumbJsonLd([
      { name: 'Home', href: '/' },
      { name: 'Shoes', href: '/c/shoes' },
    ]);
    expect(result.itemListElement[0].item).toBe('https://twicely.co/');
    expect(result.itemListElement[1].item).toBeUndefined();
  });
});

describe('generateItemListJsonLd', () => {
  it('limits to top 20 items', () => {
    const listings: ListingCardForSeo[] = Array.from({ length: 30 }, (_, i) => ({ slug: 'item-' + i }));
    const result = generateItemListJsonLd(listings, 'Shoes', '/c/shoes');
    expect(result['@type']).toBe('ItemList');
    expect(result.numberOfItems).toBe(30);
    expect(result.itemListElement).toHaveLength(20);
    expect(result.itemListElement[0].position).toBe(1);
  });
});

describe('organizationJsonLd', () => {
  it('has correct structure', () => {
    expect(organizationJsonLd['@context']).toBe('https://schema.org');
    expect(organizationJsonLd['@type']).toBe('Organization');
    expect(organizationJsonLd.name).toBe('Twicely');
  });
});

describe('websiteJsonLd', () => {
  it('has SearchAction', () => {
    expect(websiteJsonLd['@type']).toBe('WebSite');
    expect(websiteJsonLd.potentialAction['@type']).toBe('SearchAction');
  });
});

describe('generateSellerJsonLd', () => {
  it('generates Person with AggregateRating', () => {
    const result = generateSellerJsonLd({
      username: 'vintagefinds',
      displayName: 'Vintage Finds',
      bio: 'Curated vintage picks',
      avatarUrl: null,
      averageRating: 4.9,
      totalReviews: 100,
    });
    expect(result['@type']).toBe('Person');
    const rating = result.aggregateRating as Record<string, string>;
    expect(rating.ratingValue).toBe('4.9');
  });

  it('omits AggregateRating when no reviews', () => {
    const result = generateSellerJsonLd({
      username: 'newbie',
      displayName: 'New Seller',
      bio: null,
      avatarUrl: null,
      averageRating: null,
      totalReviews: 0,
    });
    expect(result.aggregateRating).toBeUndefined();
  });
});
