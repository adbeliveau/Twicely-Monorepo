/**
 * Tests for affiliate-fraud-scan.ts BullMQ cron job (G3.5)
 * Covers: queue creation, cron registration, processAffiliateFraudScan orchestration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock fns ──────────────────────────────────────────────────────────

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'job-test-001' }));
const mockWorkerClose = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const { mockSelect, mockGetPlatformSetting, mockRunAllFraudChecks, mockEscalateAffiliate } =
  vi.hoisted(() => ({
    mockSelect: vi.fn(),
    mockGetPlatformSetting: vi.fn(),
    mockRunAllFraudChecks: vi.fn(),
    mockEscalateAffiliate: vi.fn(),
  }));

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({ add: mockQueueAdd }),
  createWorker: vi.fn().mockReturnValue({ close: mockWorkerClose }),
}));

vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  affiliate: { id: 'id', status: 'status' },
  referral: { affiliateId: 'affiliate_id', clickedAt: 'clicked_at' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  gte: vi.fn((a: unknown, b: unknown) => ({ type: 'gte', a, b })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ type: 'inArray', col, vals })),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

vi.mock('@/lib/affiliate/fraud-detection', () => ({
  runAllFraudChecks: (...args: unknown[]) => mockRunAllFraudChecks(...args),
}));

vi.mock('@/lib/affiliate/fraud-escalation', () => ({
  escalateAffiliate: (...args: unknown[]) => mockEscalateAffiliate(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectWhereChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  return chain as never;
}

function makeSelectAndWhereChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  return chain as never;
}

const NO_SIGNAL_RESULT = {
  affiliateId: 'aff-001',
  signals: [],
  highestSeverity: 'NONE' as const,
};

const WARNING_SIGNAL_RESULT = {
  affiliateId: 'aff-001',
  signals: [{
    flagged: true, signalType: 'BOT_TRAFFIC',
    details: 'High click volume', severity: 'WARNING' as const,
  }],
  highestSeverity: 'WARNING' as const,
};

// ─── Queue creation ───────────────────────────────────────────────────────────

describe('affiliateFraudScanQueue — queue name uses hyphens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates queue with hyphenated name affiliate-fraud-scan', async () => {
    const { createQueue } = await import('../queue');
    await import('../affiliate-fraud-scan');
    expect(createQueue).toHaveBeenCalledWith('affiliate-fraud-scan');
  });
});

// ─── Registration ─────────────────────────────────────────────────────────────

describe('registerAffiliateFraudScanJob — cron registration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers with 6-hour cron pattern', async () => {
    const { registerAffiliateFraudScanJob } = await import('../affiliate-fraud-scan');
    await registerAffiliateFraudScanJob();
    const opts = mockQueueAdd.mock.calls[0]?.[2] as Record<string, unknown>;
    const repeat = opts['repeat'] as Record<string, unknown>;
    expect(repeat['pattern']).toBe('0 */6 * * *');
  });

  it('uses stable jobId to prevent duplicate registrations', async () => {
    const { registerAffiliateFraudScanJob } = await import('../affiliate-fraud-scan');
    await registerAffiliateFraudScanJob();
    const opts = mockQueueAdd.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(opts['jobId']).toBe('affiliate-fraud-scan');
  });

  it('registers with removeOnComplete: true', async () => {
    const { registerAffiliateFraudScanJob } = await import('../affiliate-fraud-scan');
    await registerAffiliateFraudScanJob();
    const opts = mockQueueAdd.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(opts['removeOnComplete']).toBe(true);
  });
});

// ─── processAffiliateFraudScan ────────────────────────────────────────────────

describe('processAffiliateFraudScan — orchestration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips scan and returns early when fraud.enabled is false', async () => {
    mockGetPlatformSetting.mockResolvedValue(false);
    const { processAffiliateFraudScan } = await import('../affiliate-fraud-scan');

    await processAffiliateFraudScan();

    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockRunAllFraudChecks).not.toHaveBeenCalled();
  });

  it('skips scan and returns early when no recent referral activity', async () => {
    mockGetPlatformSetting.mockResolvedValue(true);
    mockSelect.mockReturnValue(makeSelectWhereChain([])); // no recent referrals
    const { processAffiliateFraudScan } = await import('../affiliate-fraud-scan');

    await processAffiliateFraudScan();

    expect(mockRunAllFraudChecks).not.toHaveBeenCalled();
  });

  it('only scans ACTIVE affiliates — skips BANNED/SUSPENDED', async () => {
    mockGetPlatformSetting.mockResolvedValue(true);
    mockSelect
      .mockReturnValueOnce(makeSelectWhereChain([{ affiliateId: 'aff-001' }, { affiliateId: 'aff-002' }]))
      .mockReturnValueOnce(makeSelectAndWhereChain([{ id: 'aff-001' }])); // only 1 active
    mockRunAllFraudChecks.mockResolvedValue(NO_SIGNAL_RESULT);
    const { processAffiliateFraudScan } = await import('../affiliate-fraud-scan');

    await processAffiliateFraudScan();

    expect(mockRunAllFraudChecks).toHaveBeenCalledTimes(1);
    expect(mockRunAllFraudChecks).toHaveBeenCalledWith('aff-001');
  });

  it('calls escalateAffiliate for flagged affiliates', async () => {
    mockGetPlatformSetting.mockResolvedValue(true);
    mockSelect
      .mockReturnValueOnce(makeSelectWhereChain([{ affiliateId: 'aff-001' }]))
      .mockReturnValueOnce(makeSelectAndWhereChain([{ id: 'aff-001' }]));
    mockRunAllFraudChecks.mockResolvedValue(WARNING_SIGNAL_RESULT);
    mockEscalateAffiliate.mockResolvedValue(undefined);
    const { processAffiliateFraudScan } = await import('../affiliate-fraud-scan');

    await processAffiliateFraudScan();

    expect(mockEscalateAffiliate).toHaveBeenCalledOnce();
    expect(mockEscalateAffiliate).toHaveBeenCalledWith(
      'aff-001',
      expect.objectContaining({ signalType: 'BOT_TRAFFIC' }),
      'SYSTEM',
    );
  });

  it('does NOT call escalateAffiliate when affiliate has no signals', async () => {
    mockGetPlatformSetting.mockResolvedValue(true);
    mockSelect
      .mockReturnValueOnce(makeSelectWhereChain([{ affiliateId: 'aff-001' }]))
      .mockReturnValueOnce(makeSelectAndWhereChain([{ id: 'aff-001' }]));
    mockRunAllFraudChecks.mockResolvedValue(NO_SIGNAL_RESULT);
    const { processAffiliateFraudScan } = await import('../affiliate-fraud-scan');

    await processAffiliateFraudScan();

    expect(mockEscalateAffiliate).not.toHaveBeenCalled();
  });
});
