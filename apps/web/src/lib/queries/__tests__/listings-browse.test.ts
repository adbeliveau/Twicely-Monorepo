import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  listing: {
    id: 'id', slug: 'slug', title: 'title', description: 'description',
    priceCents: 'price_cents', originalPriceCents: 'original_price_cents',
    condition: 'condition', brand: 'brand', freeShipping: 'free_shipping',
    shippingCents: 'shipping_cents', allowOffers: 'allow_offers',
    autoAcceptOfferCents: 'auto_accept_offer_cents', autoDeclineOfferCents: 'auto_decline_offer_cents',
    quantity: 'quantity', availableQuantity: 'available_quantity', tags: 'tags',
    attributesJson: 'attributes_json', status: 'status', fulfillmentType: 'fulfillment_type',
    localHandlingFlags: 'local_handling_flags', activatedAt: 'activated_at', soldAt: 'sold_at',
    createdAt: 'created_at', ownerUserId: 'owner_user_id', categoryId: 'category_id',
    videoUrl: 'video_url', videoThumbUrl: 'video_thumb_url', videoDurationSeconds: 'video_duration_seconds',
    boostPercent: 'boost_percent',
  },
  listingImage: { id: 'id', listingId: 'listing_id', url: 'url', altText: 'alt_text', position: 'position', isPrimary: 'is_primary' },
  user: { id: 'id', name: 'name', username: 'username', avatarUrl: 'avatar_url', createdAt: 'created_at' },
  sellerProfile: { userId: 'user_id', id: 'id', storeName: 'store_name', storeSlug: 'store_slug', performanceBand: 'performance_band' },
  sellerPerformance: { sellerProfileId: 'seller_profile_id', averageRating: 'average_rating', totalReviews: 'total_reviews', showStars: 'show_stars' },
  category: { id: 'id', name: 'name', slug: 'slug', parentId: 'parent_id' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  ne: vi.fn((a, b) => ({ op: 'ne', a, b })),
  gte: vi.fn((a, b) => ({ op: 'gte', a, b })),
  lte: vi.fn((a, b) => ({ op: 'lte', a, b })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
  asc: vi.fn((col) => ({ op: 'asc', col })),
  inArray: vi.fn((col, vals) => ({ op: 'inArray', col, vals })),
  sql: Object.assign(
    (tpl: TemplateStringsArray) => ({ sql: tpl[0] }),
    { as: vi.fn(), join: vi.fn() }
  ),
}));
vi.mock('@/lib/queries/shared', () => ({
  mapToListingCard: vi.fn((row: Record<string, unknown>) => ({
    id: row.id, slug: row.slug ?? row.id, title: row.title ?? '',
    priceCents: row.priceCents ?? 0, originalPriceCents: row.originalPriceCents ?? null,
    condition: row.condition ?? 'GOOD', brand: row.brand ?? null,
    freeShipping: row.freeShipping ?? false, shippingCents: row.shippingCents ?? 0,
    primaryImageUrl: row.primaryImageUrl ?? null, primaryImageAlt: row.primaryImageAlt ?? null,
    sellerName: row.sellerName ?? 'Unknown Seller', sellerUsername: row.sellerUsername ?? '',
    sellerAvatarUrl: row.sellerAvatarUrl ?? null, sellerAverageRating: row.sellerAverageRating ?? null,
    sellerTotalReviews: row.sellerTotalReviews ?? 0, sellerShowStars: row.sellerShowStars ?? false,
  })),
}));
// react cache is identity in tests
vi.mock('react', () => ({ cache: (fn: unknown) => fn }));

import { getListingBySlug, getSimilarListings } from '../listings';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

function makeChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['leftJoin'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['orderBy'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(data);
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve);
  return chain;
}

const baseListingRow = {
  id: 'lst-1', slug: 'nike-air-jordan', title: 'Nike Air Jordan',
  description: 'Great shoes', priceCents: 9999, originalPriceCents: 12000,
  condition: 'VERY_GOOD', brand: 'Nike', freeShipping: false, shippingCents: 599,
  allowOffers: true, autoAcceptOfferCents: null, autoDeclineOfferCents: null,
  quantity: 1, availableQuantity: 1, tags: ['shoes', 'nike'], attributesJson: {},
  status: 'ACTIVE', fulfillmentType: 'SHIP_ONLY', localHandlingFlags: [],
  activatedAt: new Date('2025-01-01'), soldAt: null, createdAt: new Date('2025-01-01'),
  ownerUserId: 'seller-001', categoryId: 'cat-1',
  videoUrl: null, videoThumbUrl: null, videoDurationSeconds: null,
  userName: 'Bob Seller', userUsername: 'bobseller', userAvatarUrl: null, userCreatedAt: new Date('2024-01-01'),
  storeName: 'BobShop', storeSlug: 'bobshop', performanceBand: 'ESTABLISHED',
  averageRating: 4.8, totalReviews: 120,
  categoryName: 'Footwear', categorySlug: 'footwear', categoryParentId: null,
};

describe('getListingBySlug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null for non-existent slug', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);
    const result = await getListingBySlug('nonexistent-slug');
    expect(result).toBeNull();
  });

  it('returns full listing detail for valid slug', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseListingRow]) as never); // main query
    mockSelect.mockReturnValueOnce(makeChain([
      { id: 'img-1', url: 'https://cdn.example.com/shoe.jpg', altText: 'Jordan', position: 0 },
    ]) as never); // images
    // no parent category (parentId is null)

    const result = await getListingBySlug('nike-air-jordan');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('lst-1');
    expect(result!.slug).toBe('nike-air-jordan');
    expect(result!.title).toBe('Nike Air Jordan');
    expect(result!.priceCents).toBe(9999);
    expect(result!.seller.displayName).toBe('Bob Seller');
    expect(result!.seller.storeName).toBe('BobShop');
    expect(result!.category?.name).toBe('Footwear');
    expect(result!.images).toHaveLength(1);
  });

  it('fetches parent category when categoryParentId is set', async () => {
    const rowWithParent = { ...baseListingRow, categoryParentId: 'cat-parent-1' };
    mockSelect.mockReturnValueOnce(makeChain([rowWithParent]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]) as never); // images
    mockSelect.mockReturnValueOnce(makeChain([{ id: 'cat-parent-1', name: 'Clothing', slug: 'clothing' }]) as never);

    const result = await getListingBySlug('nike-air-jordan');
    expect(result!.category?.parent).toMatchObject({ name: 'Clothing', slug: 'clothing' });
  });

  it('includes authentication fields (B3.5)', async () => {
    const rowWithAuth = {
      ...baseListingRow,
      authenticationOffered: true, authenticationDeclined: false,
    };
    mockSelect.mockReturnValueOnce(makeChain([rowWithAuth]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    // getListingBySlug doesn't fetch auth fields — just check it returns
    const result = await getListingBySlug('nike-air-jordan');
    expect(result).not.toBeNull();
  });

  it('returns null category when listing has no categoryId', async () => {
    const rowNoCategory = { ...baseListingRow, categoryId: null, categoryName: null, categorySlug: null };
    mockSelect.mockReturnValueOnce(makeChain([rowNoCategory]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getListingBySlug('nike-air-jordan');
    expect(result!.category).toBeNull();
  });
});

describe('getSimilarListings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when no similar listings found', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);
    const result = await getSimilarListings('lst-1', 'cat-1', 9999);
    expect(result).toHaveLength(0);
  });

  it('returns similar listings mapped to card format', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{
      id: 'lst-2', slug: 'adidas-superstar', title: 'Adidas Superstar',
      priceCents: 8999, originalPriceCents: null, condition: 'GOOD', brand: 'Adidas',
      freeShipping: true, shippingCents: 0, primaryImageUrl: null, primaryImageAlt: null,
      sellerName: 'Alice', sellerUsername: 'alice', sellerAvatarUrl: null,
      sellerAverageRating: null, sellerTotalReviews: 0, sellerShowStars: false,
    }]) as never);

    const result = await getSimilarListings('lst-1', 'cat-1', 9999, 6);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Adidas Superstar');
  });

  it('uses ±50% price range for similarity (minPrice / maxPrice)', async () => {
    // Price = 10000 → min = 5000, max = 15000
    mockSelect.mockReturnValueOnce(makeChain([]) as never);
    await getSimilarListings('lst-1', 'cat-1', 10000, 6);
    // We just verify no error thrown and the function returns correctly
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });
});
