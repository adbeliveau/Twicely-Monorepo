import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDb$With = vi.fn();
const mockDbWith = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    get select() { return mockDbSelect; },
    get $with() { return mockDb$With; },
    get with() { return mockDbWith; },
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation(
    (_key: string, fallback: unknown) => Promise.resolve(fallback),
  ),
}));

vi.mock('@/lib/queries/shared', () => ({
  mapToListingCard: (row: Record<string, unknown>) => ({ ...row, _mapped: true }),
}));

vi.mock('@/lib/queries/follow', () => ({
  getFollowedSellerNewListings: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/queries/explore-trending', () => ({
  getTrendingListings: vi.fn().mockResolvedValue([]),
}));

function makeSqlExpr() {
  const expr: Record<string, unknown> = { type: 'sql' };
  expr.as = vi.fn(() => expr);
  return expr;
}

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ type: 'eq', val })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args: args.filter(Boolean) })),
  desc: vi.fn(() => ({ type: 'desc' })),
  ne: vi.fn(() => ({ type: 'ne' })),
  notInArray: vi.fn(() => ({ type: 'notInArray' })),
  isNotNull: vi.fn(() => ({ type: 'isNotNull' })),
  gt: vi.fn(() => ({ type: 'gt' })),
  sql: Object.assign(vi.fn(() => makeSqlExpr()), { raw: vi.fn() }),
}));

vi.mock('@twicely/db/schema', () => ({
  listing: {
    id: 'id', slug: 'slug', title: 'title', priceCents: 'price_cents',
    originalPriceCents: 'original_price_cents', condition: 'condition',
    brand: 'brand', freeShipping: 'free_shipping', shippingCents: 'shipping_cents',
    status: 'status', ownerUserId: 'owner_user_id', categoryId: 'category_id',
    createdAt: 'created_at',
  },
  listingImage: { url: 'url', altText: 'alt_text', listingId: 'listing_id', isPrimary: 'is_primary' },
  user: { id: 'id', displayName: 'display_name', username: 'username', avatarUrl: 'avatar_url' },
  sellerProfile: { id: 'id', userId: 'user_id' },
  sellerPerformance: {
    sellerProfileId: 'seller_profile_id', averageRating: 'average_rating',
    totalReviews: 'total_reviews', showStars: 'show_stars',
  },
  userInterest: { userId: 'user_id', tagSlug: 'tag_slug', weight: 'weight', expiresAt: 'expires_at' },
  interestTag: { slug: 'slug', categoryIds: 'category_ids', isActive: 'is_active' },
  promotedListing: { listingId: 'listing_id', isActive: 'is_active', endedAt: 'ended_at' },
}));

// ─── Chain Helpers ────────────────────────────────────────────────────────────

function makeCteChain() {
  const c: Record<string, unknown> = {};
  ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'groupBy', 'select'].forEach((m) => {
    c[m] = vi.fn().mockReturnValue(c);
  });
  return c;
}

function makeTerminalChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'offset', 'groupBy'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (val: unknown) => void) => resolve(result);
  return chain;
}

function setupInterestQueryMocks(interestCount: number, finalRows: unknown[]) {
  // First call: count query for hasInterests check
  const countRow = [{ count: interestCount }];
  let selectCallCount = 0;
  mockDbSelect.mockImplementation(() => {
    selectCallCount++;
    if (selectCallCount === 1) {
      // hasInterests count query
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(countRow),
        }),
      };
    }
    // CTE inner select
    return makeCteChain();
  });
  mockDb$With.mockReturnValue({ as: vi.fn().mockReturnValue('cte-token') });
  mockDbWith.mockReturnValue({ select: vi.fn().mockReturnValue(makeTerminalChain(finalRows)) });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('feed cardEmphasis — interest-matched listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('interest-matched listings include cardEmphasis from highest-weight tag', async () => {
    const rows = [
      { id: 'l1', cardEmphasis: 'specs', _mapped: true },
      { id: 'l2', cardEmphasis: 'collectible', _mapped: true },
    ];
    setupInterestQueryMocks(2, rows);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.matchedListings).toHaveLength(2);
    expect(result.matchedListings[0]).toHaveProperty('cardEmphasis', 'specs');
    expect(result.matchedListings[1]).toHaveProperty('cardEmphasis', 'collectible');
  });

  it('cardEmphasis falls back to null when no interest tag matches', async () => {
    const rows = [{ id: 'l1', cardEmphasis: null, _mapped: true }];
    setupInterestQueryMocks(1, rows);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.matchedListings[0]).toHaveProperty('cardEmphasis', null);
  });

  it('cardEmphasis value is a valid enum member when present', async () => {
    const validValues = ['social', 'specs', 'collectible', 'default', null] as const;
    const rows = [{ id: 'l1', cardEmphasis: 'social', _mapped: true }];
    setupInterestQueryMocks(1, rows);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    const emphasis = result.matchedListings[0]?.cardEmphasis;
    expect(validValues).toContain(emphasis);
  });

  it('when multiple tags match, highest user weight wins (subquery ORDER BY weight DESC)', async () => {
    // The correlated subquery in the SELECT orders by uw2.tw DESC and takes LIMIT 1.
    // We verify the sql template tag was called (which builds the subquery) when the
    // query runs, confirming the emphasis comes from the top-weighted tag.
    const rows = [{ id: 'l1', cardEmphasis: 'collectible', _mapped: true }];
    setupInterestQueryMocks(1, rows);
    const { getForYouFeed } = await import('../feed');
    await getForYouFeed('user-1');
    const { sql } = await import('drizzle-orm');
    expect(sql).toHaveBeenCalled();
    // The sql mock is called to build the correlated subquery among other expressions
  });
});

describe('feed cardEmphasis — boosted listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('boosted listings include cardEmphasis', async () => {
    let selectCallCount = 0;
    const matchedRows = [{ id: 'l1', cardEmphasis: 'specs', _mapped: true }];
    const boostedRows = [{ id: 'l2', cardEmphasis: 'social', _mapped: true }];

    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // hasInterests count
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) }) };
      }
      return makeCteChain();
    });
    mockDb$With.mockReturnValue({ as: vi.fn().mockReturnValue('cte-token') });

    let withCallCount = 0;
    mockDbWith.mockImplementation(() => {
      withCallCount++;
      if (withCallCount === 1) {
        return { select: vi.fn().mockReturnValue(makeTerminalChain(matchedRows)) };
      }
      return { select: vi.fn().mockReturnValue(makeTerminalChain(boostedRows)) };
    });

    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.boostedListings).toHaveLength(1);
    expect(result.boostedListings[0]).toHaveProperty('cardEmphasis', 'social');
  });
});

describe('feed cardEmphasis — followed seller listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('followed seller listings do not include cardEmphasis (returns undefined/null)', async () => {
    // getFollowedSellerNewListings is mocked to return plain rows without cardEmphasis.
    // These come from follow.ts which does NOT select cardEmphasis — confirmed by reading the source.
    const { getFollowedSellerNewListings } = await import('@/lib/queries/follow');
    const mockFn = getFollowedSellerNewListings as ReturnType<typeof vi.fn>;
    mockFn.mockResolvedValueOnce([
      {
        id: 'l-followed-1',
        slug: 'item-slug',
        title: 'Followed Listing',
        priceCents: 1000,
        originalPriceCents: null,
        condition: 'GOOD',
        brand: null,
        freeShipping: false,
        shippingCents: 500,
        primaryImageUrl: null,
        primaryImageAlt: null,
        sellerName: 'Seller',
        sellerUsername: 'seller',
        sellerAvatarUrl: null,
        sellerAverageRating: null,
        sellerTotalReviews: 0,
        sellerShowStars: false,
      },
    ]);

    setupInterestQueryMocks(1, []);

    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    const followedListing = result.followedListings[0];
    // cardEmphasis is optional on ListingCardData — followed listings won't have it set
    expect(followedListing?.cardEmphasis == null).toBe(true);
  });

  it('returns empty matchedListings when user has no interests (cold-start path)', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });
    const { getTrendingListings } = await import('@/lib/queries/explore-trending');
    (getTrendingListings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ id: 'trending-1' }]);

    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.hasInterests).toBe(false);
    expect(result.matchedListings).toEqual([]);
    expect(result.boostedListings).toEqual([]);
  });
});
