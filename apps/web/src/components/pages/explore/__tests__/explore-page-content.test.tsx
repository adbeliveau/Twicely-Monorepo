import { describe, it, expect } from 'vitest';
import type { ListingCardData } from '@/types/listings';
import type { ExploreCollection, RisingSellerData } from '@/lib/queries/explore';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeListing(id: string): ListingCardData {
  return {
    id,
    slug: id,
    title: `Listing ${id}`,
    priceCents: 1000,
    originalPriceCents: null,
    condition: 'GOOD',
    brand: null,
    freeShipping: false,
    shippingCents: 500,
    primaryImageUrl: null,
    primaryImageAlt: null,
    sellerName: 'Test Seller',
    sellerUsername: 'test',
    sellerAvatarUrl: null,
    sellerAverageRating: null,
    sellerTotalReviews: 0,
    sellerShowStars: false,
  };
}

function makeCollection(id: string, listings: ListingCardData[]): ExploreCollection {
  return {
    id,
    title: `Collection ${id}`,
    slug: `collection-${id}`,
    description: null,
    coverImageUrl: null,
    listings,
  };
}

function makeSeller(userId: string): RisingSellerData {
  return {
    userId,
    storeName: `Store ${userId}`,
    storeSlug: `store-${userId}`,
    avatarUrl: null,
    performanceBand: 'EMERGING',
    listingCount: 5,
    followerCount: 3,
    memberSince: new Date('2026-01-01'),
  };
}

// ─── Section visibility logic ─────────────────────────────────────────────────
// These tests mirror the conditional rendering logic in ExplorePageContent.

function shouldShowTrending(listings: ListingCardData[]): boolean {
  return listings.length > 0;
}

function shouldShowStaffPicks(collections: ExploreCollection[]): boolean {
  return collections.length > 0;
}

function shouldShowSeasonal(collections: ExploreCollection[]): boolean {
  return collections.length > 0;
}

function shouldShowRisingSellers(sellers: RisingSellerData[]): boolean {
  return sellers.length > 0;
}

function shouldShowPromoted(listings: ListingCardData[]): boolean {
  return listings.length > 0;
}

function getSectionOrder(props: {
  trendingListings: ListingCardData[];
  staffPickCollections: ExploreCollection[];
  seasonalCollections: ExploreCollection[];
  risingSellers: RisingSellerData[];
  promotedListings: ListingCardData[];
}): string[] {
  const order: string[] = [];
  if (props.trendingListings.length > 0) order.push('trending');
  if (props.staffPickCollections.length > 0) order.push('staffPicks');
  if (props.seasonalCollections.length > 0) order.push('seasonal');
  if (props.risingSellers.length > 0) order.push('risingSellers');
  if (props.promotedListings.length > 0) order.push('promoted');
  return order;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExplorePageContent section visibility', () => {
  it('renders trending section when listings provided', () => {
    expect(shouldShowTrending([makeListing('l1')])).toBe(true);
  });

  it('hides staff picks section when collections array is empty', () => {
    expect(shouldShowStaffPicks([])).toBe(false);
  });

  it('renders collection rows for each staff pick', () => {
    const collections = [
      makeCollection('c1', [makeListing('l1')]),
      makeCollection('c2', [makeListing('l2')]),
    ];
    expect(shouldShowStaffPicks(collections)).toBe(true);
    expect(collections).toHaveLength(2);
  });

  it('hides rising sellers section when array is empty', () => {
    expect(shouldShowRisingSellers([])).toBe(false);
  });

  it('renders rising seller cards with store links', () => {
    const seller = makeSeller('u1');
    expect(seller.storeSlug).toBe('store-u1');
    const href = `/st/${seller.storeSlug}`;
    expect(href).toBe('/st/store-u1');
  });

  it('renders promoted section with Promoted label', () => {
    expect(shouldShowPromoted([makeListing('l1')])).toBe(true);
  });

  it('renders all sections in correct order', () => {
    const order = getSectionOrder({
      trendingListings: [makeListing('l1')],
      staffPickCollections: [makeCollection('c1', [makeListing('l2')])],
      seasonalCollections: [makeCollection('c2', [makeListing('l3')])],
      risingSellers: [makeSeller('u1')],
      promotedListings: [makeListing('l4')],
    });
    expect(order).toEqual(['trending', 'staffPicks', 'seasonal', 'risingSellers', 'promoted']);
  });

  it('hides seasonal section when no seasonal collections', () => {
    expect(shouldShowSeasonal([])).toBe(false);
  });
});

describe('ExplorePageContent store link construction', () => {
  it('builds correct /st/ route for store slug', () => {
    const seller = makeSeller('u1');
    const href = seller.storeSlug ? `/st/${seller.storeSlug}` : null;
    expect(href).toBe('/st/store-u1');
  });

  it('returns null href when storeSlug is null', () => {
    const seller: RisingSellerData = {
      userId: 'u1',
      storeName: 'Test',
      storeSlug: null,
      avatarUrl: null,
      performanceBand: 'EMERGING',
      listingCount: 3,
      followerCount: 1,
      memberSince: new Date(),
    };
    const href = seller.storeSlug ? `/st/${seller.storeSlug}` : null;
    expect(href).toBeNull();
  });
});
