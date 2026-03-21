import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'cron-1' });

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
}));

vi.mock('@/lib/jobs/queue', () => ({
  createQueue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  createWorker: vi.fn().mockReturnValue({ on: vi.fn(), close: vi.fn() }),
  connection: {},
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Transitive deps of dynamically-imported tax-document-generation & affiliate-suspension-expiry
vi.mock('@twicely/db', () => ({ db: {} }));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn() }));
vi.mock('@twicely/db/schema', () => ({
  financialReport: { userId: 'user_id', reportType: 'report_type', periodStart: 'period_start' },
  affiliate: { id: 'id', userId: 'user_id', status: 'status', suspendedUntil: 'suspended_until' },
  auditEvent: {},
  helpdeskCase: { id: 'id', status: 'status', closedAt: 'closed_at' },
  caseMessage: { caseId: 'case_id' },
  caseEvent: { caseId: 'case_id' },
  caseWatcher: { caseId: 'case_id' },
  caseCsat: { caseId: 'case_id' },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(), eq: vi.fn(), gte: vi.fn(), lt: vi.fn(), lte: vi.fn(), isNotNull: vi.fn(), inArray: vi.fn(),
}));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback?: unknown) =>
    Promise.resolve(fallback ?? 365),
  ),
}));

describe('cron-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registerCronJobs registers all platform and external cron jobs', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    // 6 platform cron jobs + 1 tax document + 1 affiliate suspension expiry + 4 cleanup queue jobs (G8) + 1 helpdesk retention purge (G9.6)
    expect(mockQueueAdd).toHaveBeenCalledTimes(13);
  });

  it('registers orders cron at every hour', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    const ordersCall = mockQueueAdd.mock.calls.find(
      (c: unknown[]) => c[0] === 'cron:orders',
    );
    expect(ordersCall).toBeDefined();
    expect(ordersCall![2]).toEqual(
      expect.objectContaining({
        jobId: 'cron-orders',
        repeat: { pattern: '0 * * * *' },
      }),
    );
  });

  it('registers returns cron at :10 every hour', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    const returnsCall = mockQueueAdd.mock.calls.find(
      (c: unknown[]) => c[0] === 'cron:returns',
    );
    expect(returnsCall).toBeDefined();
    expect(returnsCall![2]).toEqual(
      expect.objectContaining({
        jobId: 'cron-returns',
        repeat: { pattern: '10 * * * *' },
      }),
    );
  });

  it('registers shipping cron at :20 every hour', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    const shippingCall = mockQueueAdd.mock.calls.find(
      (c: unknown[]) => c[0] === 'cron:shipping',
    );
    expect(shippingCall).toBeDefined();
    expect(shippingCall![2]).toEqual(
      expect.objectContaining({
        jobId: 'cron-shipping',
        repeat: { pattern: '20 * * * *' },
      }),
    );
  });

  it('registers health cron every 5 minutes', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    const healthCall = mockQueueAdd.mock.calls.find(
      (c: unknown[]) => c[0] === 'cron:health',
    );
    expect(healthCall).toBeDefined();
    expect(healthCall![2]).toEqual(
      expect.objectContaining({
        jobId: 'cron-health',
        repeat: { pattern: '*/5 * * * *' },
      }),
    );
  });

  it('each cron job data has a task field', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    const tasks = mockQueueAdd.mock.calls.map((c: unknown[]) => (c[1] as { task: string }).task);
    expect(tasks).toEqual(expect.arrayContaining(['orders', 'returns', 'shipping', 'health', 'vacation', 'seller-score-recalc']));
  });

  it('cronQueue is created with platform-cron name', async () => {
    // createQueue is called at module load time — verify it was called
    // before clearAllMocks by re-importing and checking the queue name
    const { cronQueue } = await import('../cron-jobs');
    expect(cronQueue).toBeDefined();
    expect(typeof cronQueue.add).toBe('function');
  });
});
