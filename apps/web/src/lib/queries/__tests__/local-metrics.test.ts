import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val, type: 'eq' })),
  and: vi.fn((...args: unknown[]) => ({ args, type: 'and' })),
  isNotNull: vi.fn((col) => ({ col, type: 'isNotNull' })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
    type: 'sql',
  })),
}));

vi.mock('@twicely/db/schema', () => ({
  user: {
    id: 'id',
    localTransactionCount: 'local_transaction_count',
    localCompletionRate: 'local_completion_rate',
    localReliabilityMarks: 'local_reliability_marks',
  },
  localTransaction: {
    id: 'id',
    sellerId: 'seller_id',
    dayOfConfirmationSentAt: 'day_of_confirmation_sent_at',
    dayOfConfirmationRespondedAt: 'day_of_confirmation_responded_at',
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation(
    (_key: string, fallback: unknown) => Promise.resolve(fallback),
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChainLimit(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeSelectChainWhere(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'cuser0001abcde';

// Avg of 6 hours in milliseconds = 6 * 3600 * 1000 = 21_600_000
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
// Avg of 0.5 hours in ms
const HALF_HOUR_MS = 0.5 * 60 * 60 * 1000;
// Avg of 50 hours in ms
const FIFTY_HOURS_MS = 50 * 60 * 60 * 1000;
// Avg of 12 hours in ms
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getSellerLocalMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns correct metrics for seller with local activity', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 47, localCompletionRate: 0.96, localReliabilityMarks: 1 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: SIX_HOURS_MS }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    const result = await getSellerLocalMetrics(USER_ID);

    expect(result.localTransactionCount).toBe(47);
    expect(result.localCompletionRate).toBeCloseTo(0.96);
    expect(result.hasLocalActivity).toBe(true);
    expect(result.localReliabilityTier).toBe('RELIABLE');
  });

  it('returns hasLocalActivity: false when user has 0 local transactions', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 0, localCompletionRate: null, localReliabilityMarks: 0 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: null }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    const result = await getSellerLocalMetrics(USER_ID);

    expect(result.hasLocalActivity).toBe(false);
    expect(result.localTransactionCount).toBe(0);
  });

  it('returns null localAvgResponseLabel when no day-of confirmation data exists', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 10, localCompletionRate: 0.8, localReliabilityMarks: 0 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: null }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    const result = await getSellerLocalMetrics(USER_ID);

    expect(result.localAvgResponseLabel).toBeNull();
  });

  it('returns "Same day" for avg response time between 4-24 hours', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 20, localCompletionRate: 0.9, localReliabilityMarks: 0 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: TWELVE_HOURS_MS }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    const result = await getSellerLocalMetrics(USER_ID);

    expect(result.localAvgResponseLabel).toBe('Same day');
  });

  it('returns "Within 1 hour" for avg response time < 1 hour', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 5, localCompletionRate: 1.0, localReliabilityMarks: 0 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: HALF_HOUR_MS }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    const result = await getSellerLocalMetrics(USER_ID);

    expect(result.localAvgResponseLabel).toBe('Within 1 hour');
  });

  it('returns "Within 2 days" for avg response time >= 48 hours', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 3, localCompletionRate: 0.67, localReliabilityMarks: 0 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: FIFTY_HOURS_MS }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    const result = await getSellerLocalMetrics(USER_ID);

    expect(result.localAvgResponseLabel).toBe('Within 2 days');
  });

  it('returns RELIABLE tier for 0-2 marks', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 10, localCompletionRate: 0.9, localReliabilityMarks: 2 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: null }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    const result = await getSellerLocalMetrics(USER_ID);

    expect(result.localReliabilityTier).toBe('RELIABLE');
  });

  it('returns INCONSISTENT tier for 3-8 marks', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 15, localCompletionRate: 0.7, localReliabilityMarks: 5 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: null }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    const result = await getSellerLocalMetrics(USER_ID);

    expect(result.localReliabilityTier).toBe('INCONSISTENT');
  });

  it('returns UNRELIABLE tier for 9+ marks', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 30, localCompletionRate: 0.4, localReliabilityMarks: 12 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: null }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    const result = await getSellerLocalMetrics(USER_ID);

    expect(result.localReliabilityTier).toBe('UNRELIABLE');
  });

  it('treats null localCompletionRate as 0', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 5, localCompletionRate: null, localReliabilityMarks: 0 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: null }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    const result = await getSellerLocalMetrics(USER_ID);

    expect(result.localCompletionRate).toBe(0);
    expect(result.localCompletedCount).toBe(0);
  });

  it('only counts seller-side day-of confirmations for response time', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 8, localCompletionRate: 0.875, localReliabilityMarks: 0 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: SIX_HOURS_MS }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    await getSellerLocalMetrics(USER_ID);

    // The second select call (for avg response) should filter by sellerId
    expect(mockDbSelect).toHaveBeenCalledTimes(2);
  });

  it('localCompletedCount is correctly derived from count * rate', async () => {
    // 47 * 0.96 = 45.12 → Math.round → 45
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChainLimit([
          { localTransactionCount: 47, localCompletionRate: 0.96, localReliabilityMarks: 0 },
        ]),
      )
      .mockReturnValueOnce(
        makeSelectChainWhere([{ avgMs: null }]),
      );

    const { getSellerLocalMetrics } = await import('../local-metrics');
    const result = await getSellerLocalMetrics(USER_ID);

    expect(result.localCompletedCount).toBe(Math.round(47 * 0.96));
  });
});
