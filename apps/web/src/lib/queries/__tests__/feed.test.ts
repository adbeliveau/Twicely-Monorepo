import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module Mocks (hoisted) ───────────────────────────────────────────────────

const mockGetFollowedSellerNewListings = vi.fn();
const mockGetPlatformSetting = vi.fn().mockResolvedValue(20);
vi.mock('@/lib/queries/follow', () => ({
  getFollowedSellerNewListings: mockGetFollowedSellerNewListings,
}));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));
vi.mock('@/lib/queries/shared', () => ({
  mapToListingCard: (row: Record<string, unknown>) => row,
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((_c: unknown, v: unknown) => `eq:${String(v)}`),
    and: vi.fn((...a: unknown[]) => a.filter(Boolean)),
    desc: vi.fn(() => 'desc'),
    ne: vi.fn(() => 'ne'),
    notInArray: vi.fn((_c: unknown, ids: unknown) => `notInArray:${JSON.stringify(ids)}`),
    isNotNull: vi.fn(() => 'isNotNull'),
    gt: vi.fn(() => 'gt'),
    // sql template tag must produce a chainable expression — getInterestMatchedListings
    // calls sql`...`.as('totalWeight') so the returned object needs an .as() method.
    sql: Object.assign(
      vi.fn(() => ({ as: vi.fn().mockReturnValue('sql-expr-aliased') })),
      { raw: vi.fn() },
    ),
    count: vi.fn(() => 'count-agg'),
  };
});

// ─── DB Mock setup ────────────────────────────────────────────────────────────
// Explicit-per-call approach: we know the exact order db methods are invoked.
//
// Call order in getForYouFeed:
//   Call 1: db.select({count}).from().where()  → [{ count: N }]  (terminal: .where() is awaited)
//   Call 2: db.select({tagSlug,...}).from().where().groupBy()  → not awaited (CTE sub-select)
//   Call 3: db.with(cte).select({...}).from()...where().orderBy().limit()  → matchedRows
//   Call 4: db.select({tagSlug}).from().where().groupBy()  → not awaited (CTE sub-select)
//   Call 5: db.with(cte).select({...}).from()...where().orderBy().limit()  → boostedRows

const dbSelectMock = vi.fn();
const dbWithMock = vi.fn();
const db$WithMock = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    get select() { return dbSelectMock; },
    get $with() { return db$WithMock; },
    get with() { return dbWithMock; },
  },
}));

// Build a non-terminal synchronous chain for sub-selects (CTE definitions)
function subSelectChain() {
  const c: Record<string, unknown> = {};
  c.from = vi.fn().mockReturnValue(c);
  c.where = vi.fn().mockReturnValue(c);
  c.groupBy = vi.fn().mockReturnValue(c);
  c.orderBy = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnThis();
  return c;
}

// Build a terminal chain for the count query: .where() resolves to the array
function countChain(count: number) {
  const wherePromise = Promise.resolve([{ count }]);
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(wherePromise),
    }),
  };
}

// Build the main query chain for db.with(cte): .limit() resolves to rows
function mainQueryChain(rows: unknown[]) {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
  const groupByFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
  const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn, groupBy: groupByFn });
  const joinBase = {
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: whereFn,
  };
  const fromFn = vi.fn().mockReturnValue(joinBase);
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });
  return { select: selectFn, limitFn };
}

function setupDbMocks(matchedRows: unknown[], boostedRows: unknown[], count: number) {
  // db.select() call order:
  //   1st = count query
  //   2nd = user_weights CTE sub-select (inside getInterestMatchedListings)
  //   3rd = user_tags CTE sub-select (inside getBoostedInterestListings)
  dbSelectMock
    .mockReturnValueOnce(countChain(count))
    .mockReturnValue(subSelectChain()); // 2nd and 3rd calls

  // db.$with().as() — just a token
  db$WithMock.mockReturnValue({ as: vi.fn().mockReturnValue('cte-token') });

  // db.with(cte): 1st call = matched query, 2nd call = boosted query
  let withCallIndex = 0;
  const withResults = [matchedRows, boostedRows];
  dbWithMock.mockImplementation(() => {
    const rows = withResults[withCallIndex] ?? [];
    withCallIndex++;
    return mainQueryChain(rows);
  });
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeListing(id: string) {
  return {
    id,
    slug: `listing-${id}`,
    title: 'Test',
    priceCents: 1000,
    originalPriceCents: null,
    condition: 'GOOD',
    brand: null,
    freeShipping: false,
    shippingCents: 0,
    primaryImageUrl: null,
    primaryImageAlt: null,
    sellerName: 'Seller',
    sellerUsername: 'seller',
    sellerAvatarUrl: null,
    sellerAverageRating: null,
    sellerTotalReviews: 0,
    sellerShowStars: false,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getForYouFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockResolvedValue(20);
  });

  it('returns empty feed for user with no follows and no interests', async () => {
    setupDbMocks([], [], 0);
    mockGetFollowedSellerNewListings.mockResolvedValue([]);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.followedListings).toHaveLength(0);
    expect(result.matchedListings).toHaveLength(0);
    expect(result.boostedListings).toHaveLength(0);
    expect(result.watchlistDrops).toHaveLength(0);
  });

  it('hasInterests is false when user has no interest records', async () => {
    setupDbMocks([], [], 0);
    mockGetFollowedSellerNewListings.mockResolvedValue([]);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.hasInterests).toBe(false);
  });

  it('hasInterests is true when user has at least one interest', async () => {
    setupDbMocks([], [], 3);
    mockGetFollowedSellerNewListings.mockResolvedValue([]);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.hasInterests).toBe(true);
  });

  it('followedListings contains listings from getFollowedSellerNewListings', async () => {
    setupDbMocks([], [], 0);
    const listing1 = makeListing('listing-1');
    mockGetFollowedSellerNewListings.mockResolvedValue([listing1]);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.followedListings).toHaveLength(1);
    expect(result.followedListings[0]?.id).toBe('listing-1');
  });

  it('followedListings delegates to getFollowedSellerNewListings with userId', async () => {
    setupDbMocks([], [], 0);
    mockGetFollowedSellerNewListings.mockResolvedValue([]);
    const { getForYouFeed } = await import('../feed');
    await getForYouFeed('user-xyz');
    expect(mockGetFollowedSellerNewListings).toHaveBeenCalledWith('user-xyz', 20);
  });

  it('matchedListings returned from first db.with() call', async () => {
    const matched = makeListing('matched-1');
    setupDbMocks([matched], [], 2);
    mockGetFollowedSellerNewListings.mockResolvedValue([]);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.matchedListings).toHaveLength(1);
    expect(result.matchedListings[0]?.id).toBe('matched-1');
  });

  it('matchedListings excludes followed listing ids via notInArray', async () => {
    setupDbMocks([], [], 1);
    const { notInArray } = await import('drizzle-orm');
    const followedListing = makeListing('followed-1');
    mockGetFollowedSellerNewListings.mockResolvedValue([followedListing]);
    const { getForYouFeed } = await import('../feed');
    await getForYouFeed('user-1');
    expect(notInArray).toHaveBeenCalledWith(
      expect.anything(),
      ['followed-1'],
    );
  });

  it('watchlistDrops is always empty array (deferred G3.9)', async () => {
    setupDbMocks([], [], 0);
    mockGetFollowedSellerNewListings.mockResolvedValue([]);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.watchlistDrops).toEqual([]);
  });

  it('boostedListings returned from second db.with() call', async () => {
    const boosted = makeListing('boosted-1');
    setupDbMocks([], [boosted], 1);
    mockGetFollowedSellerNewListings.mockResolvedValue([]);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.boostedListings).toHaveLength(1);
    expect(result.boostedListings[0]?.id).toBe('boosted-1');
  });

  it('boostedListings empty when db returns no rows', async () => {
    setupDbMocks([], [], 0);
    mockGetFollowedSellerNewListings.mockResolvedValue([]);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    expect(result.boostedListings).toHaveLength(0);
  });

  it('boostedListings excludes ids from both followed and matched', async () => {
    const matchedListing = makeListing('matched-1');
    setupDbMocks([matchedListing], [], 1);
    const { notInArray } = await import('drizzle-orm');
    const followedListing = makeListing('followed-1');
    mockGetFollowedSellerNewListings.mockResolvedValue([followedListing]);
    const { getForYouFeed } = await import('../feed');
    await getForYouFeed('user-1');
    const calls = (notInArray as ReturnType<typeof vi.fn>).mock.calls;
    const lastCallIds = calls[calls.length - 1]?.[1] as string[];
    expect(lastCallIds).toContain('followed-1');
    expect(lastCallIds).toContain('matched-1');
  });

  it('db.$with is called twice (for matched and boosted CTEs)', async () => {
    setupDbMocks([], [], 0);
    mockGetFollowedSellerNewListings.mockResolvedValue([]);
    const { getForYouFeed } = await import('../feed');
    await getForYouFeed('user-1');
    expect(db$WithMock).toHaveBeenCalledTimes(2);
  });

  it('getFollowedSellerNewListings called with limit 20', async () => {
    setupDbMocks([], [], 0);
    mockGetFollowedSellerNewListings.mockResolvedValue([]);
    const { getForYouFeed } = await import('../feed');
    await getForYouFeed('user-1');
    expect(mockGetFollowedSellerNewListings).toHaveBeenCalledWith('user-1', 20);
  });

  it('notInArray NOT called when followedIds is empty (empty-excludeIds guard)', async () => {
    // When no followed sellers, excludeIds is [], so notInArray must NOT fire
    setupDbMocks([], [], 0);
    const { notInArray } = await import('drizzle-orm');
    mockGetFollowedSellerNewListings.mockResolvedValue([]);
    const { getForYouFeed } = await import('../feed');
    await getForYouFeed('user-1');
    expect(notInArray).not.toHaveBeenCalled();
  });

  // Business rule F: following does NOT add interest weight (Personalization §9)
  it('does not add interest weight for followed sellers — social feed is separate', async () => {
    // Verify that followedListings come from getFollowedSellerNewListings (social path)
    // and matchedListings come from db.with() (interest path) — separate queries, not merged.
    const followedListing = makeListing('social-1');
    const matchedListing = makeListing('interest-1');
    setupDbMocks([matchedListing], [], 2);
    mockGetFollowedSellerNewListings.mockResolvedValue([followedListing]);
    const { getForYouFeed } = await import('../feed');
    const result = await getForYouFeed('user-1');
    // social feed is separate from interest feed — distinct arrays
    expect(result.followedListings).toHaveLength(1);
    expect(result.matchedListings).toHaveLength(1);
    expect(result.followedListings[0]?.id).toBe('social-1');
    expect(result.matchedListings[0]?.id).toBe('interest-1');
    // followed listing must NOT appear in matchedListings (de-duped via notInArray)
    const matchedIds = result.matchedListings.map((l) => l.id);
    expect(matchedIds).not.toContain('social-1');
  });
});
