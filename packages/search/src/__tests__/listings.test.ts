import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockDbSelect, mockGetPlatformSetting, mockCollectionSearch, mockCalculatePromotedSlots,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockGetPlatformSetting: vi.fn(),
  mockCollectionSearch: vi.fn(),
  mockCalculatePromotedSlots: vi.fn(),
}));

vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));
vi.mock('@twicely/db/schema', () => ({
  listing: {
    id: 'id', slug: 'slug', title: 'title', description: 'description',
    priceCents: 'price_cents', originalPriceCents: 'original_price_cents',
    condition: 'condition', brand: 'brand', freeShipping: 'free_shipping',
    shippingCents: 'shipping_cents', status: 'status', categoryId: 'category_id',
    createdAt: 'created_at', boostPercent: 'boost_percent', ownerUserId: 'owner_user_id',
    availableQuantity: 'available_quantity',
  },
  listingImage: { listingId: 'listing_id', url: 'url', altText: 'alt_text', isPrimary: 'is_primary' },
  user: { id: 'id', name: 'name', username: 'username', avatarUrl: 'avatar_url' },
  sellerProfile: { id: 'id', userId: 'user_id' },
  sellerPerformance: { sellerProfileId: 'seller_profile_id', averageRating: 'average_rating', totalReviews: 'total_reviews', showStars: 'show_stars' },
  category: { id: 'id', parentId: 'parent_id' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  or: vi.fn((...args) => ({ op: 'or', args })),
  ilike: vi.fn((col, pat) => ({ op: 'ilike', col, pat })),
  gte: vi.fn((a, b) => ({ op: 'gte', a, b })),
  lte: vi.fn((a, b) => ({ op: 'lte', a, b })),
  inArray: vi.fn((col, vals) => ({ op: 'inArray', col, vals })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
  asc: vi.fn((col) => ({ op: 'asc', col })),
  sql: Object.assign(
    (tpl: TemplateStringsArray) => ({ sql: tpl[0] }),
    { as: vi.fn(), join: vi.fn() }
  ),
}));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));
vi.mock('../typesense-client', () => ({
  getTypesenseClient: vi.fn(() => ({
    collections: vi.fn(() => ({
      documents: vi.fn(() => ({ search: mockCollectionSearch })),
    })),
  })),
}));
vi.mock('../typesense-schema', () => ({
  LISTINGS_COLLECTION: 'listings',
  DEFAULT_QUERY_BY: 'title,description,brand',
  DEFAULT_QUERY_WEIGHTS: '3,1,2',
}));
vi.mock('@twicely/commerce/boosting', () => ({
  calculatePromotedSlots: mockCalculatePromotedSlots,
}));
vi.mock('../shared', () => ({
  mapToListingCard: vi.fn((row: Record<string, unknown>) => ({
    id: String(row.id ?? ''), slug: String(row.slug ?? row.id ?? ''),
    title: String(row.title ?? ''), priceCents: Number(row.priceCents ?? 0),
    originalPriceCents: null, condition: String(row.condition ?? 'GOOD'),
    brand: null, freeShipping: Boolean(row.freeShipping), shippingCents: 0,
    primaryImageUrl: null, primaryImageAlt: null,
    sellerName: 'Unknown Seller', sellerUsername: '', sellerAvatarUrl: null,
    sellerAverageRating: null, sellerTotalReviews: 0, sellerShowStars: false,
    isBoosted: Number(row.boostPercent ?? 0) > 0,
  })),
}));

import { searchListings } from '../listings';

function makeDbChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['leftJoin'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['orderBy'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockReturnValue(chain);
  chain['offset'] = vi.fn().mockResolvedValue(data);
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve);
  chain['groupBy'] = vi.fn().mockResolvedValue(data);
  return chain;
}

const baseDoc = {
  id: 'lst-1', slug: 'item-1', title: 'Nike Air Jordan', priceCents: 9999,
  condition: 'VERY_GOOD', brand: 'Nike', freeShipping: false, shippingCents: 599,
  primaryImageUrl: null, primaryImageAlt: null, sellerName: 'Bob',
  sellerUsername: 'bob', sellerAvatarUrl: null, sellerAverageRating: null,
  sellerTotalReviews: 0, sellerShowStars: false, boostPercent: 0,
};

describe('searchListings — Typesense path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns results from Typesense on success', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce(24) // defaultPageSize
      .mockResolvedValueOnce(48); // maxPageSize
    mockCalculatePromotedSlots.mockResolvedValue(0);
    mockCollectionSearch.mockResolvedValue({
      found: 1,
      hits: [{ document: baseDoc }],
    });

    const result = await searchListings({ q: 'nike' });
    expect(result.listings).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('calculates correct totalPages from Typesense found count', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce(10) // defaultPageSize = 10
      .mockResolvedValueOnce(48);
    mockCalculatePromotedSlots.mockResolvedValue(0);
    mockCollectionSearch.mockResolvedValue({
      found: 25,
      hits: Array.from({ length: 10 }, () => ({ document: baseDoc })),
    });

    const result = await searchListings({ q: 'shoes' });
    expect(result.totalPages).toBe(3); // ceil(25/10)
  });

  it('falls back to PostgreSQL when Typesense throws', async () => {
    mockGetPlatformSetting.mockResolvedValue(24);
    mockCollectionSearch.mockRejectedValue(new Error('Typesense unavailable'));
    mockCalculatePromotedSlots.mockResolvedValue(0);
    mockDbSelect
      .mockReturnValueOnce(makeDbChain([{ count: 0 }]) as never)
      .mockReturnValueOnce(makeDbChain([]) as never);

    const result = await searchListings({ q: 'nike' });
    expect(result.listings).toHaveLength(0);
    expect(mockDbSelect).toHaveBeenCalled();
  });
});

describe('searchListings — PostgreSQL fallback path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty results when no listings match', async () => {
    mockGetPlatformSetting.mockResolvedValue(24);
    mockCollectionSearch.mockRejectedValue(new Error('unavailable'));
    mockCalculatePromotedSlots.mockResolvedValue(0);
    mockDbSelect
      .mockReturnValueOnce(makeDbChain([{ count: 0 }]) as never)
      .mockReturnValueOnce(makeDbChain([]) as never);

    const result = await searchListings({ q: 'zzznomatch' });
    expect(result.listings).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('includes freeShipping filter when specified', async () => {
    mockGetPlatformSetting.mockResolvedValue(24);
    mockCollectionSearch.mockRejectedValue(new Error('unavailable'));
    mockCalculatePromotedSlots.mockResolvedValue(0);
    mockDbSelect
      .mockReturnValueOnce(makeDbChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(makeDbChain([{
        id: 'lst-fs', slug: 'free-ship-item', title: 'Free Shipping Item', priceCents: 2000,
        condition: 'GOOD', boostPercent: 0,
      }]) as never);

    const result = await searchListings({ freeShipping: true });
    expect(result.listings).toHaveLength(1);
  });

  it('respects page and limit parameters', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce(24) // default (not used when limit specified)
      .mockResolvedValueOnce(48); // maxPageSize
    mockCollectionSearch.mockRejectedValue(new Error('unavailable'));
    mockCalculatePromotedSlots.mockResolvedValue(0);
    mockDbSelect
      .mockReturnValueOnce(makeDbChain([{ count: 100 }]) as never)
      .mockReturnValueOnce(makeDbChain([]) as never);

    const result = await searchListings({ page: 2, limit: 10 });
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(10); // 100 / 10
  });
});

describe('enforcePromotedCap (D2.4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('caps boosted listings to 30% of total results', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce(24)
      .mockResolvedValueOnce(48);
    mockCalculatePromotedSlots.mockResolvedValue(3); // allow 3 slots

    // 5 boosted + 5 organic = 10 total
    mockCollectionSearch.mockResolvedValue({
      found: 10,
      hits: [
        ...Array.from({ length: 5 }, (_, i) => ({
          document: { ...baseDoc, id: `boosted-${i}`, boostPercent: 20 },
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          document: { ...baseDoc, id: `organic-${i}`, boostPercent: 0 },
        })),
      ],
    });

    const result = await searchListings({});
    const boosted = result.listings.filter((l) => l.isBoosted);
    const demoted = result.listings.filter((l) => !l.isBoosted);
    expect(boosted.length).toBe(3);
    expect(demoted.length).toBe(7); // 5 organic + 2 demoted
  });

  it('preserves all boosted listings when count is under cap', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce(24)
      .mockResolvedValueOnce(48);
    mockCalculatePromotedSlots.mockResolvedValue(6); // cap = 6, only 2 boosted

    mockCollectionSearch.mockResolvedValue({
      found: 2,
      hits: [
        { document: { ...baseDoc, id: 'b-1', boostPercent: 10 } },
        { document: { ...baseDoc, id: 'b-2', boostPercent: 10 } },
      ],
    });

    const result = await searchListings({});
    const boosted = result.listings.filter((l) => l.isBoosted);
    expect(boosted.length).toBe(2);
  });

  it('returns empty listings when Typesense returns no hits', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce(24)
      .mockResolvedValueOnce(48);
    mockCalculatePromotedSlots.mockResolvedValue(0);
    mockCollectionSearch.mockResolvedValue({ found: 0, hits: [] });

    const result = await searchListings({ q: 'rare item' });
    expect(result.listings).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });
});
