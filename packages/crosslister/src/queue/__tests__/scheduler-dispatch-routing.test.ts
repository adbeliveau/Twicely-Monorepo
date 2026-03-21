import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPublishAdd = vi.fn().mockResolvedValue({ id: 'pub-1' });
const mockAutomationAdd = vi.fn().mockResolvedValue({ id: 'auto-1' });

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'q-1' }),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@/lib/jobs/queue', () => ({
  createQueue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'q-1' }),
  })),
  createWorker: vi.fn().mockReturnValue({ on: vi.fn(), close: vi.fn() }),
  connection: {},
}));

vi.mock('../lister-queue', () => ({
  listerPublishQueue: { add: mockPublishAdd },
}));

vi.mock('../automation-queue', () => ({
  automationQueue: { add: mockAutomationAdd },
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
  getCBSettings: vi.fn().mockResolvedValue({ recoveryWindowMs: 60_000 }),
}));

vi.mock('../tier-weight', () => ({
  effectiveQuota: vi.fn().mockReturnValue(10),
  loadTierWeights: vi.fn().mockResolvedValue(undefined),
}));

/** Pending job rows to return from db.select chain — set per test. */
let pendingJobRows: unknown[] = [];

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => Promise.resolve(pendingJobRows)),
            }),
          }),
        }),
      }),
    })),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  crossJob: {
    id: 'id', sellerId: 'sellerId', accountId: 'accountId', priority: 'priority',
    idempotencyKey: 'idempotencyKey', payload: 'payload', jobType: 'jobType',
    status: 'status', scheduledFor: 'scheduledFor',
  },
  sellerProfile: { userId: 'userId', listerTier: 'listerTier' },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('scheduler-loop dispatch routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendingJobRows = [];
  });

  it('routes jobs WITH automationEngine to automationQueue', async () => {
    pendingJobRows = [{
      id: 'job-1',
      sellerId: 'user-1',
      accountId: 'acct-1',
      priority: 500,
      idempotencyKey: 'idem-1',
      jobType: 'RELIST',
      listerTier: 'LITE',
      payload: {
        automationEngine: 'AUTO_RELIST',
        listingId: 'lst-1',
        channel: 'EBAY',
        projectionId: 'proj-1',
      },
    }];

    const { runTick } = await import('../scheduler-loop');
    await runTick();

    expect(mockAutomationAdd).toHaveBeenCalledTimes(1);
    expect(mockPublishAdd).not.toHaveBeenCalled();

    const [jobName, data] = mockAutomationAdd.mock.calls[0] as [string, Record<string, unknown>];
    expect(jobName).toBe('AUTO_RELIST:job-1');
    expect(data.automationEngine).toBe('AUTO_RELIST');
    expect(data.crossJobId).toBe('job-1');
  });

  it('routes jobs WITHOUT automationEngine to listerPublishQueue', async () => {
    pendingJobRows = [{
      id: 'job-2',
      sellerId: 'user-2',
      accountId: 'acct-2',
      priority: 300,
      idempotencyKey: 'idem-2',
      jobType: 'CREATE',
      listerTier: 'PRO',
      payload: {
        listingId: 'lst-2',
        channel: 'POSHMARK',
        projectionId: 'proj-2',
        overrides: null,
      },
    }];

    const { runTick } = await import('../scheduler-loop');
    await runTick();

    expect(mockPublishAdd).toHaveBeenCalledTimes(1);
    expect(mockAutomationAdd).not.toHaveBeenCalled();

    const [jobName] = mockPublishAdd.mock.calls[0] as [string];
    expect(jobName).toBe('CREATE:job-2');
  });

  it('passes automationEngine as typed field in job data', async () => {
    pendingJobRows = [{
      id: 'job-3',
      sellerId: 'user-3',
      accountId: 'acct-3',
      priority: 500,
      idempotencyKey: 'idem-3',
      jobType: 'UPDATE',
      listerTier: 'LITE',
      payload: {
        automationEngine: 'PRICE_DROP',
        listingId: 'lst-3',
        channel: 'MERCARI',
        projectionId: 'proj-3',
      },
    }];

    const { runTick } = await import('../scheduler-loop');
    await runTick();

    const [, data] = mockAutomationAdd.mock.calls[0] as [string, Record<string, unknown>];
    expect(data.automationEngine).toBe('PRICE_DROP');
    expect(data.jobType).toBe('UPDATE');
    expect(data.channel).toBe('MERCARI');
  });
});
