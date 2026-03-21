import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val, type: 'eq' })),
  and: vi.fn((...args: unknown[]) => ({ args, type: 'and' })),
  inArray: vi.fn((col, vals) => ({ col, vals, type: 'inArray' })),
  asc: vi.fn((col) => ({ col, type: 'asc' })),
  ne: vi.fn((col, val) => ({ col, val, type: 'ne' })),
  gte: vi.fn((col, val) => ({ col, val, type: 'gte' })),
  lte: vi.fn((col, val) => ({ col, val, type: 'lte' })),
  desc: vi.fn((col) => ({ col, type: 'desc' })),
  sql: vi.fn(() => ({ type: 'sql' })),
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', slug: 'slug', title: 'title', status: 'status', ownerUserId: 'owner_user_id', categoryId: 'category_id', priceCents: 'price_cents', description: 'description', condition: 'condition', brand: 'brand', freeShipping: 'free_shipping', shippingCents: 'shipping_cents', allowOffers: 'allow_offers', autoAcceptOfferCents: 'auto_accept_offer_cents', autoDeclineOfferCents: 'auto_decline_offer_cents', quantity: 'quantity', availableQuantity: 'available_quantity', tags: 'tags', attributesJson: 'attributes_json', fulfillmentType: 'fulfillment_type', localHandlingFlags: 'local_handling_flags', activatedAt: 'activated_at', createdAt: 'created_at', originalPriceCents: 'original_price_cents', offerExpiryHours: 'offer_expiry_hours', isPrimary: 'is_primary' },
  listingImage: { id: 'id', url: 'url', altText: 'alt_text', position: 'position', listingId: 'listing_id', isPrimary: 'is_primary' },
  user: { id: 'id', name: 'name', username: 'username', avatarUrl: 'avatar_url', createdAt: 'created_at' },
  sellerProfile: { userId: 'user_id', storeName: 'store_name', id: 'id' },
  sellerPerformance: { averageRating: 'average_rating', totalReviews: 'total_reviews', sellerProfileId: 'seller_profile_id', showStars: 'show_stars' },
  category: { id: 'id', name: 'name', slug: 'slug', parentId: 'parent_id' },
}));

vi.mock('@/lib/queries/shared', () => ({
  mapToListingCard: vi.fn((row: unknown) => row),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeReservedListingRow() {
  return {
    id: 'lst-reserved-001',
    slug: 'nike-air-jordan-reserved',
    title: 'Nike Air Jordan',
    description: 'Like new condition',
    priceCents: 15000,
    originalPriceCents: null,
    condition: 'LIKE_NEW',
    brand: 'Nike',
    freeShipping: false,
    shippingCents: 800,
    allowOffers: true,
    autoAcceptOfferCents: null,
    autoDeclineOfferCents: null,
    quantity: 1,
    availableQuantity: 1,
    tags: [],
    attributesJson: null,
    status: 'RESERVED',
    fulfillmentType: 'LOCAL_ONLY',
    localHandlingFlags: [],
    activatedAt: new Date(),
    createdAt: new Date(),
    ownerUserId: 'seller-001',
    categoryId: 'cat-001',
    userName: 'Test Seller',
    userUsername: 'testseller',
    userAvatarUrl: null,
    userCreatedAt: new Date(),
    storeName: null,
    averageRating: null,
    totalReviews: null,
    categoryName: 'Shoes',
    categorySlug: 'shoes',
    categoryParentId: null,
  };
}

function makeJoinChain(rows: unknown[]) {
  const chain = {
    leftJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getListingBySlug — RESERVED listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns RESERVED listing when queried by slug', async () => {
    const reservedRow = makeReservedListingRow();
    const joinChain = makeJoinChain([reservedRow]);
    mockDbSelect.mockReturnValue({ from: vi.fn().mockReturnValue(joinChain) });

    // Second select: images (empty)
    mockDbSelect.mockReturnValueOnce({ from: vi.fn().mockReturnValue(joinChain) });
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { getListingBySlug } = await import('../listings');
    const result = await getListingBySlug('nike-air-jordan-reserved');

    expect(result).not.toBeNull();
    expect(result?.status).toBe('RESERVED');
  });

  it('RESERVED listing includes all expected fields', async () => {
    const reservedRow = makeReservedListingRow();
    const joinChain = makeJoinChain([reservedRow]);
    mockDbSelect.mockReturnValueOnce({ from: vi.fn().mockReturnValue(joinChain) });
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { getListingBySlug } = await import('../listings');
    const result = await getListingBySlug('nike-air-jordan-reserved');

    expect(result).toMatchObject({
      id: 'lst-reserved-001',
      slug: 'nike-air-jordan-reserved',
      title: 'Nike Air Jordan',
      status: 'RESERVED',
      priceCents: 15000,
    });
    expect(result?.seller).toBeDefined();
    expect(result?.images).toBeDefined();
  });
});
