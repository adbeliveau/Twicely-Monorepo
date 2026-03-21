/**
 * Supplemental query tests for admin-curated-collections.
 * Covers edge cases not in the primary query test file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  asc: vi.fn((col) => ({ type: 'asc', col })),
  sql: vi.fn((_strings: TemplateStringsArray, ..._vals: unknown[]) => ({
    sql: 'mocked', vals: [],
    as: vi.fn().mockReturnValue({ collectionId: 'collection_id', itemCount: 0 }),
  })),
  isNotNull: vi.fn((col) => ({ type: 'isNotNull', col })),
  notInArray: vi.fn((col, vals) => ({ type: 'notInArray', col, vals })),
  ilike: vi.fn((col, pat) => ({ type: 'ilike', col, pat })),
}));

vi.mock('@twicely/db/schema', () => ({
  curatedCollection: {
    id: 'id', title: 'title', slug: 'slug', description: 'description',
    coverImageUrl: 'cover_image_url', isPublished: 'is_published',
    startDate: 'start_date', endDate: 'end_date', sortOrder: 'sort_order',
    curatedBy: 'curated_by', createdAt: 'created_at', updatedAt: 'updated_at',
  },
  curatedCollectionItem: {
    id: 'id', collectionId: 'collection_id', listingId: 'listing_id',
    sortOrder: 'sort_order', addedBy: 'added_by', createdAt: 'created_at',
  },
  listing: {
    id: 'id', title: 'title', slug: 'slug', priceCents: 'price_cents',
    status: 'status', ownerUserId: 'owner_user_id',
  },
  listingImage: { id: 'id', listingId: 'listing_id', url: 'url', isPrimary: 'is_primary' },
  user: { id: 'id', displayName: 'display_name', name: 'name' },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const subqueryAlias = { collectionId: 'collection_id', itemCount: 0 };
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
    as: vi.fn().mockReturnValue(subqueryAlias),
  };
  ['from', 'where', 'innerJoin', 'leftJoin', 'orderBy', 'limit', 'offset', 'groupBy'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

// ─── getAdminCollections — pagination and 'all' filter ───────────────────────

describe('getAdminCollections — pagination and all filter', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('handles page 2 offset correctly (does not throw)', async () => {
    mockDbSelect
      .mockReturnValueOnce({ ...makeSelectChain([]), as: vi.fn().mockReturnValue({}) })
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ count: 25 }]));

    const { getAdminCollections } = await import('../admin-curated-collections');
    const result = await getAdminCollections(2, 10);
    expect(result.total).toBe(25);
    expect(result.collections).toHaveLength(0);
  });

  it('returns total from count query when filter is all (undefined)', async () => {
    const row = {
      id: 'col-1', title: 'Test', slug: 'test', description: null,
      coverImageUrl: null, isPublished: false, startDate: null, endDate: null,
      sortOrder: 0, itemCount: 0, curatedByName: null, createdAt: new Date(), updatedAt: new Date(),
    };
    mockDbSelect
      .mockReturnValueOnce({ ...makeSelectChain([]), as: vi.fn().mockReturnValue({}) })
      .mockReturnValueOnce(makeSelectChain([row]))
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]));

    const { getAdminCollections } = await import('../admin-curated-collections');
    const result = await getAdminCollections(1, 50, 'all');
    expect(result.collections).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('defaults total to 0 when count query returns empty array', async () => {
    mockDbSelect
      .mockReturnValueOnce({ ...makeSelectChain([]), as: vi.fn().mockReturnValue({}) })
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { getAdminCollections } = await import('../admin-curated-collections');
    const result = await getAdminCollections(1, 50);
    expect(result.total).toBe(0);
  });
});

// ─── getAdminCollectionById — items shape ─────────────────────────────────────

describe('getAdminCollectionById — items shape verification', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns empty items array for collection with no items', async () => {
    const collectionRow = {
      id: 'col-empty', title: 'Empty Collection', slug: 'empty-collection',
      description: null, coverImageUrl: null, isPublished: false,
      startDate: null, endDate: null, sortOrder: 0,
      curatedBy: 'staff-001', createdAt: new Date(), updatedAt: new Date(),
    };
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([collectionRow]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { getAdminCollectionById } = await import('../admin-curated-collections');
    const result = await getAdminCollectionById('col-empty');

    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(0);
    expect(Array.isArray(result!.items)).toBe(true);
  });

  it('returns multiple items for collection with many listings', async () => {
    const collectionRow = {
      id: 'col-full', title: 'Full Collection', slug: 'full-collection',
      description: 'Test', coverImageUrl: null, isPublished: true,
      startDate: null, endDate: null, sortOrder: 0,
      curatedBy: 'staff-001', createdAt: new Date(), updatedAt: new Date(),
    };
    const itemRows = [
      { id: 'cci-1', listingId: 'lst-1', listingTitle: 'Item One', listingSlug: 'item-one',
        listingPriceCents: 1000, listingStatus: 'ACTIVE', primaryImageUrl: null,
        sortOrder: 0, addedByName: 'Staff', createdAt: new Date() },
      { id: 'cci-2', listingId: 'lst-2', listingTitle: 'Item Two', listingSlug: 'item-two',
        listingPriceCents: 2000, listingStatus: 'ACTIVE', primaryImageUrl: 'https://cdn.twicely.com/img.jpg',
        sortOrder: 1, addedByName: 'Staff', createdAt: new Date() },
    ];
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([collectionRow]))
      .mockReturnValueOnce(makeSelectChain(itemRows));

    const { getAdminCollectionById } = await import('../admin-curated-collections');
    const result = await getAdminCollectionById('col-full');

    expect(result!.items).toHaveLength(2);
    expect(result!.items[0]!.sortOrder).toBe(0);
    expect(result!.items[1]!.sortOrder).toBe(1);
  });
});

// ─── searchListingsForCollection — ACTIVE filter and exclusion ────────────────

describe('searchListingsForCollection — ACTIVE filter and exclusion', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('builds ACTIVE status filter condition', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { searchListingsForCollection } = await import('../admin-curated-collections');
    const { eq } = await import('drizzle-orm');

    await searchListingsForCollection('test', []);

    expect(eq).toHaveBeenCalledWith(expect.anything(), 'ACTIVE');
  });

  it('applies notInArray when excludeListingIds is non-empty', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { searchListingsForCollection } = await import('../admin-curated-collections');
    const { notInArray } = await import('drizzle-orm');

    await searchListingsForCollection('nike', ['lst-1', 'lst-2', 'lst-3']);

    expect(notInArray).toHaveBeenCalledWith(expect.anything(), ['lst-1', 'lst-2', 'lst-3']);
  });

  it('skips notInArray when excludeListingIds is empty', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { searchListingsForCollection } = await import('../admin-curated-collections');
    const { notInArray } = await import('drizzle-orm');

    await searchListingsForCollection('nike', []);

    expect(notInArray).not.toHaveBeenCalled();
  });

  it('returns empty array when no ACTIVE listings match', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { searchListingsForCollection } = await import('../admin-curated-collections');
    const result = await searchListingsForCollection('nonexistent query xyz', []);

    expect(result).toHaveLength(0);
  });

  it('uses ilike for case-insensitive title search', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { searchListingsForCollection } = await import('../admin-curated-collections');
    const { ilike } = await import('drizzle-orm');

    await searchListingsForCollection('Nike Air Max', []);

    expect(ilike).toHaveBeenCalledWith(expect.anything(), '%Nike Air Max%');
  });
});
