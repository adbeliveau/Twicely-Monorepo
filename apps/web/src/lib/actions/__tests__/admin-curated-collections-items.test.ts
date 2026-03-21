import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── CUID2 test constants ──────────────────────────────────────────────────────

const COLL_ID = 'cm1collection0000000000a';
const LIST_ID1 = 'cm1listingid0000000000a1';
const LIST_ID2 = 'cm1listingid0000000000a2';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate, delete: mockDbDelete },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args) => ({ type: 'and', args })),
}));

vi.mock('@twicely/db/schema', () => ({
  curatedCollection: { id: 'id', slug: 'slug', curatedBy: 'curated_by' },
  curatedCollectionItem: { id: 'id', collectionId: 'collection_id', listingId: 'listing_id' },
  listing: { id: 'id', status: 'status' },
  auditEvent: { id: 'id', action: 'action' },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/utils/format', () => ({
  slugify: vi.fn((text: string) => text.toLowerCase().replace(/\s+/g, '-')),
}));
vi.mock('@/lib/queries/admin-curated-collections', () => ({
  searchListingsForCollection: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where', 'innerJoin', 'leftJoin', 'orderBy', 'limit', 'offset', 'groupBy'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}
function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}
function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}
function makeDeleteChain() {
  return { where: vi.fn().mockResolvedValue(undefined) };
}
function mockCanManage() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'manage' && s === 'CuratedCollection') };
  const session = { staffUserId: 'staff-001', email: 's@hub.co', displayName: 'Staff', isPlatformStaff: true as const, platformRoles: ['MODERATION'] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}
function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = { staffUserId: 'staff-002', email: 'f@hub.co', displayName: 'F', isPlatformStaff: true as const, platformRoles: [] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

// ─── addCollectionItemAction ──────────────────────────────────────────────────

describe('addCollectionItemAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { addCollectionItemAction } = await import('../admin-curated-collections');
    expect(await addCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID1 })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing fields', async () => {
    mockCanManage();
    const { addCollectionItemAction } = await import('../admin-curated-collections');
    expect(await addCollectionItemAction({ collectionId: COLL_ID })).toEqual({ error: 'Invalid input' });
  });

  it('inserts item with addedBy from session (never from input)', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: LIST_ID1, status: 'ACTIVE' }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { addCollectionItemAction } = await import('../admin-curated-collections');
    await addCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID1 });

    const insertValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(insertValues.addedBy).toBe('staff-001');
    expect(insertValues.collectionId).toBe(COLL_ID);
    expect(insertValues.listingId).toBe(LIST_ID1);
  });

  it('creates LOW audit event with action ADD_COLLECTION_ITEM', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: LIST_ID1, status: 'ACTIVE' }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { addCollectionItemAction } = await import('../admin-curated-collections');
    await addCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID1 });

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[1]![0];
    expect(auditValues.action).toBe('ADD_COLLECTION_ITEM');
    expect(auditValues.severity).toBe('LOW');
  });

  it('revalidates collection detail path', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: LIST_ID1, status: 'ACTIVE' }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { revalidatePath } = await import('next/cache');

    const { addCollectionItemAction } = await import('../admin-curated-collections');
    await addCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID1 });
    expect(revalidatePath).toHaveBeenCalledWith('/mod/collections/' + COLL_ID);
  });

  it('rejects duplicate listing in same collection', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: LIST_ID1, status: 'ACTIVE' }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'cci-1' }]));

    const { addCollectionItemAction } = await import('../admin-curated-collections');
    expect(await addCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID1 })).toEqual({
      error: 'Listing already in collection',
    });
  });

  it('rejects non-ACTIVE listing', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: LIST_ID1, status: 'PAUSED' }]));

    const { addCollectionItemAction } = await import('../admin-curated-collections');
    expect(await addCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID1 })).toEqual({
      error: 'Listing is not active',
    });
  });
});

// ─── removeCollectionItemAction ───────────────────────────────────────────────

describe('removeCollectionItemAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { removeCollectionItemAction } = await import('../admin-curated-collections');
    expect(await removeCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID1 })).toEqual({ error: 'Forbidden' });
  });

  it('deletes item from database', async () => {
    mockCanManage();
    mockDbDelete.mockReturnValue(makeDeleteChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { removeCollectionItemAction } = await import('../admin-curated-collections');
    const result = await removeCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID1 });
    expect(result).toEqual({ success: true });
    expect(mockDbDelete).toHaveBeenCalledTimes(1);
  });

  it('creates LOW audit event with action REMOVE_COLLECTION_ITEM', async () => {
    mockCanManage();
    mockDbDelete.mockReturnValue(makeDeleteChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { removeCollectionItemAction } = await import('../admin-curated-collections');
    await removeCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID1 });

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('REMOVE_COLLECTION_ITEM');
    expect(auditValues.severity).toBe('LOW');
    expect(auditValues.subject).toBe('CuratedCollection');
  });
});

// ─── reorderCollectionItemsAction ────────────────────────────────────────────

describe('reorderCollectionItemsAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { reorderCollectionItemsAction } = await import('../admin-curated-collections');
    expect(await reorderCollectionItemsAction({
      collectionId: COLL_ID,
      items: [{ listingId: LIST_ID1, sortOrder: 0 }],
    })).toEqual({ error: 'Forbidden' });
  });

  it('updates sortOrder for each item', async () => {
    mockCanManage();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { reorderCollectionItemsAction } = await import('../admin-curated-collections');
    const result = await reorderCollectionItemsAction({
      collectionId: COLL_ID,
      items: [{ listingId: LIST_ID1, sortOrder: 0 }, { listingId: LIST_ID2, sortOrder: 1 }],
    });

    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('creates LOW audit event with action REORDER_COLLECTION_ITEMS', async () => {
    mockCanManage();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { reorderCollectionItemsAction } = await import('../admin-curated-collections');
    await reorderCollectionItemsAction({
      collectionId: COLL_ID,
      items: [{ listingId: LIST_ID1, sortOrder: 0 }],
    });

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('REORDER_COLLECTION_ITEMS');
    expect(auditValues.severity).toBe('LOW');
  });
});

// ─── searchListingsForCollectionAction ───────────────────────────────────────

describe('searchListingsForCollectionAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies read', async () => {
    mockForbidden();
    const { searchListingsForCollectionAction } = await import('../admin-curated-collections');
    expect(await searchListingsForCollectionAction({ query: 'nike', excludeListingIds: [] })).toEqual({ error: 'Forbidden' });
  });

  it('returns listings matching search query', async () => {
    const ability = { can: vi.fn((a: string, s: string) => a === 'read' && s === 'CuratedCollection') };
    const session = { staffUserId: 'staff-001', email: 's@hub.co', displayName: 'Staff', isPlatformStaff: true as const, platformRoles: ['MODERATION'] };
    mockStaffAuthorize.mockResolvedValue({ ability, session });

    const { searchListingsForCollection } = await import('@/lib/queries/admin-curated-collections');
    vi.mocked(searchListingsForCollection).mockResolvedValue([
      { id: LIST_ID1, title: 'Nike Air Max', slug: 'nike-air-max', priceCents: 9999, primaryImageUrl: null },
    ]);

    const { searchListingsForCollectionAction } = await import('../admin-curated-collections');
    const result = await searchListingsForCollectionAction({ query: 'nike', excludeListingIds: [] });

    expect(result).toHaveProperty('success', true);
    expect((result as { listings: unknown[] }).listings).toHaveLength(1);
  });

  it('excludes listings already in collection', async () => {
    const ability = { can: vi.fn((a: string, s: string) => a === 'read' && s === 'CuratedCollection') };
    const session = { staffUserId: 'staff-001', email: 's@hub.co', displayName: 'Staff', isPlatformStaff: true as const, platformRoles: ['MODERATION'] };
    mockStaffAuthorize.mockResolvedValue({ ability, session });

    const { searchListingsForCollection } = await import('@/lib/queries/admin-curated-collections');
    vi.mocked(searchListingsForCollection).mockResolvedValue([]);

    const { searchListingsForCollectionAction } = await import('../admin-curated-collections');
    await searchListingsForCollectionAction({ query: 'nike', excludeListingIds: [LIST_ID1, LIST_ID2] });

    expect(searchListingsForCollection).toHaveBeenCalledWith('nike', [LIST_ID1, LIST_ID2]);
  });
});
