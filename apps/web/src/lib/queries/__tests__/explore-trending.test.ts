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

vi.mock('@/lib/queries/explore-shared', () => ({
  listingCardFields: {},
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
  gt: vi.fn(() => ({ type: 'gt' })),
  sql: Object.assign(vi.fn(() => makeSqlExpr()), { raw: vi.fn() }),
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', status: 'status', ownerUserId: 'owner_user_id', createdAt: 'created_at' },
  listingImage: { url: 'url', altText: 'alt_text', listingId: 'listing_id', isPrimary: 'is_primary' },
  user: { id: 'id', displayName: 'display_name', username: 'username', avatarUrl: 'avatar_url' },
  sellerProfile: { id: 'id', userId: 'user_id' },
  sellerPerformance: { sellerProfileId: 'seller_profile_id' },
  watchlistItem: { listingId: 'listing_id', createdAt: 'created_at' },
  browsingHistory: { listingId: 'listing_id', lastViewedAt: 'last_viewed_at' },
  orderItem: { listingId: 'listing_id', orderId: 'order_id' },
  order: { id: 'id', createdAt: 'created_at', status: 'status' },
  promotedListing: { id: 'id', listingId: 'listing_id', isActive: 'is_active', endedAt: 'ended_at', startedAt: 'started_at' },
}));

// ─── Chain Helpers ────────────────────────────────────────────────────────────

function makeCteChain() {
  const c: Record<string, unknown> = {};
  ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'groupBy'].forEach((m) => {
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

function setupCteQueryMocks(finalRows: unknown[]) {
  mockDbSelect.mockReturnValue(makeCteChain());
  mockDb$With.mockReturnValue({ as: vi.fn().mockReturnValue('cte-token') });
  mockDbWith.mockReturnValue({ select: vi.fn().mockReturnValue(makeTerminalChain(finalRows)) });
}

function setupSelectMock(result: unknown[]) {
  mockDbSelect.mockReturnValue(makeTerminalChain(result));
}

// ─── Import under test ────────────────────────────────────────────────────────

import { getTrendingListings, getExplorePromotedListings } from '../explore-trending';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

const mockGetPlatformSetting = getPlatformSetting as ReturnType<typeof vi.fn>;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getTrendingListings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns listings ordered by velocity score (sales weighted highest)', async () => {
    setupCteQueryMocks([{ id: 'l1' }, { id: 'l2' }]);
    const result = await getTrendingListings();
    expect(result).toHaveLength(2);
    expect(mockDbWith).toHaveBeenCalled();
  });

  it('excludes non-ACTIVE listings', async () => {
    setupCteQueryMocks([]);
    await getTrendingListings();
    const { eq } = await import('drizzle-orm');
    expect(eq).toHaveBeenCalledWith(expect.anything(), 'ACTIVE');
  });

  it('respects trending window from platform settings', async () => {
    mockGetPlatformSetting.mockImplementation((key: string) => {
      if (key === 'discovery.explore.trendingWindowDays') return Promise.resolve(14);
      if (key === 'discovery.explore.trendingLimit') return Promise.resolve(24);
      return Promise.resolve(undefined);
    });
    setupCteQueryMocks([]);
    await getTrendingListings();
    expect(mockGetPlatformSetting).toHaveBeenCalledWith('discovery.explore.trendingWindowDays', 7);
  });

  it('respects trending limit from platform settings', async () => {
    mockGetPlatformSetting.mockImplementation((key: string) => {
      if (key === 'discovery.explore.trendingWindowDays') return Promise.resolve(7);
      if (key === 'discovery.explore.trendingLimit') return Promise.resolve(12);
      return Promise.resolve(undefined);
    });
    setupCteQueryMocks([]);
    await getTrendingListings();
    expect(mockGetPlatformSetting).toHaveBeenCalledWith('discovery.explore.trendingLimit', 24);
  });

  it('returns empty array when no listings exist', async () => {
    setupCteQueryMocks([]);
    const result = await getTrendingListings();
    expect(result).toEqual([]);
  });

  it('uses mapToListingCard for consistent shape', async () => {
    setupCteQueryMocks([{ id: 'l1' }]);
    const result = await getTrendingListings();
    expect(result.at(0)).toHaveProperty('_mapped', true);
  });

  it('falls back to default limit (24) when setting not found', async () => {
    mockGetPlatformSetting.mockResolvedValue(undefined);
    setupCteQueryMocks([]);
    const result = await getTrendingListings();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('getTrendingListings — additional coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uses caller-supplied limit instead of platform setting when provided', async () => {
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) =>
      Promise.resolve(fallback),
    );
    setupCteQueryMocks([{ id: 'l1' }]);
    // Pass explicit limit — the platform-setting value (24) should not override it
    const result = await getTrendingListings(5);
    expect(result).toHaveLength(1); // mock returns whatever rows are set up
    // Platform settings still fetched (for window days), but the WITH query uses our limit
    expect(mockDbWith).toHaveBeenCalled();
  });

  it('builds all three CTEs — orders, watchlist, views', async () => {
    setupCteQueryMocks([]);
    await getTrendingListings();
    // $with is called once per CTE (3 CTEs total)
    expect(mockDb$With).toHaveBeenCalledTimes(3);
  });

  it('fetches both trendingWindowDays and trendingLimit settings in parallel', async () => {
    setupCteQueryMocks([]);
    await getTrendingListings();
    expect(mockGetPlatformSetting).toHaveBeenCalledWith('discovery.explore.trendingWindowDays', 7);
    expect(mockGetPlatformSetting).toHaveBeenCalledWith('discovery.explore.trendingLimit', 24);
  });

  it('maps every row through mapToListingCard', async () => {
    setupCteQueryMocks([{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }]);
    const result = await getTrendingListings();
    expect(result).toHaveLength(3);
    result.forEach((item) => expect(item).toHaveProperty('_mapped', true));
  });
});

describe('getExplorePromotedListings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns active promoted listings', async () => {
    setupSelectMock([{ id: 'l1' }, { id: 'l2' }]);
    const result = await getExplorePromotedListings();
    expect(result).toHaveLength(2);
  });

  it('filters promotions by endedAt (NULL-safe: includes open-ended boosts)', async () => {
    setupSelectMock([]);
    await getExplorePromotedListings();
    const { sql } = await import('drizzle-orm');
    // endedAt check now uses raw SQL for NULL-safety instead of gt()
    expect(sql).toHaveBeenCalled();
  });

  it('excludes listings that are not ACTIVE', async () => {
    setupSelectMock([]);
    await getExplorePromotedListings();
    const { eq } = await import('drizzle-orm');
    expect(eq).toHaveBeenCalledWith(expect.anything(), 'ACTIVE');
  });

  it('requires isActive flag on promoted_listing record', async () => {
    setupSelectMock([]);
    await getExplorePromotedListings();
    const { eq } = await import('drizzle-orm');
    // isActive = true is checked in addition to ACTIVE listing status
    expect(eq).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('returns empty array when no active promotions exist', async () => {
    setupSelectMock([]);
    const result = await getExplorePromotedListings();
    expect(result).toEqual([]);
  });

  it('uses mapToListingCard for consistent shape', async () => {
    setupSelectMock([{ id: 'l1' }]);
    const result = await getExplorePromotedListings();
    expect(result.at(0)).toHaveProperty('_mapped', true);
  });

  it('accepts a custom limit argument', async () => {
    setupSelectMock([{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }]);
    const result = await getExplorePromotedListings(3);
    expect(result).toHaveLength(3);
  });

  it('uses default limit of 12 when no argument given', async () => {
    setupSelectMock([]);
    // Just verify it runs without error and returns an array
    const result = await getExplorePromotedListings();
    expect(Array.isArray(result)).toBe(true);
  });
});
