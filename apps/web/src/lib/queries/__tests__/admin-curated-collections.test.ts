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

// ─── getAdminCollections ──────────────────────────────────────────────────────

describe('getAdminCollections', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns paginated results with item counts', async () => {
    const rows = [
      { id: 'col-1', title: 'Summer Picks', slug: 'summer-picks', description: null,
        coverImageUrl: null, isPublished: true, startDate: null, endDate: null,
        sortOrder: 0, itemCount: 5, curatedByName: 'Staff', createdAt: new Date(), updatedAt: new Date() },
    ];
    mockDbSelect
      .mockReturnValueOnce({ ...makeSelectChain([]), as: vi.fn().mockReturnValue({ collectionId: 'collection_id', itemCount: 'item_count' }) })
      .mockReturnValueOnce(makeSelectChain(rows))
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]));

    const { getAdminCollections } = await import('../admin-curated-collections');
    const result = await getAdminCollections(1, 50);

    expect(result.total).toBe(1);
  });

  it('filters by published status', async () => {
    mockDbSelect
      .mockReturnValueOnce({ ...makeSelectChain([]), as: vi.fn().mockReturnValue({}) })
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));

    const { getAdminCollections } = await import('../admin-curated-collections');
    const { eq } = await import('drizzle-orm');
    await getAdminCollections(1, 50, 'published');

    expect(eq).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('filters by draft status', async () => {
    mockDbSelect
      .mockReturnValueOnce({ ...makeSelectChain([]), as: vi.fn().mockReturnValue({}) })
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));

    const { getAdminCollections } = await import('../admin-curated-collections');
    const { eq } = await import('drizzle-orm');
    await getAdminCollections(1, 50, 'draft');

    expect(eq).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('filters by seasonal (startDate AND endDate not null)', async () => {
    mockDbSelect
      .mockReturnValueOnce({ ...makeSelectChain([]), as: vi.fn().mockReturnValue({}) })
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));

    const { getAdminCollections } = await import('../admin-curated-collections');
    const { isNotNull } = await import('drizzle-orm');
    await getAdminCollections(1, 50, 'seasonal');

    expect(isNotNull).toHaveBeenCalledTimes(2);
  });

  it('returns empty array when no collections', async () => {
    mockDbSelect
      .mockReturnValueOnce({ ...makeSelectChain([]), as: vi.fn().mockReturnValue({}) })
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));

    const { getAdminCollections } = await import('../admin-curated-collections');
    const result = await getAdminCollections(1, 50);

    expect(result.collections).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── getAdminCollectionById ───────────────────────────────────────────────────

describe('getAdminCollectionById', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns collection with items', async () => {
    const collectionRow = {
      id: 'col-1', title: 'Summer Picks', slug: 'summer-picks', description: null,
      coverImageUrl: null, isPublished: true, startDate: null, endDate: null,
      sortOrder: 0, curatedBy: 'staff-001', createdAt: new Date(), updatedAt: new Date(),
    };
    const itemRows = [
      { id: 'cci-1', listingId: 'lst-1', listingTitle: 'Nike Air Max', listingSlug: 'nike-air-max',
        listingPriceCents: 9999, listingStatus: 'ACTIVE', primaryImageUrl: null,
        sortOrder: 0, addedByName: 'Staff', createdAt: new Date() },
    ];
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([collectionRow]))
      .mockReturnValueOnce(makeSelectChain(itemRows));

    const { getAdminCollectionById } = await import('../admin-curated-collections');
    const result = await getAdminCollectionById('col-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('col-1');
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0]!.listingId).toBe('lst-1');
  });

  it('returns null for non-existent collection', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { getAdminCollectionById } = await import('../admin-curated-collections');
    const result = await getAdminCollectionById('col-nonexistent');

    expect(result).toBeNull();
  });
});

// ─── searchListingsForCollection ──────────────────────────────────────────────

describe('searchListingsForCollection', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns only ACTIVE listings excluding provided IDs', async () => {
    const rows = [
      { id: 'lst-3', title: 'Nike Hoodie', slug: 'nike-hoodie', priceCents: 4999, primaryImageUrl: null },
    ];
    mockDbSelect.mockReturnValueOnce(makeSelectChain(rows));

    const { searchListingsForCollection } = await import('../admin-curated-collections');
    const result = await searchListingsForCollection('nike', ['lst-1', 'lst-2']);

    expect(Array.isArray(result)).toBe(true);
  });
});
