/** Supplementary edge-case tests for crosslister-publish server actions. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn().mockResolvedValue({
    session: { userId: 'user-1', delegationId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
  }),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'job-1' }]),
    update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(),
  },
}));
vi.mock('@twicely/db/schema', () => ({
  listing: {}, channelProjection: {}, crosslisterAccount: {}, crossJob: {}, platformSetting: {}, featureFlag: {},
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), and: vi.fn(), inArray: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/crosslister/services/publish-meter', () => ({
  canPublish: vi.fn().mockResolvedValue(true),
  getPublishAllowance: vi.fn().mockResolvedValue({
    tier: 'FREE', monthlyLimit: 25, usedThisMonth: 0, remaining: 25, rolloverBalance: 0,
  }),
}));
vi.mock('@twicely/crosslister/services/publish-service', () => ({
  publishListingToChannel: vi.fn().mockResolvedValue({
    success: true, crossJobId: 'cj-1', projectionId: 'proj-1',
  }),
  enqueueSyncJob: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@twicely/crosslister/connector-registry', () => ({
  getConnector: vi.fn().mockReturnValue({
    delistListing: vi.fn().mockResolvedValue({ success: true }),
  }),
}));
vi.mock('@twicely/crosslister/channel-registry', () => ({
  getChannelMetadata: vi.fn().mockReturnValue({
    channel: 'EBAY', displayName: 'eBay',
    featureFlags: { crosslistEnabled: 'crosslister.ebay.crosslistEnabled' },
  }),
}));
vi.mock('@/lib/services/feature-flags', () => ({ isFeatureEnabled: vi.fn().mockResolvedValue(true) }));
vi.mock('@twicely/crosslister/queue/lister-queue', () => ({
  listerPublishQueue: {
    add: vi.fn().mockResolvedValue({ id: 'bq-1' }),
    remove: vi.fn().mockResolvedValue(1),
  },
}));
vi.mock('@/lib/queries/crosslister', () => ({
  getSellerQueueStatus: vi.fn().mockResolvedValue({ queued: 0, inProgress: 0, completed: 0, failed: 0 }),
}));
vi.mock('@twicely/crosslister/queue/constants', () => ({
  PRIORITY_DELIST: 100,
  MAX_ATTEMPTS_PUBLISH: 3,
  BACKOFF_PUBLISH: { type: 'exponential', delay: 30_000 },
  REMOVE_ON_COMPLETE: { count: 1000 },
  REMOVE_ON_FAIL: { count: 5000 },
}));
vi.mock('@/lib/validations/crosslister', () => ({
  publishListingsSchema: {
    safeParse: vi.fn().mockImplementation((input: unknown) => {
      const i = input as Record<string, unknown>;
      if (!i?.listingIds || !i?.channels) return { success: false, error: { issues: [{ message: 'Invalid' }] } };
      return { success: true, data: { listingIds: i.listingIds, channels: i.channels } };
    }),
  },
  updateProjectionOverridesSchema: {
    safeParse: vi.fn().mockImplementation((input: unknown) => {
      const i = input as Record<string, unknown>;
      if (!i?.projectionId) return { success: false, error: { issues: [{ message: 'projectionId required' }] } };
      return { success: true, data: i };
    }),
  },
  cancelJobSchema: {},
}));

describe('delistFromChannel — Forbidden', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns Forbidden when ability.can(delete) returns false', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { delistFromChannel } = await import('../crosslister-publish');
    const result = await delistFromChannel({ projectionId: 'proj-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});

describe('delistFromChannel — no externalId', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns error when projection has no externalId', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'proj-1', sellerId: 'user-1', status: 'ACTIVE',
        externalId: null, accountId: 'acct-1', channel: 'EBAY',
      }]),
    });
    const { delistFromChannel } = await import('../crosslister-publish');
    const result = await delistFromChannel({ projectionId: 'proj-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('external ID');
  });
});

describe('delistFromChannel — enqueue success (F3.1)', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('enqueues DELIST job and returns success', async () => {
    const { db } = await import('@twicely/db');
    let callNum = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callNum++;
        // Call #1: projection lookup
        if (callNum === 1) {
          return Promise.resolve([{
            id: 'proj-1', sellerId: 'user-1', status: 'ACTIVE',
            externalId: 'ext-123', accountId: 'acct-1', channel: 'EBAY',
            listingId: 'lst-1',
          }]);
        }
        // Call #2: account lookup -> found
        if (callNum === 2) {
          return Promise.resolve([{ id: 'acct-1', sellerId: 'user-1', channel: 'EBAY', status: 'ACTIVE' }]);
        }
        return Promise.resolve([]);
      }),
    }));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'cj-delist' }]) }),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });
    const { delistFromChannel } = await import('../crosslister-publish');
    const result = await delistFromChannel({ projectionId: 'proj-1' });
    expect(result.success).toBe(true);
  });
});

describe('delistFromChannel — account not found', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns error when account does not exist', async () => {
    const { db } = await import('@twicely/db');
    let callNum = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callNum++;
        // Call #1: projection lookup
        if (callNum === 1) {
          return Promise.resolve([{
            id: 'proj-1', sellerId: 'user-1', status: 'ACTIVE',
            externalId: 'ext-123', accountId: 'acct-gone', channel: 'EBAY',
          }]);
        }
        // Call #2: account lookup -> not found
        if (callNum === 2) return Promise.resolve([]);
        return Promise.resolve([]);
      }),
    }));
    const { delistFromChannel } = await import('../crosslister-publish');
    const result = await delistFromChannel({ projectionId: 'proj-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Account not found');
  });
});

describe('delistFromChannel — projection not ACTIVE (F3.1)', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns error when projection is already DELISTING', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'proj-1', sellerId: 'user-1', status: 'DELISTING',
        externalId: 'ext-123', accountId: 'acct-1', channel: 'EBAY',
      }]),
    });
    const { delistFromChannel } = await import('../crosslister-publish');
    const result = await delistFromChannel({ projectionId: 'proj-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not active');
  });
});

// ---- updateProjectionOverrides edge cases ----

describe('updateProjectionOverrides — Forbidden', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns Forbidden when ability.can(update) returns false', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { updateProjectionOverrides } = await import('../crosslister-publish');
    const result = await updateProjectionOverrides({ projectionId: 'proj-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});

describe('updateProjectionOverrides — Not found', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns Not found when projection does not exist', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });
    const { updateProjectionOverrides } = await import('../crosslister-publish');
    const result = await updateProjectionOverrides({ projectionId: 'proj-gone' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });
});

// ---- getPublishAllowanceAction edge cases ----

describe('getPublishAllowanceAction — Forbidden', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns Forbidden when ability.can(read) returns false', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { getPublishAllowanceAction } = await import('../crosslister-publish');
    const result = await getPublishAllowanceAction();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});
