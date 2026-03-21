import { describe, it, expect, vi, beforeEach } from 'vitest';

const COLL_ID = 'cm1collection0000000000a';
const COLL_ID_NONE = 'cm1collectionnotfound00x';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// ─── createCollectionAction ──────────────────────────────────────────────────
describe('createCollectionAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies manage on CuratedCollection', async () => {
    mockForbidden();
    const { createCollectionAction } = await import('../admin-curated-collections');
    expect(await createCollectionAction({ title: 'Summer Picks' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing title', async () => {
    mockCanManage();
    const { createCollectionAction } = await import('../admin-curated-collections');
    expect(await createCollectionAction({})).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for title exceeding 200 chars', async () => {
    mockCanManage();
    const { createCollectionAction } = await import('../admin-curated-collections');
    expect(await createCollectionAction({ title: 'A'.repeat(201) })).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra (unknown) fields via strict schema', async () => {
    mockCanManage();
    const { createCollectionAction } = await import('../admin-curated-collections');
    expect(await createCollectionAction({ title: 'Valid', isPublished: true })).toEqual({ error: 'Invalid input' });
  });

  it('inserts collection with correct fields including auto-generated slug', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { createCollectionAction } = await import('../admin-curated-collections');
    const result = await createCollectionAction({ title: 'Summer Picks', sortOrder: 0 });

    expect(result).toHaveProperty('success', true);
    const insertValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(insertValues.title).toBe('Summer Picks');
    expect(insertValues.slug).toBe('summer-picks');
  });

  it('sets curatedBy to session.staffUserId (never from input)', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { createCollectionAction } = await import('../admin-curated-collections');
    await createCollectionAction({ title: 'Test Collection' });

    const insertValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(insertValues.curatedBy).toBe('staff-001');
  });

  it('sets isPublished to false on create', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { createCollectionAction } = await import('../admin-curated-collections');
    await createCollectionAction({ title: 'Test' });

    const insertValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(insertValues.isPublished).toBe(false);
  });

  it('creates MEDIUM audit event with action CREATE_CURATED_COLLECTION', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { createCollectionAction } = await import('../admin-curated-collections');
    await createCollectionAction({ title: 'Test' });

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[1]![0];
    expect(auditValues.action).toBe('CREATE_CURATED_COLLECTION');
    expect(auditValues.severity).toBe('MEDIUM');
    expect(auditValues.subject).toBe('CuratedCollection');
    expect(auditValues.actorType).toBe('STAFF');
  });

  it('calls revalidatePath for /mod/collections', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { revalidatePath } = await import('next/cache');

    const { createCollectionAction } = await import('../admin-curated-collections');
    await createCollectionAction({ title: 'Test' });
    expect(revalidatePath).toHaveBeenCalledWith('/mod/collections');
  });

  it('returns success with collectionId', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { createCollectionAction } = await import('../admin-curated-collections');
    const result = await createCollectionAction({ title: 'Test' });
    expect(result).toHaveProperty('success', true);
    expect(typeof (result as { collectionId: string }).collectionId).toBe('string');
  });
});

// ─── updateCollectionAction ───────────────────────────────────────────────────

describe('updateCollectionAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { updateCollectionAction } = await import('../admin-curated-collections');
    expect(await updateCollectionAction({ collectionId: COLL_ID })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing collectionId', async () => {
    mockCanManage();
    const { updateCollectionAction } = await import('../admin-curated-collections');
    expect(await updateCollectionAction({})).toEqual({ error: 'Invalid input' });
  });

  it('returns Not found when collection does not exist', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { updateCollectionAction } = await import('../admin-curated-collections');
    expect(await updateCollectionAction({ collectionId: COLL_ID_NONE })).toEqual({ error: 'Not found' });
  });

  it('updates only provided fields (explicit field mapping)', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateCollectionAction } = await import('../admin-curated-collections');
    const result = await updateCollectionAction({ collectionId: COLL_ID, sortOrder: 5 });

    expect(result).toEqual({ success: true });
    const setFields = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(setFields.sortOrder).toBe(5);
    expect(setFields.title).toBeUndefined();
  });

  it('regenerates slug when title is updated', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateCollectionAction } = await import('../admin-curated-collections');
    await updateCollectionAction({ collectionId: COLL_ID, title: 'New Title' });

    const setFields = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(setFields.slug).toBe('new-title');
  });

  it('creates MEDIUM audit event with action UPDATE_CURATED_COLLECTION', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateCollectionAction } = await import('../admin-curated-collections');
    await updateCollectionAction({ collectionId: COLL_ID, isPublished: true });

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('UPDATE_CURATED_COLLECTION');
    expect(auditValues.severity).toBe('MEDIUM');
  });

  it('revalidates both list and detail paths', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { revalidatePath } = await import('next/cache');

    const { updateCollectionAction } = await import('../admin-curated-collections');
    await updateCollectionAction({ collectionId: COLL_ID });
    expect(revalidatePath).toHaveBeenCalledWith('/mod/collections');
    expect(revalidatePath).toHaveBeenCalledWith('/mod/collections/' + COLL_ID);
  });
});

// ─── deleteCollectionAction ───────────────────────────────────────────────────

describe('deleteCollectionAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { deleteCollectionAction } = await import('../admin-curated-collections');
    expect(await deleteCollectionAction({ collectionId: COLL_ID })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing collectionId', async () => {
    mockCanManage();
    const { deleteCollectionAction } = await import('../admin-curated-collections');
    expect(await deleteCollectionAction({})).toEqual({ error: 'Invalid input' });
  });

  it('deletes collection from database', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbDelete.mockReturnValue(makeDeleteChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { deleteCollectionAction } = await import('../admin-curated-collections');
    const result = await deleteCollectionAction({ collectionId: COLL_ID });
    expect(result).toEqual({ success: true });
    expect(mockDbDelete).toHaveBeenCalledTimes(1);
  });

  it('creates HIGH audit event and revalidates /mod/collections', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: COLL_ID }]));
    mockDbDelete.mockReturnValue(makeDeleteChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { revalidatePath } = await import('next/cache');

    const { deleteCollectionAction } = await import('../admin-curated-collections');
    await deleteCollectionAction({ collectionId: COLL_ID });

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('DELETE_CURATED_COLLECTION');
    expect(auditValues.severity).toBe('HIGH');
    expect(revalidatePath).toHaveBeenCalledWith('/mod/collections');
  });
});
