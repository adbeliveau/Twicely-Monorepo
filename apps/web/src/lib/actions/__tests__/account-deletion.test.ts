import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: mockAuthorize,
  sub: (...args: unknown[]) => args,
}));

vi.mock('@twicely/db/schema', () => ({
  order: {
    id: 'id',
    sellerId: 'seller_id',
    buyerId: 'buyer_id',
    status: 'status',
  },
  user: {
    id: 'id',
    deletionRequestedAt: 'deletion_requested_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  inArray: vi.fn((col, vals) => ({ op: 'inArray', col, vals })),
}));

const mockCascadeProjectionsToOrphaned = vi.fn();
const mockRevertOrphanedProjections = vi.fn();

vi.mock('@twicely/crosslister/services/projection-cascade', () => ({
  cascadeProjectionsToOrphaned: mockCascadeProjectionsToOrphaned,
  revertOrphanedProjections: mockRevertOrphanedProjections,
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(30),
}));

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate },
}));

function makeSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue({ rowCount: 1 }),
  };
  chain.set.mockReturnValue(chain);
  return chain;
}

function makeSession(userId = 'user-1') {
  return { session: { userId }, ability: { can: vi.fn().mockReturnValue(true) } };
}

// ─── getAccountDeletionBlockers ───────────────────────────────────────────────

describe('getAccountDeletionBlockers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty array when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { getAccountDeletionBlockers } = await import('../account-deletion');
    const blockers = await getAccountDeletionBlockers();

    expect(blockers).toHaveLength(0);
  });

  it('returns empty array when no open orders', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))  // seller orders
      .mockReturnValueOnce(makeSelectChain([])); // buyer orders

    const { getAccountDeletionBlockers } = await import('../account-deletion');
    const blockers = await getAccountDeletionBlockers();

    expect(blockers).toHaveLength(0);
  });

  it('returns OPEN_ORDERS blocker when seller has open orders', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'order-1' }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { getAccountDeletionBlockers } = await import('../account-deletion');
    const blockers = await getAccountDeletionBlockers();

    expect(blockers).toHaveLength(1);
    const b0 = blockers[0]!;
    expect(b0.type).toBe('OPEN_ORDERS');
    expect(b0.count).toBe(1);
  });

  it('returns OPEN_ORDERS blocker when buyer has open orders', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'order-3' }]));

    const { getAccountDeletionBlockers } = await import('../account-deletion');
    const blockers = await getAccountDeletionBlockers();

    expect(blockers).toHaveLength(1);
    const b0 = blockers[0]!;
    expect(b0.type).toBe('OPEN_ORDERS');
    expect(b0.count).toBe(1);
  });

  it('combines seller and buyer open orders into single blocker', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'order-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'order-2' }]));

    const { getAccountDeletionBlockers } = await import('../account-deletion');
    const blockers = await getAccountDeletionBlockers();

    expect(blockers).toHaveLength(1);
    expect(blockers[0]!.count).toBe(1);
  });
});

// ─── beginAccountDeletion ─────────────────────────────────────────────────────

describe('beginAccountDeletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when not logged in', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { beginAccountDeletion } = await import('../account-deletion');
    const result = await beginAccountDeletion();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns blockers when account has open orders', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'order-1' }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { beginAccountDeletion } = await import('../account-deletion');
    const result = await beginAccountDeletion();

    expect(result.success).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(mockCascadeProjectionsToOrphaned).not.toHaveBeenCalled();
  });

  it('cascades projections to ORPHANED when no blockers', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-42'));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockCascadeProjectionsToOrphaned.mockResolvedValue(3);

    const { beginAccountDeletion } = await import('../account-deletion');
    const result = await beginAccountDeletion();

    expect(result.success).toBe(true);
    expect(mockCascadeProjectionsToOrphaned).toHaveBeenCalledWith('user-42');
  });
});

// ─── cancelAccountDeletion ────────────────────────────────────────────────────

describe('cancelAccountDeletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when not logged in', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { cancelAccountDeletion } = await import('../account-deletion');
    const result = await cancelAccountDeletion();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
    expect(result.revertedCount).toBe(0);
  });

  it('reverts ORPHANED projections to UNMANAGED', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-7'));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockRevertOrphanedProjections.mockResolvedValue(5);

    const { cancelAccountDeletion } = await import('../account-deletion');
    const result = await cancelAccountDeletion();

    expect(result.success).toBe(true);
    expect(result.revertedCount).toBe(5);
    expect(mockRevertOrphanedProjections).toHaveBeenCalledWith('user-7');
  });

  it('returns revertedCount of 0 when no ORPHANED projections', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockRevertOrphanedProjections.mockResolvedValue(0);

    const { cancelAccountDeletion } = await import('../account-deletion');
    const result = await cancelAccountDeletion();

    expect(result.success).toBe(true);
    expect(result.revertedCount).toBe(0);
  });
});
