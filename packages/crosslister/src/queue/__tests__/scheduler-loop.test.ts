import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startSchedulerLoop,
  stopSchedulerLoop,
  isSchedulerRunning,
  getSchedulerHealth,
  runTick,
} from '../scheduler-loop';

// Mock all dependencies
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  crossJob: { id: 'id', sellerId: 'seller_id', accountId: 'account_id', priority: 'priority', idempotencyKey: 'idempotency_key', payload: 'payload', jobType: 'job_type', status: 'status', scheduledFor: 'scheduled_for', updatedAt: 'updated_at' },
  sellerProfile: { userId: 'user_id', listerTier: 'lister_tier' },
  crosslisterAccount: {},
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(10),
}));

vi.mock('../rate-limiter', () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
  recordRequest: vi.fn(),
}));

vi.mock('../fairness-quota', () => ({
  hasQuota: vi.fn().mockReturnValue(true),
  recordDispatch: vi.fn(),
  getMaxJobsPerSellerPerMinute: vi.fn().mockResolvedValue(10),
}));

vi.mock('../circuit-breaker', () => ({
  canDispatch: vi.fn().mockReturnValue(true),
  getCBSettings: vi.fn().mockResolvedValue({
    failureThreshold: 5,
    recoveryWindowMs: 300000,
    halfOpenSuccesses: 2,
  }),
}));

vi.mock('../tier-weight', () => ({
  effectiveQuota: vi.fn().mockReturnValue(10),
  loadTierWeights: vi.fn().mockResolvedValue({ NONE: 0.5, FREE: 1.0, LITE: 1.5, PRO: 3.0 }),
}));

vi.mock('../lister-queue', () => ({
  listerPublishQueue: {
    add: vi.fn().mockResolvedValue({ id: 'bull-1' }),
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('scheduler-loop', () => {
  beforeEach(() => {
    stopSchedulerLoop();
    vi.clearAllMocks();
  });

  it('startSchedulerLoop starts the interval', () => {
    expect(isSchedulerRunning()).toBe(false);
    startSchedulerLoop();
    expect(isSchedulerRunning()).toBe(true);
    stopSchedulerLoop();
  });

  it('stopSchedulerLoop clears the interval', () => {
    startSchedulerLoop();
    expect(isSchedulerRunning()).toBe(true);
    stopSchedulerLoop();
    expect(isSchedulerRunning()).toBe(false);
  });

  it('startSchedulerLoop is idempotent', () => {
    startSchedulerLoop();
    startSchedulerLoop(); // should not create second interval
    expect(isSchedulerRunning()).toBe(true);
    stopSchedulerLoop();
    expect(isSchedulerRunning()).toBe(false);
  });

  it('runTick skips job when rate limit exhausted', async () => {
    const { checkRateLimit } = await import('../rate-limiter');
    const { db } = await import('@/lib/db');
    (checkRateLimit as ReturnType<typeof vi.fn>).mockReturnValue(false);

    // Return one pending job
    const mockJob = {
      id: 'job-1', sellerId: 'seller-1', accountId: 'acc-1',
      priority: 300, idempotencyKey: 'key-1',
      payload: { channel: 'EBAY', listingId: 'l-1', projectionId: 'p-1' },
      jobType: 'CREATE', listerTier: 'FREE',
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockJob]),
            }),
          }),
        }),
      }),
    });

    const { listerPublishQueue } = await import('../lister-queue');
    await runTick();
    expect(listerPublishQueue.add).not.toHaveBeenCalled();
  });

  it('runTick skips job when fairness quota exhausted', async () => {
    const { checkRateLimit } = await import('../rate-limiter');
    const { hasQuota } = await import('../fairness-quota');
    const { db } = await import('@/lib/db');
    (checkRateLimit as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (hasQuota as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const mockJob = {
      id: 'job-1', sellerId: 'seller-1', accountId: 'acc-1',
      priority: 300, idempotencyKey: 'key-1',
      payload: { channel: 'EBAY', listingId: 'l-1', projectionId: 'p-1' },
      jobType: 'CREATE', listerTier: 'FREE',
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockJob]),
            }),
          }),
        }),
      }),
    });

    const { listerPublishQueue } = await import('../lister-queue');
    await runTick();
    expect(listerPublishQueue.add).not.toHaveBeenCalled();
  });

  it('runTick skips job when circuit breaker OPEN', async () => {
    const { checkRateLimit } = await import('../rate-limiter');
    const { hasQuota } = await import('../fairness-quota');
    const { canDispatch } = await import('../circuit-breaker');
    const { db } = await import('@/lib/db');
    (checkRateLimit as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (hasQuota as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (canDispatch as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const mockJob = {
      id: 'job-1', sellerId: 'seller-1', accountId: 'acc-1',
      priority: 300, idempotencyKey: 'key-1',
      payload: { channel: 'EBAY', listingId: 'l-1', projectionId: 'p-1' },
      jobType: 'CREATE', listerTier: 'FREE',
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockJob]),
            }),
          }),
        }),
      }),
    });

    const { listerPublishQueue } = await import('../lister-queue');
    await runTick();
    expect(listerPublishQueue.add).not.toHaveBeenCalled();
  });

  it('runTick dispatches job when all gates pass', async () => {
    const { checkRateLimit } = await import('../rate-limiter');
    const { hasQuota } = await import('../fairness-quota');
    const { canDispatch } = await import('../circuit-breaker');
    const { db } = await import('@/lib/db');
    (checkRateLimit as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (hasQuota as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (canDispatch as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const mockJob = {
      id: 'job-1', sellerId: 'seller-1', accountId: 'acc-1',
      priority: 300, idempotencyKey: 'key-1',
      payload: { channel: 'EBAY', listingId: 'l-1', projectionId: 'p-1' },
      jobType: 'CREATE', listerTier: 'FREE',
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockJob]),
            }),
          }),
        }),
      }),
    });

    const { listerPublishQueue } = await import('../lister-queue');
    await runTick();
    expect(listerPublishQueue.add).toHaveBeenCalledTimes(1);
  });

  it('runTick calls recordDispatch after successful dispatch', async () => {
    const { checkRateLimit } = await import('../rate-limiter');
    const { hasQuota, recordDispatch } = await import('../fairness-quota');
    const { canDispatch } = await import('../circuit-breaker');
    const { db } = await import('@/lib/db');
    (checkRateLimit as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (hasQuota as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (canDispatch as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const mockJob = {
      id: 'job-1', sellerId: 'seller-1', accountId: 'acc-1',
      priority: 300, idempotencyKey: 'key-1',
      payload: { channel: 'EBAY', listingId: 'l-1', projectionId: 'p-1' },
      jobType: 'CREATE', listerTier: 'FREE',
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockJob]),
            }),
          }),
        }),
      }),
    });

    await runTick();
    expect(recordDispatch).toHaveBeenCalledWith('seller-1');
  });

  it('runTick does not throw on DB error', async () => {
    const { db } = await import('@/lib/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockRejectedValue(new Error('DB down')),
            }),
          }),
        }),
      }),
    });

    // Should not throw
    await expect(runTick()).resolves.toBeUndefined();
  });

  it('getSchedulerHealth returns correct state', () => {
    const health = getSchedulerHealth();
    expect(health.running).toBe(false);
    // lastTickAt may be set by prior runTick calls in this suite
    expect(typeof health.lastTickAt === 'string' || health.lastTickAt === null).toBe(true);
  });

  it('getSchedulerHealth shows running after start', () => {
    startSchedulerLoop();
    const health = getSchedulerHealth();
    expect(health.running).toBe(true);
    stopSchedulerLoop();
  });
});
