/**
 * Tests for affiliate-payout-cron.ts
 * BullMQ queue registration and processAffiliatePayouts() orchestration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock fns ──────────────────────────────────────────────────────────

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'job-test-001' }));
const mockWorkerClose = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({ add: mockQueueAdd }),
  createWorker: vi.fn().mockReturnValue({ close: mockWorkerClose }),
}));

vi.mock('@/lib/affiliate/commission-graduation', () => ({
  graduateCommissions: vi.fn().mockResolvedValue({ graduatedCount: 3, totalCents: 1500 }),
}));

vi.mock('@/lib/affiliate/affiliate-payout-service', () => ({
  executeAffiliatePayouts: vi.fn().mockResolvedValue({
    payoutCount: 2,
    totalPaidCents: 8000,
    failedCount: 0,
  }),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('affiliatePayoutQueue — queue name', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queue is created with hyphenated name (no colons)', async () => {
    const { createQueue } = await import('../queue');
    const { affiliatePayoutQueue } = await import('../affiliate-payout-cron');

    expect(createQueue).toHaveBeenCalledWith('affiliate-payout');
    expect(affiliatePayoutQueue).toBeDefined();
    expect(typeof affiliatePayoutQueue.add).toBe('function');
  });
});

describe('registerAffiliatePayoutJob — cron registration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers the monthly job with the correct cron schedule', async () => {
    const { registerAffiliatePayoutJob } = await import('../affiliate-payout-cron');
    await registerAffiliatePayoutJob();

    expect(mockQueueAdd).toHaveBeenCalledOnce();
    const opts = mockQueueAdd.mock.calls[0]?.[2] as Record<string, unknown>;
    const repeat = opts['repeat'] as Record<string, unknown>;
    expect(repeat['pattern']).toBe('0 6 15 * *');
  });

  it('uses a stable jobId to prevent duplicate cron registrations', async () => {
    const { registerAffiliatePayoutJob } = await import('../affiliate-payout-cron');
    await registerAffiliatePayoutJob();

    const opts = mockQueueAdd.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(opts['jobId']).toBe('affiliate-payout-monthly');
  });

  it('registers with removeOnComplete: true', async () => {
    const { registerAffiliatePayoutJob } = await import('../affiliate-payout-cron');
    await registerAffiliatePayoutJob();

    const opts = mockQueueAdd.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(opts['removeOnComplete']).toBe(true);
  });

  it('includes triggeredAt ISO string in job data', async () => {
    const { registerAffiliatePayoutJob } = await import('../affiliate-payout-cron');
    await registerAffiliatePayoutJob();

    const data = mockQueueAdd.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(typeof data['triggeredAt']).toBe('string');
    // Validate it is ISO-parseable
    const parsed = new Date(data['triggeredAt'] as string);
    expect(parsed.toISOString()).toBe(data['triggeredAt']);
  });

  it('job name is affiliate-payout-monthly', async () => {
    const { registerAffiliatePayoutJob } = await import('../affiliate-payout-cron');
    await registerAffiliatePayoutJob();

    const jobName = mockQueueAdd.mock.calls[0]?.[0] as string;
    expect(jobName).toBe('affiliate-payout-monthly');
  });
});

describe('processAffiliatePayouts — orchestration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls graduateCommissions before executeAffiliatePayouts', async () => {
    const { graduateCommissions } = await import('@/lib/affiliate/commission-graduation');
    const { executeAffiliatePayouts } = await import('@/lib/affiliate/affiliate-payout-service');
    const { processAffiliatePayouts } = await import('../affiliate-payout-cron');

    await processAffiliatePayouts();

    expect(graduateCommissions).toHaveBeenCalledOnce();
    expect(executeAffiliatePayouts).toHaveBeenCalledOnce();
  });

  it('calls executeAffiliatePayouts after graduation completes', async () => {
    const { graduateCommissions } = await import('@/lib/affiliate/commission-graduation');
    const { executeAffiliatePayouts } = await import('@/lib/affiliate/affiliate-payout-service');
    const { processAffiliatePayouts } = await import('../affiliate-payout-cron');

    const callOrder: string[] = [];
    vi.mocked(graduateCommissions).mockImplementation(async () => {
      callOrder.push('graduate');
      return { graduatedCount: 0, totalCents: 0 };
    });
    vi.mocked(executeAffiliatePayouts).mockImplementation(async () => {
      callOrder.push('payout');
      return { payoutCount: 0, totalPaidCents: 0, failedCount: 0 };
    });

    await processAffiliatePayouts();

    expect(callOrder).toEqual(['graduate', 'payout']);
  });

  it('resolves without throwing when both steps succeed', async () => {
    const { processAffiliatePayouts } = await import('../affiliate-payout-cron');

    await expect(processAffiliatePayouts()).resolves.toBeUndefined();
  });
});

describe('affiliatePayoutWorker — worker config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('worker is created with queue name affiliate-payout', async () => {
    await import('../affiliate-payout-cron');
    const { createWorker } = await import('../queue');

    expect(createWorker).toHaveBeenCalledWith(
      'affiliate-payout',
      expect.any(Function),
      1
    );
  });

  it('worker is created with concurrency 1 to prevent duplicate processing', async () => {
    await import('../affiliate-payout-cron');
    const { createWorker } = await import('../queue');

    const concurrencyArg = vi.mocked(createWorker).mock.calls[0]?.[2];
    expect(concurrencyArg).toBe(1);
  });
});
