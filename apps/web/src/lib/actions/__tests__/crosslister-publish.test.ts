import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must mock 'use server' module dependencies before import
vi.mock('@twicely/casl', () => ({
  authorize: vi.fn().mockResolvedValue({
    session: { userId: 'user-1', delegationId: null },
    ability: {
      can: vi.fn().mockReturnValue(true),
    },
  }),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'job-1' }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: {},
  channelProjection: {},
  crosslisterAccount: {},
  crossJob: {},
  platformSetting: {},
  featureFlag: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@twicely/crosslister/services/publish-meter', () => ({
  canPublish: vi.fn().mockResolvedValue(true),
  getPublishAllowance: vi.fn().mockResolvedValue({
    tier: 'FREE',
    monthlyLimit: 25,
    usedThisMonth: 0,
    remaining: 25,
    rolloverBalance: 0,
  }),
}));

vi.mock('@twicely/crosslister/services/publish-service', () => ({
  publishListingToChannel: vi.fn().mockResolvedValue({
    success: true,
    crossJobId: 'cj-1',
    projectionId: 'proj-1',
  }),
  enqueueSyncJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/crosslister/connector-registry', () => ({
  getConnector: vi.fn().mockReturnValue({
    delistListing: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

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

vi.mock('@twicely/crosslister/channel-registry', () => ({
  getChannelMetadata: vi.fn().mockReturnValue({
    channel: 'EBAY',
    displayName: 'eBay',
    featureFlags: { crosslistEnabled: 'crosslister.ebay.crosslistEnabled' },
  }),
}));

vi.mock('@/lib/services/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/validations/crosslister', () => ({
  publishListingsSchema: {
    safeParse: vi.fn().mockImplementation((input: unknown) => {
      const i = input as Record<string, unknown>;
      if (!i?.listingIds || !i?.channels) {
        return { success: false, error: { issues: [{ message: 'Invalid' }] } };
      }
      return { success: true, data: { listingIds: i.listingIds, channels: i.channels } };
    }),
  },
  updateProjectionOverridesSchema: {
    safeParse: vi.fn().mockImplementation((input: unknown) => {
      const i = input as Record<string, unknown>;
      if (!i?.projectionId) {
        return { success: false, error: { issues: [{ message: 'projectionId required' }] } };
      }
      return { success: true, data: i };
    }),
  },
  cancelJobSchema: {},
}));

describe('publishListings', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns error for invalid input schema', async () => {
    const { publishListingsSchema } = await import('@/lib/validations/crosslister');
    (publishListingsSchema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      success: false,
      error: { issues: [{ message: 'listingIds is required' }] },
    });
    const { publishListings } = await import('../crosslister-publish');
    const result = await publishListings({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('listingIds');
  });

  it('returns Unauthorized when no session', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ session: null, ability: { can: vi.fn().mockReturnValue(true) } });
    const { publishListings } = await import('../crosslister-publish');
    const result = await publishListings({ listingIds: ['lst-1'], channels: ['EBAY'] });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns Forbidden when ability.can returns false', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { publishListings } = await import('../crosslister-publish');
    const result = await publishListings({ listingIds: ['lst-1'], channels: ['EBAY'] });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns error when insufficient publish credits', async () => {
    const { canPublish, getPublishAllowance } = await import('@/lib/crosslister/services/publish-meter');
    (canPublish as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    (getPublishAllowance as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tier: 'FREE', monthlyLimit: 25, usedThisMonth: 25, remaining: 0, rolloverBalance: 0,
    });
    const { publishListings } = await import('../crosslister-publish');
    const result = await publishListings({ listingIds: ['lst-1'], channels: ['EBAY'] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient publish credits');
  });

  it('returns success with queued count on happy path (F3.1: async enqueue)', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 'lst-1', ownerUserId: 'user-1', status: 'ACTIVE' }]),
    });
    const { publishListings } = await import('../crosslister-publish');
    const result = await publishListings({ listingIds: ['lst-1'], channels: ['EBAY'] });
    expect(result.success).toBe(true);
    expect(result.data?.queued).toBe(1);
    expect(result.data?.failed).toBe(0);
  });

  it('uses onBehalfOfSellerId when delegationId is set', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      session: { userId: 'staff-user', delegationId: 'del-1', onBehalfOfSellerId: 'seller-2' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    const { canPublish } = await import('@/lib/crosslister/services/publish-meter');
    (canPublish as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 'lst-1', ownerUserId: 'seller-2', status: 'ACTIVE' }]),
    });
    const { publishListingToChannel } = await import('@/lib/crosslister/services/publish-service');
    const { publishListings } = await import('../crosslister-publish');
    await publishListings({ listingIds: ['lst-1'], channels: ['EBAY'] });
    // publishListingToChannel should be called with sellerId = 'seller-2'
    expect(publishListingToChannel).toHaveBeenCalledWith('lst-1', 'EBAY', 'seller-2');
  });

  it('records failed listings not owned by seller', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 'lst-1', ownerUserId: 'other-user', status: 'ACTIVE' }]),
    });
    const { publishListings } = await import('../crosslister-publish');
    const result = await publishListings({ listingIds: ['lst-1'], channels: ['EBAY'] });
    expect(result.success).toBe(true);
    expect(result.data?.failed).toBe(1);
    expect(result.data?.errors[0]?.error).toContain('not owned');
  });

  it('records failed listings with non-ACTIVE status', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 'lst-1', ownerUserId: 'user-1', status: 'DRAFT' }]),
    });
    const { publishListings } = await import('../crosslister-publish');
    const result = await publishListings({ listingIds: ['lst-1'], channels: ['EBAY'] });
    expect(result.success).toBe(true);
    expect(result.data?.failed).toBe(1);
  });
});

describe('delistFromChannel', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns Unauthorized when no session', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ session: null, ability: { can: vi.fn() } });
    const { delistFromChannel } = await import('../crosslister-publish');
    const result = await delistFromChannel({ projectionId: 'proj-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error for invalid schema', async () => {
    const { delistFromChannel } = await import('../crosslister-publish');
    const result = await delistFromChannel({});
    expect(result.success).toBe(false);
  });

  it('returns Not found when projection does not belong to seller', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // not found
    });
    const { delistFromChannel } = await import('../crosslister-publish');
    const result = await delistFromChannel({ projectionId: 'proj-missing' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('creates a DELIST crossJob when delisting (F3.1: enqueue pattern)', async () => {
    const { db } = await import('@twicely/db');
    let callNum = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callNum++;
        if (callNum === 1) {
          return Promise.resolve([{
            id: 'proj-1', sellerId: 'user-1', status: 'ACTIVE',
            externalId: 'ext-123', accountId: 'acct-1', channel: 'EBAY',
            listingId: 'lst-1',
          }]);
        }
        if (callNum === 2) {
          // account lookup
          return Promise.resolve([{
            id: 'acct-1', sellerId: 'user-1', channel: 'EBAY', status: 'ACTIVE',
          }]);
        }
        return Promise.resolve([]);
      }),
    }));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });
    const insertedValues: unknown[] = [];
    (db.insert as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: unknown) => {
        insertedValues.push(vals);
        return { returning: vi.fn().mockResolvedValue([{ id: 'cj-delist' }]) };
      }),
    }));

    const { delistFromChannel } = await import('../crosslister-publish');
    const result = await delistFromChannel({ projectionId: 'proj-1' });
    expect(result.success).toBe(true);
    // F3.1: A DELIST crossJob IS created (enqueue pattern)
    const jobRow = insertedValues[0] as Record<string, unknown>;
    expect(jobRow?.jobType).toBe('DELIST');
    expect(jobRow?.status).toBe('QUEUED');
  });

  it('returns error when projection status is not ACTIVE', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'proj-1', sellerId: 'user-1', status: 'DELISTED',
        externalId: 'ext-123', accountId: 'acct-1', channel: 'EBAY',
      }]),
    });
    const { delistFromChannel } = await import('../crosslister-publish');
    const result = await delistFromChannel({ projectionId: 'proj-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not active');
  });
});

describe('updateProjectionOverrides', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns error for missing projectionId', async () => {
    const { updateProjectionOverrides } = await import('../crosslister-publish');
    const result = await updateProjectionOverrides({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('projectionId');
  });

  it('returns success and sets hasPendingSync=true for ACTIVE projection', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'proj-1', status: 'ACTIVE', syncEnabled: true, overridesJson: {},
      }]),
    });
    const setCalls: unknown[] = [];
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockImplementation((vals: unknown) => {
        setCalls.push(vals);
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    });
    const { updateProjectionOverrides } = await import('../crosslister-publish');
    const result = await updateProjectionOverrides({
      projectionId: 'proj-1',
      titleOverride: 'New Title',
    });
    expect(result.success).toBe(true);
    const update = setCalls[0] as Record<string, unknown>;
    expect(update?.hasPendingSync).toBe(true);
  });
});

describe('getPublishAllowanceAction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns allowance for authenticated seller', async () => {
    const { getPublishAllowanceAction } = await import('../crosslister-publish');
    const result = await getPublishAllowanceAction();
    expect(result.success).toBe(true);
    expect(result.data?.tier).toBe('FREE');
    expect(result.data?.monthlyLimit).toBe(25);
  });

  it('returns Unauthorized when no session', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      session: null,
      ability: { can: vi.fn() },
    });
    const { getPublishAllowanceAction } = await import('../crosslister-publish');
    const result = await getPublishAllowanceAction();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });
});
