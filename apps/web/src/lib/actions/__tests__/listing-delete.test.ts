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

describe('deleteListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when listing not found', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { deleteListing } = await import('../listing-delete');
    const result = await deleteListing('missing-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('blocks deletion of SOLD listings with informative message', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'user-1', status: 'SOLD' },
    ]));

    const { deleteListing } = await import('../listing-delete');
    const result = await deleteListing('lst-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Sold listings are kept on record');
  });

  it('deletes a DRAFT listing successfully', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'user-1', status: 'DRAFT' },
    ]));
    mockDbDelete.mockReturnValue(makeDeleteChain());

    const { deleteListing } = await import('../listing-delete');
    const result = await deleteListing('lst-1');

    expect(result.success).toBe(true);
    expect(mockDbDelete).toHaveBeenCalled();
  });

  it('deletes an ENDED listing successfully', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'user-1', status: 'ENDED' },
    ]));
    mockDbDelete.mockReturnValue(makeDeleteChain());

    const { deleteListing } = await import('../listing-delete');
    const result = await deleteListing('lst-1');

    expect(result.success).toBe(true);
  });

  it('returns Forbidden when ability.cannot(delete) is true', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(true, false), session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'other-user', status: 'DRAFT' },
    ]));

    const { deleteListing } = await import('../listing-delete');
    const result = await deleteListing('lst-1');

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
