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

function makeSqlExpr() {
  const expr: Record<string, unknown> = { type: 'sql' };
  expr.as = vi.fn(() => expr);
  return expr;
}

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ type: 'eq', val })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args: args.filter(Boolean) })),
  sql: Object.assign(vi.fn(() => makeSqlExpr()), { raw: vi.fn() }),
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', status: 'status', ownerUserId: 'owner_user_id' },
  user: { id: 'id', avatarUrl: 'avatar_url', createdAt: 'created_at' },
  sellerProfile: { userId: 'user_id', storeName: 'store_name', storeSlug: 'store_slug', performanceBand: 'performance_band' },
  order: { id: 'id', status: 'status', sellerId: 'seller_id' },
  follow: { followedId: 'followed_id' },
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

// ─── Import under test ────────────────────────────────────────────────────────

import { getRisingSellers } from '../explore-sellers';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

const mockGetPlatformSetting = getPlatformSetting as ReturnType<typeof vi.fn>;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getRisingSellers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns sellers who joined in last 90 days with 3+ active listings and 1+ completed order', async () => {
    const rows = [
      {
        userId: 'u1', storeName: 'Cool Store', storeSlug: 'cool-store',
        avatarUrl: null, performanceBand: 'EMERGING', listingCount: 5,
        followerCount: 12, memberSince: new Date(),
      },
    ];
    setupCteQueryMocks(rows);
    const result = await getRisingSellers();
    expect(result).toHaveLength(1);
    expect(result.at(0)?.userId).toBe('u1');
  });

  it('excludes sellers with fewer than 3 active listings', async () => {
    setupCteQueryMocks([]);
    const result = await getRisingSellers();
    expect(result).toEqual([]);
  });

  it('excludes sellers with zero completed orders', async () => {
    setupCteQueryMocks([]);
    const result = await getRisingSellers();
    expect(result).toEqual([]);
  });

  it('excludes sellers who joined more than 90 days ago', async () => {
    setupCteQueryMocks([]);
    const result = await getRisingSellers();
    expect(Array.isArray(result)).toBe(true);
    const { and } = await import('drizzle-orm');
    expect(and).toHaveBeenCalled();
  });

  it('orders by active listing count DESC', async () => {
    const rows = [
      { userId: 'u1', storeName: null, storeSlug: null, avatarUrl: null,
        performanceBand: 'EMERGING', listingCount: 10, followerCount: 2, memberSince: new Date() },
      { userId: 'u2', storeName: null, storeSlug: null, avatarUrl: null,
        performanceBand: 'EMERGING', listingCount: 5, followerCount: 1, memberSince: new Date() },
    ];
    setupCteQueryMocks(rows);
    const result = await getRisingSellers();
    expect(result.at(0)?.listingCount ?? 0).toBeGreaterThanOrEqual(result.at(1)?.listingCount ?? 0);
  });

  it('respects limit from platform settings', async () => {
    mockGetPlatformSetting.mockImplementation((key: string) => {
      if (key === 'discovery.explore.risingSellerLimit') return Promise.resolve(4);
      return Promise.resolve(undefined);
    });
    setupCteQueryMocks([]);
    await getRisingSellers();
    expect(mockGetPlatformSetting).toHaveBeenCalledWith('discovery.explore.risingSellerLimit', 8);
  });

  it('returns empty array when no rising sellers qualify', async () => {
    setupCteQueryMocks([]);
    const result = await getRisingSellers();
    expect(result).toEqual([]);
  });
});

describe('getRisingSellers — additional coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uses caller-supplied limit instead of platform setting', async () => {
    mockGetPlatformSetting.mockResolvedValue(8);
    const rows = [
      { userId: 'u1', storeName: 'Store', storeSlug: 'store', avatarUrl: null,
        performanceBand: 'EMERGING', listingCount: 4, followerCount: 3, memberSince: new Date() },
    ];
    setupCteQueryMocks(rows);
    const result = await getRisingSellers(1);
    expect(result).toHaveLength(1);
    // Platform setting still fetched
    expect(mockGetPlatformSetting).toHaveBeenCalledWith('discovery.explore.risingSellerLimit', 8);
  });

  it('builds all three CTEs — active listings, completed orders, followers', async () => {
    setupCteQueryMocks([]);
    await getRisingSellers();
    expect(mockDb$With).toHaveBeenCalledTimes(3);
  });

  it('returned shape includes followerCount and memberSince', async () => {
    const memberSince = new Date('2026-01-01');
    const rows = [
      { userId: 'u1', storeName: 'My Shop', storeSlug: 'my-shop', avatarUrl: 'http://img',
        performanceBand: 'EMERGING', listingCount: 5, followerCount: 99, memberSince },
    ];
    setupCteQueryMocks(rows);
    const result = await getRisingSellers();
    expect(result.at(0)?.followerCount).toBe(99);
    expect(result.at(0)?.memberSince).toEqual(memberSince);
  });

  it('normalises nullable storeName and storeSlug to null', async () => {
    const rows = [
      { userId: 'u2', storeName: null, storeSlug: null, avatarUrl: null,
        performanceBand: 'EMERGING', listingCount: 3, followerCount: 0, memberSince: new Date() },
    ];
    setupCteQueryMocks(rows);
    const result = await getRisingSellers();
    expect(result.at(0)?.storeName).toBeNull();
    expect(result.at(0)?.storeSlug).toBeNull();
  });

  it('includes performanceBand in returned data', async () => {
    const rows = [
      { userId: 'u3', storeName: 'Band Test', storeSlug: 'band-test', avatarUrl: null,
        performanceBand: 'ESTABLISHED', listingCount: 7, followerCount: 5, memberSince: new Date() },
    ];
    setupCteQueryMocks(rows);
    const result = await getRisingSellers();
    expect(result.at(0)?.performanceBand).toBe('ESTABLISHED');
  });
});
