import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
const mockSub = vi.fn((type: string, obj: Record<string, unknown>) => ({ __caslSubjectType__: type, ...obj }));

vi.mock('@twicely/casl', () => ({
  authorize: mockAuthorize,
  sub: mockSub,
}));

vi.mock('@twicely/db/schema', () => ({
  listing: {
    id: 'id',
    ownerUserId: 'owner_user_id',
    status: 'status',
    archivedAt: 'archived_at',
    updatedAt: 'updated_at',
    endedAt: 'ended_at',
  },
  listingImage: {
    listingId: 'listing_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
}));

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
    delete: mockDbDelete,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@twicely/search/typesense-index', () => ({
  deleteListingDocument: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSelectChain(result: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(result) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  chain.set.mockReturnValue(chain);
  return chain;
}

function makeDeleteChain() {
  const chain = { where: vi.fn().mockResolvedValue(undefined) };
  return chain;
}

function makeAbility(canUpdate = true, canDelete = true) {
  return {
    can: vi.fn().mockReturnValue(true),
    cannot: vi.fn().mockImplementation((action: string) => {
      if (action === 'update') return !canUpdate;
      if (action === 'delete') return !canDelete;
      return true;
    }),
  };
}

// ─── deleteListing ────────────────────────────────────────────────────────────
// Tests target the wired file at apps/web/src/lib/actions/listings-delete.ts (plural).
// The singular listing-delete.ts file was deleted as part of the dual-file consolidation
// (see /twicely-fix mk-listings 2026-04-07). The plural file is the source of truth for
// delete and includes the SOLD guard per Decision #109 (Mercari model).

describe('deleteListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when listing not found', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { deleteListing } = await import('../listings-delete');
    const result = await deleteListing('z123456789012345678901234');  // valid cuid2 length

    expect(result.success).toBe(false);
    expect(result.error).toBe('Listing not found');
  });

  it('blocks deletion of SOLD listings with informative message (Decision #109)', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'user-1', status: 'SOLD' },
    ]));

    const { deleteListing } = await import('../listings-delete');
    const result = await deleteListing('z123456789012345678901234');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Sold listings are kept on record');
  });

  it('hard-deletes a DRAFT listing (also deletes images)', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'user-1', status: 'DRAFT' },
    ]));
    mockDbDelete.mockReturnValue(makeDeleteChain());

    const { deleteListing } = await import('../listings-delete');
    const result = await deleteListing('z123456789012345678901234');

    expect(result.success).toBe(true);
    // Plural file deletes images + listing → 2 delete calls
    expect(mockDbDelete).toHaveBeenCalledTimes(2);
  });

  it('soft-deletes an ENDED listing by setting status=ENDED', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'user-1', status: 'ENDED' },
    ]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);

    const { deleteListing } = await import('../listings-delete');
    const result = await deleteListing('z123456789012345678901234');

    expect(result.success).toBe(true);
    // Plural file does soft delete (UPDATE) for non-DRAFT, non-SOLD
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('returns Forbidden when ability denies delete', async () => {
    // Plural uses ability.can() not cannot() — make .can() return false for delete
    const denyAbility = {
      can: vi.fn().mockReturnValue(false),
      cannot: vi.fn().mockReturnValue(true),
    };
    mockAuthorize.mockResolvedValue({ ability: denyAbility, session: { userId: 'user-1' } });

    const { deleteListing } = await import('../listings-delete');
    const result = await deleteListing('z123456789012345678901234');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});

// ─── archiveListing ───────────────────────────────────────────────────────────

describe('archiveListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('archives a SOLD listing and sets archivedAt', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'user-1', status: 'SOLD' },
    ]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);

    const { archiveListing } = await import('../listing-archive');
    const result = await archiveListing('lst-1');

    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
    const setCall = updateChain.set.mock.calls[0];
    expect(setCall).toBeDefined();
    const setArg = (setCall as [Record<string, unknown>])[0];
    expect(setArg.archivedAt).toBeInstanceOf(Date);
  });

  it('returns error when archiving a non-SOLD listing', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'user-1', status: 'ACTIVE' },
    ]));

    const { archiveListing } = await import('../listing-archive');
    const result = await archiveListing('lst-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Only sold listings can be archived');
  });

  it('returns Not found when listing does not exist', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { archiveListing } = await import('../listing-archive');
    const result = await archiveListing('missing');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Forbidden when ability.cannot(update) is true', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(false, true), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'other-user', status: 'SOLD' },
    ]));

    const { archiveListing } = await import('../listing-archive');
    const result = await archiveListing('lst-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});

// ─── unarchiveListing ─────────────────────────────────────────────────────────

describe('unarchiveListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('unarchives a listing by setting archivedAt to null', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'user-1' },
    ]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);

    const { unarchiveListing } = await import('../listing-archive');
    const result = await unarchiveListing('lst-1');

    expect(result.success).toBe(true);
    const setCall = updateChain.set.mock.calls[0];
    expect(setCall).toBeDefined();
    const setArg = (setCall as [Record<string, unknown>])[0];
    expect(setArg.archivedAt).toBeNull();
  });

  it('returns Not found when listing does not exist', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { unarchiveListing } = await import('../listing-archive');
    const result = await unarchiveListing('missing');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Forbidden when ability.cannot(update) is true', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(false, true), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'other-user' },
    ]));

    const { unarchiveListing } = await import('../listing-archive');
    const result = await unarchiveListing('lst-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});
