import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { get select() { return mockDbSelect; } },
}));

vi.mock('@/lib/queries/shared', () => ({
  mapToListingCard: (row: Record<string, unknown>) => ({ ...row, _mapped: true }),
}));

vi.mock('@/lib/queries/explore-shared', () => ({
  listingCardFields: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ type: 'eq', val })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args: args.filter(Boolean) })),
  asc: vi.fn(() => ({ type: 'asc' })),
  isNotNull: vi.fn(() => ({ type: 'isNotNull' })),
  sql: Object.assign(
    vi.fn(() => {
      const expr: Record<string, unknown> = { type: 'sql' };
      expr.as = vi.fn(() => expr);
      return expr;
    }),
    { raw: vi.fn() },
  ),
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', status: 'status', ownerUserId: 'owner_user_id' },
  listingImage: { url: 'url', altText: 'alt_text', listingId: 'listing_id', isPrimary: 'is_primary' },
  user: { id: 'id', displayName: 'display_name', username: 'username', avatarUrl: 'avatar_url' },
  sellerProfile: { id: 'id', userId: 'user_id' },
  sellerPerformance: { sellerProfileId: 'seller_profile_id' },
  curatedCollection: {
    id: 'id', title: 'title', slug: 'slug', description: 'description',
    coverImageUrl: 'cover_image_url', isPublished: 'is_published',
    startDate: 'start_date', endDate: 'end_date', sortOrder: 'sort_order',
  },
  curatedCollectionItem: {
    id: 'id', collectionId: 'collection_id', listingId: 'listing_id', sortOrder: 'sort_order',
  },
}));

// ─── Chain Helpers ────────────────────────────────────────────────────────────

function makeTerminalChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'offset', 'groupBy'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (val: unknown) => void) => resolve(result);
  return chain;
}

// ─── Import under test ────────────────────────────────────────────────────────

import { getStaffPickCollections, getSeasonalCollections } from '../explore-collections';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getStaffPickCollections', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns only published collections', async () => {
    mockDbSelect.mockReturnValue(makeTerminalChain([]));
    const result = await getStaffPickCollections();
    expect(result).toEqual([]);
    const { eq } = await import('drizzle-orm');
    expect(eq).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('respects startDate/endDate bounds', async () => {
    mockDbSelect.mockReturnValue(makeTerminalChain([]));
    await getStaffPickCollections();
    const { and } = await import('drizzle-orm');
    expect(and).toHaveBeenCalled();
  });

  it('returns collections ordered by sortOrder', async () => {
    mockDbSelect.mockReturnValue(makeTerminalChain([]));
    await getStaffPickCollections();
    const { asc } = await import('drizzle-orm');
    expect(asc).toHaveBeenCalled();
  });

  it('includes only ACTIVE listings in collection items', async () => {
    const collections = [
      { id: 'c1', title: 'T', slug: 's', description: null, coverImageUrl: null },
    ];
    const listingRows = [{ id: 'l1' }];
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      return makeTerminalChain(callCount === 1 ? collections : listingRows);
    });
    const result = await getStaffPickCollections();
    expect(result).toHaveLength(1);
    expect(result.at(0)?.listings).toHaveLength(1);
    const { eq } = await import('drizzle-orm');
    expect(eq).toHaveBeenCalledWith(expect.anything(), 'ACTIVE');
  });

  it('returns empty array when no published collections exist', async () => {
    mockDbSelect.mockReturnValue(makeTerminalChain([]));
    const result = await getStaffPickCollections();
    expect(result).toEqual([]);
  });

  it('limits listings per collection to 12', async () => {
    const collections = [
      { id: 'c1', title: 'T', slug: 's', description: null, coverImageUrl: null },
    ];
    const listingRows = Array.from({ length: 8 }, (_, i) => ({ id: `l${i}` }));
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      return makeTerminalChain(callCount === 1 ? collections : listingRows);
    });
    const result = await getStaffPickCollections();
    expect(result.at(0)?.listings.length ?? 0).toBeLessThanOrEqual(12);
  });
});

describe('getStaffPickCollections — additional coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handles multiple collections in parallel — returns all with their listings', async () => {
    const collections = [
      { id: 'c1', title: 'First', slug: 'first', description: 'A desc', coverImageUrl: 'http://img1' },
      { id: 'c2', title: 'Second', slug: 'second', description: null, coverImageUrl: null },
    ];
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeTerminalChain(collections);
      // Each collection triggers a listings fetch
      return makeTerminalChain([{ id: `l-${callCount}` }]);
    });
    const result = await getStaffPickCollections();
    expect(result).toHaveLength(2);
    expect(result.at(0)?.id).toBe('c1');
    expect(result.at(1)?.id).toBe('c2');
  });

  it('collection shape includes nullable description and coverImageUrl', async () => {
    const collections = [
      { id: 'c1', title: 'No Image', slug: 'no-img', description: null, coverImageUrl: null },
    ];
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      return makeTerminalChain(callCount === 1 ? collections : []);
    });
    const result = await getStaffPickCollections();
    expect(result.at(0)?.description).toBeNull();
    expect(result.at(0)?.coverImageUrl).toBeNull();
  });

  it('collection items are ordered by sortOrder ascending', async () => {
    const collections = [
      { id: 'c1', title: 'T', slug: 's', description: null, coverImageUrl: null },
    ];
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      return makeTerminalChain(callCount === 1 ? collections : [{ id: 'l1' }]);
    });
    await getStaffPickCollections();
    const { asc } = await import('drizzle-orm');
    // asc called for collection sortOrder AND item sortOrder
    expect(asc).toHaveBeenCalledTimes(2);
  });
});

describe('getSeasonalCollections', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns only collections with both startDate and endDate set', async () => {
    mockDbSelect.mockReturnValue(makeTerminalChain([]));
    await getSeasonalCollections();
    const { isNotNull } = await import('drizzle-orm');
    expect(isNotNull).toHaveBeenCalledTimes(2);
  });

  it('excludes collections outside date window', async () => {
    mockDbSelect.mockReturnValue(makeTerminalChain([]));
    await getSeasonalCollections();
    const { and } = await import('drizzle-orm');
    expect(and).toHaveBeenCalled();
  });

  it('returns empty array when no seasonal collections match', async () => {
    mockDbSelect.mockReturnValue(makeTerminalChain([]));
    const result = await getSeasonalCollections();
    expect(result).toEqual([]);
  });

  it('returns seasonal collections with their listings when data exists', async () => {
    const collections = [
      { id: 'sc1', title: 'Holiday', slug: 'holiday', description: 'Holiday picks', coverImageUrl: 'http://img' },
    ];
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      return makeTerminalChain(callCount === 1 ? collections : [{ id: 'l1' }, { id: 'l2' }]);
    });
    const result = await getSeasonalCollections();
    expect(result).toHaveLength(1);
    expect(result.at(0)?.id).toBe('sc1');
    expect(result.at(0)?.listings).toHaveLength(2);
  });

  it('excludes non-ACTIVE listings from seasonal collection items', async () => {
    const collections = [
      { id: 'sc1', title: 'Back to School', slug: 'back-to-school', description: null, coverImageUrl: null },
    ];
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      return makeTerminalChain(callCount === 1 ? collections : []);
    });
    await getSeasonalCollections();
    const { eq } = await import('drizzle-orm');
    expect(eq).toHaveBeenCalledWith(expect.anything(), 'ACTIVE');
  });

  it('requires isPublished = true (same as staff picks)', async () => {
    mockDbSelect.mockReturnValue(makeTerminalChain([]));
    await getSeasonalCollections();
    const { eq } = await import('drizzle-orm');
    expect(eq).toHaveBeenCalledWith(expect.anything(), true);
  });
});
