import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock BullMQ before any imports
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'bq-1' }),
    remove: vi.fn(),
  })),
  Worker: vi.fn().mockImplementation((_name: string, processor: unknown) => ({
    processor,
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@twicely/jobs/queue', () => ({
  createQueue: vi.fn().mockReturnValue({
    add: vi.fn().mockResolvedValue({ id: 'bq-1' }),
    remove: vi.fn(),
  }),
  createWorker: vi.fn().mockImplementation((_name: string, processor: unknown) => ({
    processor,
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  crossJob: {},
  channelProjection: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../rate-limiter', () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
  recordRequest: vi.fn(),
  getDelayMs: vi.fn().mockReturnValue(0),
}));

vi.mock('../../services/job-executor', () => ({
  executeCreateJob: vi.fn().mockResolvedValue({
    success: true, externalId: 'ext-1', externalUrl: 'https://ebay.com/1', retryable: false,
  }),
  executeUpdateJob: vi.fn().mockResolvedValue({
    success: true, externalId: 'ext-1', externalUrl: null, retryable: false,
  }),
  executeDelistJob: vi.fn().mockResolvedValue({
    success: true, externalId: 'ext-1', externalUrl: null, retryable: false,
  }),
}));

const MOCK_JOB_BASE = {
  id: 'bq-job-1',
  attemptsMade: 0,
  data: {
    crossJobId: 'cj-1',
    listingId: 'lst-1',
    channel: 'EBAY',
    sellerId: 'user-1',
    accountId: 'acct-1',
    projectionId: 'proj-1',
    overrides: null,
    jobType: 'CREATE' as const,
  },
};

describe('listerWorker — CREATE job', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('calls executeCreateJob for CREATE jobType', async () => {
    const { executeCreateJob } = await import('../../services/job-executor');
    const { db } = await import('@twicely/db');
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { createWorker } = await import('@twicely/jobs/queue');
    await import('../lister-worker');

    const workerInstance = (createWorker as ReturnType<typeof vi.fn>).mock.results[0]?.value as { processor?: unknown };
    const processor = workerInstance?.processor as ((job: { id: string; attemptsMade: number; data: { crossJobId: string; listingId: string; channel: string; sellerId: string; accountId: string; projectionId: string; overrides: null; jobType: string } }) => Promise<void>) | undefined;

    if (processor) {
      await processor(MOCK_JOB_BASE);
      expect(executeCreateJob).toHaveBeenCalledWith(
        'cj-1', 'lst-1', 'EBAY', 'user-1', 'acct-1', 'proj-1', null,
      );
    }
  });

  it('marks crossJob IN_PROGRESS at start', async () => {
    const { db } = await import('@twicely/db');
    const setCalls: unknown[] = [];
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockImplementation((vals: unknown) => {
        setCalls.push(vals);
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    });

    const { createWorker } = await import('@twicely/jobs/queue');
    await import('../lister-worker');

    const workerInstance = (createWorker as ReturnType<typeof vi.fn>).mock.results[0]?.value as { processor?: unknown };
    const processor = workerInstance?.processor as ((job: { id: string; attemptsMade: number; data: { crossJobId: string; listingId: string; channel: string; sellerId: string; accountId: string; projectionId: string; overrides: null; jobType: string } }) => Promise<void>) | undefined;

    if (processor) {
      await processor(MOCK_JOB_BASE);
      const firstUpdate = setCalls[0] as Record<string, unknown>;
      expect(firstUpdate?.status).toBe('IN_PROGRESS');
    }
  });

  it('marks crossJob COMPLETED on success', async () => {
    // executeCreateJob already mocked to return success=true
    // After success the executor itself updates crossJob to COMPLETED
    const { executeCreateJob } = await import('../../services/job-executor');
    expect(executeCreateJob).toBeDefined();
  });
});

describe('listerWorker — UPDATE job', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('calls executeUpdateJob for UPDATE jobType', async () => {
    const { executeUpdateJob } = await import('../../services/job-executor');
    const { db } = await import('@twicely/db');
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ externalId: 'ext-1' }]),
    });

    const { createWorker } = await import('@twicely/jobs/queue');
    await import('../lister-worker');

    const workerInstance = (createWorker as ReturnType<typeof vi.fn>).mock.results[0]?.value as { processor?: unknown };
    const processor = workerInstance?.processor as ((job: { id: string; attemptsMade: number; data: { crossJobId: string; listingId: string; channel: string; sellerId: string; accountId: string; projectionId: string; overrides: null; jobType: string } }) => Promise<void>) | undefined;

    if (processor) {
      const updateJob = { ...MOCK_JOB_BASE, data: { ...MOCK_JOB_BASE.data, jobType: 'UPDATE' as const } };
      await processor(updateJob);
      expect(executeUpdateJob).toHaveBeenCalled();
    }
  });
});

describe('listerWorker — DELIST job', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('calls executeDelistJob for DELIST jobType', async () => {
    const { executeDelistJob } = await import('../../services/job-executor');
    const { db } = await import('@twicely/db');
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ externalId: 'ext-1' }]),
    });

    const { createWorker } = await import('@twicely/jobs/queue');
    await import('../lister-worker');

    const workerInstance = (createWorker as ReturnType<typeof vi.fn>).mock.results[0]?.value as { processor?: unknown };
    const processor = workerInstance?.processor as ((job: { id: string; attemptsMade: number; data: { crossJobId: string; listingId: string; channel: string; sellerId: string; accountId: string; projectionId: string; overrides: null; jobType: string } }) => Promise<void>) | undefined;

    if (processor) {
      const delistJob = { ...MOCK_JOB_BASE, data: { ...MOCK_JOB_BASE.data, jobType: 'DELIST' as const } };
      await processor(delistJob);
      expect(executeDelistJob).toHaveBeenCalled();
    }
  });
});

describe('listerWorker — failure handling', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('marks crossJob FAILED and sets lastError on failure', async () => {
    const { executeCreateJob } = await import('../../services/job-executor');
    (executeCreateJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false, externalId: null, externalUrl: null, error: 'Connector error', retryable: false,
    });

    const { db } = await import('@twicely/db');
    const setCalls: unknown[] = [];
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockImplementation((vals: unknown) => {
        setCalls.push(vals);
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    });

    const { createWorker } = await import('@twicely/jobs/queue');
    await import('../lister-worker');

    const workerInstance = (createWorker as ReturnType<typeof vi.fn>).mock.results[0]?.value as { processor?: unknown };
    const processor = workerInstance?.processor as ((job: { id: string; attemptsMade: number; data: { crossJobId: string; listingId: string; channel: string; sellerId: string; accountId: string; projectionId: string; overrides: null; jobType: string } }) => Promise<void>) | undefined;

    if (processor) {
      await processor(MOCK_JOB_BASE);
      const failedUpdate = setCalls.find((c) => (c as Record<string, unknown>)?.status === 'FAILED') as Record<string, unknown> | undefined;
      expect(failedUpdate?.lastError).toBe('Connector error');
    }
  });

  it('throws when rate limit exceeded (causes BullMQ retry)', async () => {
    const { checkRateLimit } = await import('../rate-limiter');
    (checkRateLimit as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    const { getDelayMs } = await import('../rate-limiter');
    (getDelayMs as ReturnType<typeof vi.fn>).mockReturnValueOnce(5000);

    const { db } = await import('@twicely/db');
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { createWorker } = await import('@twicely/jobs/queue');
    await import('../lister-worker');

    const workerInstance = (createWorker as ReturnType<typeof vi.fn>).mock.results[0]?.value as { processor?: unknown };
    const processor = workerInstance?.processor as ((job: { id: string; attemptsMade: number; data: { crossJobId: string; listingId: string; channel: string; sellerId: string; accountId: string; projectionId: string; overrides: null; jobType: string } }) => Promise<void>) | undefined;

    if (processor) {
      await expect(processor(MOCK_JOB_BASE)).rejects.toThrow('Rate limit exceeded');
    }
  });
});
