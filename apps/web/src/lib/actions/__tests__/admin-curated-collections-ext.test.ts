/**
 * Supplemental tests for admin-curated-collections actions.
 * Covers missing edge cases not included in the primary test files.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── CUID2 test constants ──────────────────────────────────────────────────────

const COLL_ID = 'cm1collection0000000000a';
const COLL_ID_NONE = 'cm1collectionnotfound00x';
const LIST_ID1 = 'cm1listingid0000000000a1';
const LIST_ID_NONE = 'cm1listingnotfound0000x1';

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
function mockCanManage() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'manage' && s === 'CuratedCollection') };
  const session = { staffUserId: 'staff-001', email: 's@hub.co', displayName: 'Staff', isPlatformStaff: true as const, platformRoles: ['MODERATION'] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}
// mockForbidden covered in main test file — not needed here

// ─── deleteCollectionAction — missing edge cases ──────────────────────────────

describe('deleteCollectionAction — not found', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns Not found when collection does not exist', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { deleteCollectionAction } = await import('../admin-curated-collections');
    expect(await deleteCollectionAction({ collectionId: COLL_ID_NONE })).toEqual({ error: 'Not found' });
  });
});

// ─── addCollectionItemAction — missing edge cases ─────────────────────────────

describe('addCollectionItemAction — collection and listing not found', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns Not found when collection does not exist', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { addCollectionItemAction } = await import('../admin-curated-collections');
    expect(
      await addCollectionItemAction({ collectionId: COLL_ID_NONE, listingId: LIST_ID1 }),
    ).toEqual({ error: 'Not found' });
  });

  it('returns Listing not found when listing does not exist', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { addCollectionItemAction } = await import('../admin-curated-collections');
    expect(
      await addCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID_NONE }),
    ).toEqual({ error: 'Listing not found' });
  });
});

// ─── removeCollectionItemAction — validation ──────────────────────────────────

describe('removeCollectionItemAction — validation', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns Invalid input when collectionId is missing', async () => {
    mockCanManage();
    const { removeCollectionItemAction } = await import('../admin-curated-collections');
    expect(await removeCollectionItemAction({ listingId: LIST_ID1 })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input when listingId is missing', async () => {
    mockCanManage();
    const { removeCollectionItemAction } = await import('../admin-curated-collections');
    expect(await removeCollectionItemAction({ collectionId: COLL_ID })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for extra fields (strict schema)', async () => {
    mockCanManage();
    const { removeCollectionItemAction } = await import('../admin-curated-collections');
    expect(
      await removeCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID1, extra: 'bad' }),
    ).toEqual({ error: 'Invalid input' });
  });

  it('revalidates collection detail path after successful remove', async () => {
    mockCanManage();
    const mockDelete = { where: vi.fn().mockResolvedValue(undefined) };
    mockDbDelete.mockReturnValue(mockDelete);
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { revalidatePath } = await import('next/cache');

    const { removeCollectionItemAction } = await import('../admin-curated-collections');
    await removeCollectionItemAction({ collectionId: COLL_ID, listingId: LIST_ID1 });
    expect(revalidatePath).toHaveBeenCalledWith('/mod/collections/' + COLL_ID);
  });
});

// ─── reorderCollectionItemsAction — validation ────────────────────────────────

describe('reorderCollectionItemsAction — validation', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns Invalid input for empty items array (min 1)', async () => {
    mockCanManage();
    const { reorderCollectionItemsAction } = await import('../admin-curated-collections');
    expect(
      await reorderCollectionItemsAction({ collectionId: COLL_ID, items: [] }),
    ).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input when collectionId is missing', async () => {
    mockCanManage();
    const { reorderCollectionItemsAction } = await import('../admin-curated-collections');
    expect(
      await reorderCollectionItemsAction({ items: [{ listingId: LIST_ID1, sortOrder: 0 }] }),
    ).toEqual({ error: 'Invalid input' });
  });

  it('revalidates collection detail path after successful reorder', async () => {
    mockCanManage();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { revalidatePath } = await import('next/cache');

    const { reorderCollectionItemsAction } = await import('../admin-curated-collections');
    await reorderCollectionItemsAction({
      collectionId: COLL_ID,
      items: [{ listingId: LIST_ID1, sortOrder: 0 }],
    });
    expect(revalidatePath).toHaveBeenCalledWith('/mod/collections/' + COLL_ID);
  });
});

// ─── searchListingsForCollectionAction — validation ───────────────────────────

describe('searchListingsForCollectionAction — validation', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns Invalid input for empty query (min 1 char)', async () => {
    const ability = { can: vi.fn((a: string, s: string) => a === 'read' && s === 'CuratedCollection') };
    const session = { staffUserId: 'staff-001', email: 's@hub.co', displayName: 'Staff', isPlatformStaff: true as const, platformRoles: ['MODERATION'] };
    mockStaffAuthorize.mockResolvedValue({ ability, session });

    const { searchListingsForCollectionAction } = await import('../admin-curated-collections');
    expect(
      await searchListingsForCollectionAction({ query: '', excludeListingIds: [] }),
    ).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for query exceeding 200 chars', async () => {
    const ability = { can: vi.fn((a: string, s: string) => a === 'read' && s === 'CuratedCollection') };
    const session = { staffUserId: 'staff-001', email: 's@hub.co', displayName: 'Staff', isPlatformStaff: true as const, platformRoles: ['MODERATION'] };
    mockStaffAuthorize.mockResolvedValue({ ability, session });

    const { searchListingsForCollectionAction } = await import('../admin-curated-collections');
    expect(
      await searchListingsForCollectionAction({ query: 'A'.repeat(201), excludeListingIds: [] }),
    ).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for extra fields (strict schema)', async () => {
    const ability = { can: vi.fn((a: string, s: string) => a === 'read' && s === 'CuratedCollection') };
    const session = { staffUserId: 'staff-001', email: 's@hub.co', displayName: 'Staff', isPlatformStaff: true as const, platformRoles: ['MODERATION'] };
    mockStaffAuthorize.mockResolvedValue({ ability, session });

    const { searchListingsForCollectionAction } = await import('../admin-curated-collections');
    expect(
      await searchListingsForCollectionAction({ query: 'nike', excludeListingIds: [], limit: 50 }),
    ).toEqual({ error: 'Invalid input' });
  });

  it('does not insert audit event (read-only action)', async () => {
    const ability = { can: vi.fn((a: string, s: string) => a === 'read' && s === 'CuratedCollection') };
    const session = { staffUserId: 'staff-001', email: 's@hub.co', displayName: 'Staff', isPlatformStaff: true as const, platformRoles: ['MODERATION'] };
    mockStaffAuthorize.mockResolvedValue({ ability, session });

    const { searchListingsForCollection } = await import('@/lib/queries/admin-curated-collections');
    vi.mocked(searchListingsForCollection).mockResolvedValue([]);

    const { searchListingsForCollectionAction } = await import('../admin-curated-collections');
    await searchListingsForCollectionAction({ query: 'test', excludeListingIds: [] });

    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});

// ─── updateCollectionAction — extra field mapping checks ──────────────────────

describe('updateCollectionAction — field mapping edge cases', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('always sets updatedAt on update', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateCollectionAction } = await import('../admin-curated-collections');
    await updateCollectionAction({ collectionId: COLL_ID, sortOrder: 2 });

    const setFields = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(setFields.updatedAt).toBeInstanceOf(Date);
  });

  it('sets isPublished to true when publishing', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateCollectionAction } = await import('../admin-curated-collections');
    await updateCollectionAction({ collectionId: COLL_ID, isPublished: true });

    const setFields = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(setFields.isPublished).toBe(true);
  });

  it('rejects extra fields in update schema (strict mode)', async () => {
    mockCanManage();
    const { updateCollectionAction } = await import('../admin-curated-collections');
    expect(
      await updateCollectionAction({ collectionId: COLL_ID, curatedBy: 'hacker' }),
    ).toEqual({ error: 'Invalid input' });
  });

  it('sets audit actor to session.staffUserId', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateCollectionAction } = await import('../admin-curated-collections');
    await updateCollectionAction({ collectionId: COLL_ID, sortOrder: 1 });

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.actorId).toBe('staff-001');
    expect(auditValues.actorType).toBe('STAFF');
  });
});
