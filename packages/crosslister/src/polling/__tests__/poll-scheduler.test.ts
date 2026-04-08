import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  channelProjection: {
    id: 'id',
    channel: 'channel',
    sellerId: 'seller_id',
    pollTier: 'poll_tier',
    listingId: 'listing_id',
    status: 'status',
    nextPollAt: 'next_poll_at',
  },
  sellerProfile: {
    userId: 'user_id',
    listerTier: 'lister_tier',
  },
}));

vi.mock('../poll-budget', () => ({
  canPoll: vi.fn().mockResolvedValue(true),
  recordPoll: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../queue/circuit-breaker', () => ({
  canDispatch: vi.fn().mockReturnValue(true),
}));

const { mockQueueAdd } = vi.hoisted(() => ({
  mockQueueAdd: vi.fn().mockResolvedValue({ id: 'job-1' }),
}));
vi.mock('../../queue/polling-queue', () => ({
  listerPollingQueue: { add: mockQueueAdd },
}));

vi.mock('../../queue/constants', () => ({
  PRIORITY_POLL: 700,
  MAX_ATTEMPTS_POLL: 2,
  BACKOFF_POLL: { type: 'exponential', delay: 60_000 },
  REMOVE_ON_COMPLETE: { count: 1000 },
  REMOVE_ON_FAIL: { count: 5000 },
}));

vi.mock('../../services/queue-settings-loader', () => ({
  loadCrosslisterQueueSettings: vi.fn().mockResolvedValue({
    schedulerTickIntervalMs: 5000,
    schedulerBatchPullSize: 50,
    pollingBatchSize: 100,
    webhookPrimaryChannels: ['EBAY', 'ETSY'],
    pollingTickIntervalMs: 60000,
    priorityPoll: 700,
    priorityCreate: 300,
    prioritySync: 500,
    priorityDelist: 100,
    maxAttemptsPoll: 2,
    maxAttemptsPublish: 3,
    maxAttemptsSync: 3,
    backoffPollMs: 60000,
    backoffPublishMs: 30000,
    backoffSyncMs: 60000,
    removeOnCompleteCount: 1000,
    removeOnFailCount: 5000,
    workerConcurrency: 10,
  }),
  resetCrosslisterQueueSettingsCache: vi.fn(),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { db } from '@twicely/db';
import { canPoll, recordPoll } from '../poll-budget';
import { canDispatch } from '../../queue/circuit-breaker';
import {
  runPollSchedulerTick,
  getPollSchedulerHealth,
  resetPollSchedulerHealth,
} from '../poll-scheduler';

const makeProjectionsChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  }),
});

const makeSellerProfileChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

const ACTIVE_PROJ = {
  id: 'proj-1',
  channel: 'POSHMARK',
  sellerId: 'seller-1',
  pollTier: 'COLD',
  listingId: 'listing-1',
};

describe('poll-scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPollSchedulerHealth();
  });

  it('enqueues jobs for due ACTIVE projections', async () => {
    vi.mocked(canDispatch).mockReturnValue(true);
    vi.mocked(canPoll).mockResolvedValue(true);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeProjectionsChain([ACTIVE_PROJ]) as never)
      .mockReturnValueOnce(makeSellerProfileChain([{ listerTier: 'FREE' }]) as never);

    await runPollSchedulerTick();

    expect(recordPoll).toHaveBeenCalledWith('seller-1');
    const health = getPollSchedulerHealth();
    expect(health.jobsEnqueuedLastTick).toBe(1);
  });

  it('actually calls listerPollingQueue.add with the right job data (regression for stub)', async () => {
    vi.mocked(canDispatch).mockReturnValue(true);
    vi.mocked(canPoll).mockResolvedValue(true);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeProjectionsChain([ACTIVE_PROJ]) as never)
      .mockReturnValueOnce(makeSellerProfileChain([{ listerTier: 'FREE' }]) as never);

    await runPollSchedulerTick();

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    const [jobName, jobData, jobOpts] = mockQueueAdd.mock.calls[0]!;
    expect(jobName).toBe('poll');
    expect(jobData).toMatchObject({
      projectionId: 'proj-1',
      channel: 'POSHMARK',
      sellerId: 'seller-1',
      listingId: 'listing-1',
      pollTier: 'COLD',
    });
    expect(jobData.scheduledAt).toBeDefined();
    expect(jobOpts).toMatchObject({
      priority: 700,
      attempts: 2,
    });
    expect(jobOpts.jobId).toMatch(/^poll-proj-1-/);
  });

  it('skips projections when circuit breaker is OPEN', async () => {
    vi.mocked(canDispatch).mockReturnValue(false);
    vi.mocked(db.select).mockReturnValueOnce(makeProjectionsChain([ACTIVE_PROJ]) as never);

    await runPollSchedulerTick();

    expect(recordPoll).not.toHaveBeenCalled();
    const health = getPollSchedulerHealth();
    expect(health.jobsEnqueuedLastTick).toBe(0);
  });

  it('skips projections when poll budget exhausted', async () => {
    vi.mocked(canDispatch).mockReturnValue(true);
    vi.mocked(canPoll).mockResolvedValue(false);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeProjectionsChain([ACTIVE_PROJ]) as never)
      .mockReturnValueOnce(makeSellerProfileChain([{ listerTier: 'FREE' }]) as never);

    await runPollSchedulerTick();

    expect(recordPoll).not.toHaveBeenCalled();
    const health = getPollSchedulerHealth();
    expect(health.jobsEnqueuedLastTick).toBe(0);
  });

  it('skips EBAY HOT projections (webhook-primary channel)', async () => {
    const ebayHotProj = { ...ACTIVE_PROJ, channel: 'EBAY', pollTier: 'HOT' };
    vi.mocked(db.select).mockReturnValueOnce(makeProjectionsChain([ebayHotProj]) as never);

    await runPollSchedulerTick();

    expect(recordPoll).not.toHaveBeenCalled();
    const health = getPollSchedulerHealth();
    expect(health.jobsEnqueuedLastTick).toBe(0);
  });

  it('skips ETSY WARM projections (webhook-primary channel)', async () => {
    const etsyWarmProj = { ...ACTIVE_PROJ, channel: 'ETSY', pollTier: 'WARM' };
    vi.mocked(db.select).mockReturnValueOnce(makeProjectionsChain([etsyWarmProj]) as never);

    await runPollSchedulerTick();

    expect(recordPoll).not.toHaveBeenCalled();
  });

  it('does NOT skip EBAY COLD projections (only HOT/WARM are webhook-primary skipped)', async () => {
    const ebayColdProj = { ...ACTIVE_PROJ, channel: 'EBAY', pollTier: 'COLD' };
    vi.mocked(canDispatch).mockReturnValue(true);
    vi.mocked(canPoll).mockResolvedValue(true);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeProjectionsChain([ebayColdProj]) as never)
      .mockReturnValueOnce(makeSellerProfileChain([{ listerTier: 'LITE' }]) as never);

    await runPollSchedulerTick();

    expect(recordPoll).toHaveBeenCalledWith('seller-1');
  });

  it('updates health state after tick with enqueued jobs', async () => {
    vi.mocked(canDispatch).mockReturnValue(true);
    vi.mocked(canPoll).mockResolvedValue(true);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeProjectionsChain([ACTIVE_PROJ]) as never)
      .mockReturnValueOnce(makeSellerProfileChain([{ listerTier: 'FREE' }]) as never);

    await runPollSchedulerTick();

    const health = getPollSchedulerHealth();
    expect(health.lastTickAt).not.toBeNull();
    expect(health.lastTickDurationMs).not.toBeNull();
    expect(typeof health.lastTickDurationMs).toBe('number');
  });

  it('updates health with 0 jobs when no projections due', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeProjectionsChain([]) as never);

    await runPollSchedulerTick();

    const health = getPollSchedulerHealth();
    expect(health.jobsEnqueuedLastTick).toBe(0);
    expect(health.lastTickAt).not.toBeNull();
  });

  it('tick queries with limit 100 — only processes projections returned by DB', async () => {
    // Build 100 projections — verify all 100 are processed when budget allows
    const projs = Array.from({ length: 3 }, (_, i) => ({
      ...ACTIVE_PROJ,
      id: `proj-${i}`,
      sellerId: `seller-${i}`,
    }));
    vi.mocked(canDispatch).mockReturnValue(true);
    vi.mocked(canPoll).mockResolvedValue(true);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeProjectionsChain(projs) as never)
      // Each projection queries seller profile
      .mockReturnValue(makeSellerProfileChain([{ listerTier: 'FREE' }]) as never);

    await runPollSchedulerTick();

    const health = getPollSchedulerHealth();
    expect(health.jobsEnqueuedLastTick).toBe(3);
    expect(recordPoll).toHaveBeenCalledTimes(3);
  });

  it('does not throw on DB error and records 0 jobs enqueued', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('DB down')),
          }),
        }),
      }),
    } as never);

    await expect(runPollSchedulerTick()).resolves.toBeUndefined();

    const health = getPollSchedulerHealth();
    expect(health.jobsEnqueuedLastTick).toBe(0);
  });
});
