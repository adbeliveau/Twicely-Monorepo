import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the BullMQ Queue before any imports
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation((name: string) => ({
    name,
    add: vi.fn().mockResolvedValue({ id: 'bullmq-job-1' }),
    remove: vi.fn().mockResolvedValue(1),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@/lib/jobs/queue', () => ({
  createQueue: vi.fn().mockImplementation((name: string) => ({
    name,
    add: vi.fn().mockResolvedValue({ id: 'bullmq-job-1' }),
    remove: vi.fn().mockResolvedValue(1),
  })),
  createWorker: vi.fn().mockReturnValue({
    on: vi.fn(),
    close: vi.fn(),
  }),
}));

describe('listerPublishQueue', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('is created with name lister:publish', async () => {
    const { createQueue } = await import('@/lib/jobs/queue');
    await import('../lister-queue');
    expect(createQueue).toHaveBeenCalledWith('lister-publish');
  });

  it('exports listerPublishQueue with add method', async () => {
    const { listerPublishQueue } = await import('../lister-queue');
    expect(listerPublishQueue).toBeDefined();
    expect(typeof listerPublishQueue.add).toBe('function');
  });

  it('exports ListerPublishJobData-shaped queue accepting correct job type', async () => {
    const { listerPublishQueue } = await import('../lister-queue');
    const jobData = {
      crossJobId: 'job-1',
      listingId: 'lst-1',
      channel: 'EBAY',
      sellerId: 'user-1',
      accountId: 'acct-1',
      projectionId: 'proj-1',
      overrides: null,
      jobType: 'CREATE' as const,
    };
    await listerPublishQueue.add('test-job', jobData, { priority: 300, attempts: 3 });
    expect(listerPublishQueue.add).toHaveBeenCalledWith('test-job', jobData, expect.objectContaining({ priority: 300, attempts: 3 }));
  });

  it('constants define correct priority values', async () => {
    const { PRIORITY_CREATE, PRIORITY_SYNC, PRIORITY_DELIST } = await import('../constants');
    expect(PRIORITY_CREATE).toBe(300);
    expect(PRIORITY_SYNC).toBe(500);
    expect(PRIORITY_DELIST).toBe(100);
  });

  it('backoff configs use exponential type', async () => {
    const { BACKOFF_PUBLISH, BACKOFF_SYNC } = await import('../constants');
    expect(BACKOFF_PUBLISH.type).toBe('exponential');
    expect(BACKOFF_SYNC.type).toBe('exponential');
  });

  it('BACKOFF_PUBLISH delay is 30_000ms', async () => {
    const { BACKOFF_PUBLISH } = await import('../constants');
    expect(BACKOFF_PUBLISH.delay).toBe(30_000);
  });

  it('BACKOFF_SYNC delay is 60_000ms', async () => {
    const { BACKOFF_SYNC } = await import('../constants');
    expect(BACKOFF_SYNC.delay).toBe(60_000);
  });
});
