import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));
vi.mock('@twicely/db/schema', () => ({
  listing: {
    id: 'id', title: 'title', slug: 'slug', status: 'status',
    priceCents: 'price_cents', originalPriceCents: 'original_price_cents',
    createdAt: 'created_at', ownerUserId: 'owner_user_id', categoryId: 'category_id',
  },
  listingImage: { listingId: 'listing_id', url: 'url', isPrimary: 'is_primary' },
  watchlistItem: { listingId: 'listing_id' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  count: vi.fn(() => ({ type: 'count' })),
  ilike: vi.fn((col, pat) => ({ type: 'ilike', col, pat })),
  sql: Object.assign(
    (tpl: TemplateStringsArray) => ({ sql: tpl[0], as: (a: string) => ({ sql: tpl[0], alias: a }) }),
    { as: vi.fn(), join: vi.fn() }
  ),
}));

import {
  getSellerListings,
  getSellerListingCounts,
  getListingsByIdsForOwner,
} from '../seller-listings';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);
const USER_ID = 'user-test-001';

const baseRow = {
  id: 'l-1', title: 'Nike Air Jordan', slug: 'nike-air-jordan',
  status: 'ACTIVE', priceCents: 9999, originalPriceCents: 12000,
  createdAt: new Date('2025-01-01'), primaryImageUrl: null, watcherCount: 0,
};

function makeSelectChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['leftJoin'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['groupBy'] = vi.fn().mockReturnValue(chain);
  chain['orderBy'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockReturnValue(chain);
  chain['offset'] = vi.fn().mockResolvedValue(data);
  // thenable for queries that end at .where() or .groupBy()
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve);
  return chain;
}

// Subquery chain: db.select().from().where() used as embedded SQL subquery (not awaited)
function makeSubqueryChain() {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('getSellerListings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated listings for a seller', async () => {
    // db.select is called 3 times: (1) count query, (2) watcherCountSq subquery, (3) listing rows
    const countChain = makeSelectChain([{ count: 1 }]);
    const subqueryChain = makeSubqueryChain();
    const rowChain = makeSelectChain([baseRow]);
    mockSelect
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(subqueryChain as never)
      .mockReturnValueOnce(rowChain as never);

    const result = await getSellerListings(USER_ID);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]!.id).toBe('l-1');
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it('returns correct pagination metadata', async () => {
    const countChain = makeSelectChain([{ count: 50 }]);
    const subqueryChain = makeSubqueryChain();
    const rowChain = makeSelectChain(Array(25).fill(baseRow));
    mockSelect
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(subqueryChain as never)
      .mockReturnValueOnce(rowChain as never);

    const result = await getSellerListings(USER_ID, { page: 1 });
    expect(result.totalPages).toBe(2);
    expect(result.total).toBe(50);
  });

  it('filters by status when provided', async () => {
    const countChain = makeSelectChain([{ count: 1 }]);
    const subqueryChain = makeSubqueryChain();
    const rowChain = makeSelectChain([{ ...baseRow, status: 'DRAFT' }]);
    mockSelect
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(subqueryChain as never)
      .mockReturnValueOnce(rowChain as never);

    const result = await getSellerListings(USER_ID, { status: 'DRAFT' });
    expect(result.listings[0]!.status).toBe('DRAFT');
  });

  it('returns empty listings when seller has none', async () => {
    const countChain = makeSelectChain([{ count: 0 }]);
    const subqueryChain = makeSubqueryChain();
    const rowChain = makeSelectChain([]);
    mockSelect
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(subqueryChain as never)
      .mockReturnValueOnce(rowChain as never);

    const result = await getSellerListings(USER_ID);
    expect(result.listings).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('normalizes watcherCount to number', async () => {
    const countChain = makeSelectChain([{ count: 1 }]);
    const subqueryChain = makeSubqueryChain();
    const rowChain = makeSelectChain([{ ...baseRow, watcherCount: '5' }]);
    mockSelect
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(subqueryChain as never)
      .mockReturnValueOnce(rowChain as never);

    const result = await getSellerListings(USER_ID);
    expect(result.listings[0]!.watcherCount).toBe(5);
    expect(typeof result.listings[0]!.watcherCount).toBe('number');
  });
});

describe('getSellerListingCounts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns status counts grouped by status', async () => {
    const rows = [
      { status: 'ACTIVE', count: 10 },
      { status: 'DRAFT', count: 5 },
      { status: 'SOLD', count: 3 },
    ];
    mockSelect.mockReturnValue(makeSelectChain(rows) as never);

    const result = await getSellerListingCounts(USER_ID);
    expect(result.ACTIVE).toBe(10);
    expect(result.DRAFT).toBe(5);
    expect(result.SOLD).toBe(3);
    expect(result.PAUSED).toBe(0);
    expect(result.ENDED).toBe(0);
  });

  it('calculates all count as sum of all statuses', async () => {
    const rows = [
      { status: 'ACTIVE', count: 10 },
      { status: 'SOLD', count: 20 },
    ];
    mockSelect.mockReturnValue(makeSelectChain(rows) as never);

    const result = await getSellerListingCounts(USER_ID);
    expect(result.all).toBe(30);
  });

  it('returns all zeros when seller has no listings', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]) as never);

    const result = await getSellerListingCounts(USER_ID);
    expect(result.all).toBe(0);
    expect(result.ACTIVE).toBe(0);
    expect(result.DRAFT).toBe(0);
    expect(result.PAUSED).toBe(0);
    expect(result.SOLD).toBe(0);
    expect(result.ENDED).toBe(0);
  });
});

describe('getListingsByIdsForOwner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array immediately for empty input', async () => {
    const result = await getListingsByIdsForOwner([], USER_ID);
    expect(result).toHaveLength(0);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('returns only listings owned by the given user', async () => {
    mockSelect.mockReturnValue(makeSelectChain([
      { id: 'l-1', status: 'ACTIVE' },
      { id: 'l-2', status: 'PAUSED' },
    ]) as never);

    const result = await getListingsByIdsForOwner(['l-1', 'l-2'], USER_ID);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('l-1');
    expect(result[1]!.status).toBe('PAUSED');
  });

  it('returns empty when no listings match the given IDs for the user', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]) as never);

    const result = await getListingsByIdsForOwner(['other-listing-id'], USER_ID);
    expect(result).toHaveLength(0);
  });

  it('maps status field correctly on returned rows', async () => {
    mockSelect.mockReturnValue(makeSelectChain([
      { id: 'l-sold', status: 'SOLD' },
    ]) as never);

    const result = await getListingsByIdsForOwner(['l-sold'], USER_ID);
    expect(result[0]!.status).toBe('SOLD');
  });
});
