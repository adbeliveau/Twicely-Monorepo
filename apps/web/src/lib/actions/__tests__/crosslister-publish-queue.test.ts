/**
 * Tests for the F3.1 queue-pattern actions:
 *   publishListings (queued response)
 *   cancelJob
 *   getJobQueueStatus
 *   delistFromChannel (enqueue pattern)
 *   updateProjectionOverrides (sync job enqueue)
 */
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
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}));

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

vi.mock('@twicely/crosslister/queue/lister-queue', () => ({
  listerPublishQueue: {
    add: vi.fn().mockResolvedValue({ id: 'bq-1' }),
    remove: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('@/lib/queries/crosslister', () => ({
  getSellerQueueStatus: vi.fn().mockResolvedValue({
    queued: 3, inProgress: 1, completed: 10, failed: 0,
  }),
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
  cancelJobSchema: {
    safeParse: vi.fn().mockImplementation((input: unknown) => {
      const i = input as Record<string, unknown>;
      if (!i?.jobId) {
        return { success: false, error: { issues: [{ message: 'jobId required' }] } };
      }
      return { success: true, data: { jobId: i.jobId } };
    }),
  },
}));

// --- publishListings ---

describe('publishListings — queued response', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns queued count instead of published count', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 'lst-1', ownerUserId: 'user-1', status: 'ACTIVE' }]),
    });
    const { publishListings } = await import('../crosslister-publish');
    const result = await publishListings({ listingIds: ['lst-1'], channels: ['EBAY'] });
    expect(result.success).toBe(true);
    expect(result.data?.queued).toBe(1);
    expect('published' in (result.data ?? {})).toBe(false);
  });

  it('returns Unauthorized when no session', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ session: null, ability: { can: vi.fn() } });
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

  it('calls publishListingToChannel (enqueue) for each listing x channel', async () => {
    const { publishListingToChannel } = await import('@/lib/crosslister/services/publish-service');
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { id: 'lst-1', ownerUserId: 'user-1', status: 'ACTIVE' },
        { id: 'lst-2', ownerUserId: 'user-1', status: 'ACTIVE' },
      ]),
    });
    const { publishListings } = await import('../crosslister-publish');
    await publishListings({ listingIds: ['lst-1', 'lst-2'], channels: ['EBAY', 'POSHMARK'] });
    expect(publishListingToChannel).toHaveBeenCalledTimes(4);
  });
});

// --- cancelJob ---

describe('cancelJob', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('cancels a QUEUED job successfully', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'cj-1', sellerId: 'user-1', status: 'QUEUED',
        jobType: 'CREATE', projectionId: 'proj-1', bullmqJobId: 'bq-1',
      }]),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { cancelJob } = await import('../crosslister-publish');
    const result = await cancelJob({ jobId: 'cj-1' });
    expect(result.success).toBe(true);
  });

  it('rejects cancellation of IN_PROGRESS job', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'cj-1', sellerId: 'user-1', status: 'IN_PROGRESS',
        jobType: 'CREATE', projectionId: 'proj-1', bullmqJobId: null,
      }]),
    });

    const { cancelJob } = await import('../crosslister-publish');
    const result = await cancelJob({ jobId: 'cj-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('in progress');
  });

  it('returns Not found for job owned by different seller', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // no row found (ownership check built into query)
    });

    const { cancelJob } = await import('../crosslister-publish');
    const result = await cancelJob({ jobId: 'cj-other' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('reverts projection status from QUEUED to DRAFT for CREATE jobs', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'cj-1', sellerId: 'user-1', status: 'QUEUED',
        jobType: 'CREATE', projectionId: 'proj-1', bullmqJobId: null,
      }]),
    });
    const setCalls: unknown[] = [];
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockImplementation((vals: unknown) => {
        setCalls.push(vals);
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    });

    const { cancelJob } = await import('../crosslister-publish');
    await cancelJob({ jobId: 'cj-1' });

    const draftRevert = setCalls.find((c) => (c as Record<string, unknown>)?.status === 'DRAFT') as Record<string, unknown> | undefined;
    expect(draftRevert).toBeDefined();
  });

  it('removes BullMQ job from queue when bullmqJobId exists', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'cj-1', sellerId: 'user-1', status: 'QUEUED',
        jobType: 'CREATE', projectionId: 'proj-1', bullmqJobId: 'bq-xyz',
      }]),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { listerPublishQueue } = await import('@/lib/crosslister/queue/lister-queue');
    const { cancelJob } = await import('../crosslister-publish');
    await cancelJob({ jobId: 'cj-1' });
    expect(listerPublishQueue.remove).toHaveBeenCalledWith('bq-xyz');
  });

  it('requires delete CrossJob CASL permission', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { cancelJob } = await import('../crosslister-publish');
    const result = await cancelJob({ jobId: 'cj-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});

// --- getJobQueueStatus ---

describe('getJobQueueStatus', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns queue status counts for authenticated seller', async () => {
    const { getJobQueueStatus } = await import('../crosslister-publish');
    const result = await getJobQueueStatus();
    expect(result.success).toBe(true);
    expect(result.data?.queued).toBe(3);
    expect(result.data?.inProgress).toBe(1);
  });

  it('returns Unauthorized when no session', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ session: null, ability: { can: vi.fn() } });
    const { getJobQueueStatus } = await import('../crosslister-publish');
    const result = await getJobQueueStatus();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('requires read CrossJob CASL permission', async () => {
    const { authorize } = await import('@twicely/casl');
    (authorize as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { getJobQueueStatus } = await import('../crosslister-publish');
    const result = await getJobQueueStatus();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});

// --- delistFromChannel enqueue ---

describe('delistFromChannel — enqueue pattern', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('enqueues DELIST job instead of calling connector inline', async () => {
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
          return Promise.resolve([{ id: 'acct-1', sellerId: 'user-1' }]);
        }
        return Promise.resolve([]);
      }),
    }));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'cj-delist-1' }]),
      }),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { listerPublishQueue } = await import('@/lib/crosslister/queue/lister-queue');
    const { delistFromChannel } = await import('../crosslister-publish');
    const result = await delistFromChannel({ projectionId: 'proj-1' });

    expect(result.success).toBe(true);
    expect(listerPublishQueue.add).toHaveBeenCalledWith(
      expect.stringContaining('delist'),
      expect.objectContaining({ jobType: 'DELIST' }),
      expect.any(Object),
    );
  });
});

// --- updateProjectionOverrides sync enqueue ---

describe('updateProjectionOverrides — sync enqueue', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('enqueues SYNC job when hasPendingSync is true and projection is ACTIVE', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'proj-1', status: 'ACTIVE', syncEnabled: true,
        overridesJson: {}, externalId: 'ext-123',
      }]),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { enqueueSyncJob } = await import('@/lib/crosslister/services/publish-service');
    const { updateProjectionOverrides } = await import('../crosslister-publish');
    await updateProjectionOverrides({ projectionId: 'proj-1', titleOverride: 'New Title' });

    expect(enqueueSyncJob).toHaveBeenCalledWith('proj-1', 'user-1');
  });

  it('does NOT enqueue SYNC job when projection is not ACTIVE', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'proj-1', status: 'QUEUED', syncEnabled: true,
        overridesJson: {}, externalId: null,
      }]),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { enqueueSyncJob } = await import('@/lib/crosslister/services/publish-service');
    const { updateProjectionOverrides } = await import('../crosslister-publish');
    await updateProjectionOverrides({ projectionId: 'proj-1', titleOverride: 'New Title' });

    expect(enqueueSyncJob).not.toHaveBeenCalled();
  });
});
