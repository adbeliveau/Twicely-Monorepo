import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbUpdate = vi.fn();
const mockDb = { update: mockDbUpdate };

vi.mock('@twicely/db', () => ({ db: mockDb }));

vi.mock('@twicely/db/schema', () => ({
  channelProjection: {
    sellerId: 'seller_id',
    channel: 'channel',
    status: 'status',
    orphanedAt: 'orphaned_at',
    pollTier: 'poll_tier',
    nextPollAt: 'next_poll_at',
  },
  crossJob: {
    sellerId: 'seller_id',
    status: 'status',
    jobType: 'job_type',
  },
}));

vi.mock('@twicely/crosslister/polling/poll-tier-manager', () => ({
  getTierInterval: vi.fn().mockResolvedValue(2_700_000),
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  inArray: vi.fn((col, vals) => ({ op: 'inArray', col, vals })),
  not: vi.fn((expr) => ({ op: 'not', expr })),
}));

function makeUpdateChain(returning: unknown[] = []) {
  const chain = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue(returning),
  };
  chain.set.mockReturnValue(chain);
  return chain;
}

function makeUpdateChainWithReturning(rows: unknown[] = []) {
  const chain = {
    set: vi.fn(),
    where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }),
  };
  chain.set.mockReturnValue(chain);
  return chain;
}

function getMockCallArg<T>(mockFn: ReturnType<typeof vi.fn>, callIndex: number, argIndex: number): T {
  const call = mockFn.mock.calls[callIndex];
  if (!call) throw new Error(`Expected mock call at index ${callIndex}`);
  return call[argIndex] as T;
}

describe('cascadeProjectionsToUnmanaged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('transitions ACTIVE projections to UNMANAGED and returns count', async () => {
    const rows = [{ id: 'proj-1' }, { id: 'proj-2' }];
    mockDbUpdate
      .mockReturnValueOnce(makeUpdateChainWithReturning(rows))
      .mockReturnValueOnce(makeUpdateChain());

    const { cascadeProjectionsToUnmanaged } = await import('../projection-cascade');
    const count = await cascadeProjectionsToUnmanaged('user-1');

    expect(count).toBe(2);
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('returns 0 when no ACTIVE projections exist', async () => {
    mockDbUpdate
      .mockReturnValueOnce(makeUpdateChainWithReturning([]))
      .mockReturnValueOnce(makeUpdateChain());

    const { cascadeProjectionsToUnmanaged } = await import('../projection-cascade');
    const count = await cascadeProjectionsToUnmanaged('user-1');

    expect(count).toBe(0);
  });

  it('also cancels pending/queued crosslister jobs', async () => {
    mockDbUpdate
      .mockReturnValueOnce(makeUpdateChainWithReturning([{ id: 'proj-1' }]))
      .mockReturnValueOnce(makeUpdateChain());

    const { cascadeProjectionsToUnmanaged } = await import('../projection-cascade');
    await cascadeProjectionsToUnmanaged('user-1');

    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });
});

describe('cancelCrosslisterJobsForSeller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('cancels PENDING and QUEUED jobs when excludeTypes is empty', async () => {
    const chain = makeUpdateChain();
    mockDbUpdate.mockReturnValueOnce(chain);

    const { cancelCrosslisterJobsForSeller } = await import('../projection-cascade');
    await cancelCrosslisterJobsForSeller('user-1', []);

    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    const setArg = getMockCallArg<Record<string, unknown>>(chain.set, 0, 0);
    expect(setArg.status).toBe('CANCELED');
  });

  it('uses not(inArray) when excludeTypes is non-empty', async () => {
    const chain = makeUpdateChain();
    mockDbUpdate.mockReturnValueOnce(chain);

    const { inArray, not } = await import('drizzle-orm');
    const { cancelCrosslisterJobsForSeller } = await import('../projection-cascade');
    await cancelCrosslisterJobsForSeller('user-1', ['DELIST']);

    expect(not).toHaveBeenCalled();
    expect(inArray).toHaveBeenCalled();
  });

  it('does not call not() when excludeTypes is empty', async () => {
    const chain = makeUpdateChain();
    mockDbUpdate.mockReturnValueOnce(chain);

    const { not } = await import('drizzle-orm');
    const { cancelCrosslisterJobsForSeller } = await import('../projection-cascade');
    await cancelCrosslisterJobsForSeller('user-1', []);

    expect(not).not.toHaveBeenCalled();
  });
});

describe('reactivateUnmanagedProjections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sets UNMANAGED projections to ACTIVE with COLD poll tier', async () => {
    const rows = [{ id: 'proj-1' }, { id: 'proj-2' }];
    const chain = makeUpdateChainWithReturning(rows);
    mockDbUpdate.mockReturnValueOnce(chain);

    const { reactivateUnmanagedProjections } = await import('../projection-cascade');
    const count = await reactivateUnmanagedProjections('user-1');

    expect(count).toBe(2);
    const setArg = getMockCallArg<Record<string, unknown>>(chain.set, 0, 0);
    expect(setArg.status).toBe('ACTIVE');
    expect(setArg.pollTier).toBe('COLD');
    expect(setArg.nextPollAt).toBeInstanceOf(Date);
  });

  it('returns 0 when no UNMANAGED projections exist', async () => {
    mockDbUpdate.mockReturnValueOnce(makeUpdateChainWithReturning([]));

    const { reactivateUnmanagedProjections } = await import('../projection-cascade');
    const count = await reactivateUnmanagedProjections('user-1');

    expect(count).toBe(0);
  });

  it('does not affect ORPHANED projections', async () => {
    const chain = makeUpdateChainWithReturning([]);
    mockDbUpdate.mockReturnValueOnce(chain);

    const { reactivateUnmanagedProjections } = await import('../projection-cascade');
    await reactivateUnmanagedProjections('user-1');

    const whereArg = getMockCallArg<Record<string, unknown>>(chain.where, 0, 0);
    // The where clause should be an 'and' expression (sellerId + status=UNMANAGED)
    expect(whereArg.op).toBe('and');
  });
});

describe('cascadeProjectionsToOrphaned', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('transitions ACTIVE/UNMANAGED/PUBLISHING/PAUSED to ORPHANED with orphanedAt set', async () => {
    const rows = [{ id: 'proj-1' }, { id: 'proj-2' }, { id: 'proj-3' }];
    const chain = makeUpdateChainWithReturning(rows);
    mockDbUpdate
      .mockReturnValueOnce(chain)
      .mockReturnValueOnce(makeUpdateChain());

    const { cascadeProjectionsToOrphaned } = await import('../projection-cascade');
    const count = await cascadeProjectionsToOrphaned('user-1');

    expect(count).toBe(3);
    const setArg = getMockCallArg<Record<string, unknown>>(chain.set, 0, 0);
    expect(setArg.status).toBe('ORPHANED');
    expect(setArg.orphanedAt).toBeInstanceOf(Date);
  });

  it('cancels ALL crossJob entries (including any job types)', async () => {
    mockDbUpdate
      .mockReturnValueOnce(makeUpdateChainWithReturning([{ id: 'proj-1' }]))
      .mockReturnValueOnce(makeUpdateChain());

    const { cascadeProjectionsToOrphaned } = await import('../projection-cascade');
    await cascadeProjectionsToOrphaned('user-1');

    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('returns 0 when no eligible projections', async () => {
    mockDbUpdate
      .mockReturnValueOnce(makeUpdateChainWithReturning([]))
      .mockReturnValueOnce(makeUpdateChain());

    const { cascadeProjectionsToOrphaned } = await import('../projection-cascade');
    const count = await cascadeProjectionsToOrphaned('user-1');

    expect(count).toBe(0);
  });
});

describe('revertOrphanedProjections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('reverts ORPHANED → UNMANAGED and nulls orphanedAt', async () => {
    const rows = [{ id: 'proj-1' }];
    const chain = makeUpdateChainWithReturning(rows);
    mockDbUpdate.mockReturnValueOnce(chain);

    const { revertOrphanedProjections } = await import('../projection-cascade');
    const count = await revertOrphanedProjections('user-1');

    expect(count).toBe(1);
    const setArg = getMockCallArg<Record<string, unknown>>(chain.set, 0, 0);
    expect(setArg.status).toBe('UNMANAGED');
    expect(setArg.orphanedAt).toBeNull();
  });

  it('returns 0 when no ORPHANED projections', async () => {
    mockDbUpdate.mockReturnValueOnce(makeUpdateChainWithReturning([]));

    const { revertOrphanedProjections } = await import('../projection-cascade');
    const count = await revertOrphanedProjections('user-1');

    expect(count).toBe(0);
  });
});

describe('disconnectPlatformProjections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('transitions ACTIVE projections for specified channel to UNMANAGED', async () => {
    const rows = [{ id: 'proj-1' }];
    const chain = makeUpdateChainWithReturning(rows);
    mockDbUpdate.mockReturnValueOnce(chain);

    const { disconnectPlatformProjections } = await import('../projection-cascade');
    const count = await disconnectPlatformProjections('user-1', 'EBAY');

    expect(count).toBe(1);
    const setArg = getMockCallArg<Record<string, unknown>>(chain.set, 0, 0);
    expect(setArg.status).toBe('UNMANAGED');
  });

  it('returns 0 when no ACTIVE projections for that channel', async () => {
    mockDbUpdate.mockReturnValueOnce(makeUpdateChainWithReturning([]));

    const { disconnectPlatformProjections } = await import('../projection-cascade');
    const count = await disconnectPlatformProjections('user-1', 'POSHMARK');

    expect(count).toBe(0);
  });

  it('only affects the specified channel, not other channels', async () => {
    mockDbUpdate.mockReturnValueOnce(makeUpdateChainWithReturning([{ id: 'proj-ebay' }]));

    const { eq } = await import('drizzle-orm');
    const { disconnectPlatformProjections } = await import('../projection-cascade');
    await disconnectPlatformProjections('user-1', 'EBAY');

    const eqMock = eq as ReturnType<typeof vi.fn>;
    const eqCalls = eqMock.mock.calls as Array<[unknown, unknown]>;
    const channelCall = eqCalls.find(([, val]) => val === 'EBAY');
    expect(channelCall).toBeDefined();
  });
});
