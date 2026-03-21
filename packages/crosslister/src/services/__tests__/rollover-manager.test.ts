import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DB mock setup ────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockTxSelect = vi.fn();
const mockTxUpdate = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({ select: mockTxSelect, update: mockTxUpdate })
    ),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  publishCreditLedger: {
    id: 'id', userId: 'user_id', creditType: 'credit_type',
    totalCredits: 'total_credits', usedCredits: 'used_credits',
    expiresAt: 'expires_at', periodStart: 'period_start', periodEnd: 'period_end',
    listerSubscriptionId: 'lister_subscription_id', createdAt: 'created_at',
  },
  platformSetting: { key: 'key', value: 'value' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  gt: vi.fn((a, b) => ({ type: 'gt', a, b })),
  gte: vi.fn((a, b) => ({ type: 'gte', a, b })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray) => strings[0]),
    { raw: vi.fn() }
  ),
}));

// ─── Chain helpers ────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  chain.for = vi.fn().mockReturnValue(chain);
  // make chain thenable so .orderBy().then() works for queries without .limit()
  chain.then = (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn().mockResolvedValue(undefined);
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('rollover-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // ─── addMonthlyCredits ─────────────────────────────────────────────────────

  describe('addMonthlyCredits', () => {
    const periodStart = new Date('2025-06-01T00:00:00Z');
    const periodEnd = new Date('2025-07-01T00:00:00Z');

    it('inserts MONTHLY creditType for LITE tier', async () => {
      // 3 setting reads + 1 getAvailableCredits select
      mockDbSelect
        .mockReturnValueOnce(makeSelectChain([{ value: '200' }]))  // monthlyLimit
        .mockReturnValueOnce(makeSelectChain([{ value: '60' }]))   // rolloverDays
        .mockReturnValueOnce(makeSelectChain([{ value: '3' }]))    // rolloverMaxMultiplier
        .mockReturnValueOnce(makeSelectChain([]));                 // getAvailableCredits (no existing)

      const insertChain = makeInsertChain();
      mockDbInsert.mockReturnValue(insertChain);

      const { addMonthlyCredits } = await import('../rollover-manager');
      await addMonthlyCredits('user-test-001', 'LITE', periodStart, periodEnd, 'sub-test-001');

      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      const valuesArg = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(valuesArg.creditType).toBe('MONTHLY');
      expect(valuesArg.totalCredits).toBe(200);
    });

    it('inserts 2000 credits for PRO tier', async () => {
      mockDbSelect
        .mockReturnValueOnce(makeSelectChain([{ value: '2000' }]))
        .mockReturnValueOnce(makeSelectChain([{ value: '60' }]))
        .mockReturnValueOnce(makeSelectChain([{ value: '3' }]))
        .mockReturnValueOnce(makeSelectChain([]));

      const insertChain = makeInsertChain();
      mockDbInsert.mockReturnValue(insertChain);

      const { addMonthlyCredits } = await import('../rollover-manager');
      await addMonthlyCredits('user-test-002', 'PRO', periodStart, periodEnd, 'sub-test-002');

      const valuesArg = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(valuesArg.totalCredits).toBe(2000);
    });

    it('caps credits so total does not exceed maxStockpile (LITE: cap=600, existing=500)', async () => {
      // LITE: monthlyLimit=200, maxStockpile=600; existing=500 → only 100 added
      const existingBucket = {
        id: 'pcl-existing-1', creditType: 'MONTHLY', totalCredits: 600,
        usedCredits: 100, // remaining = 500
        expiresAt: new Date(Date.now() + 86400000),
        periodStart: new Date('2025-05-01'), periodEnd: new Date('2025-06-01'),
      };
      mockDbSelect
        .mockReturnValueOnce(makeSelectChain([{ value: '200' }]))
        .mockReturnValueOnce(makeSelectChain([{ value: '60' }]))
        .mockReturnValueOnce(makeSelectChain([{ value: '3' }]))
        .mockReturnValueOnce(makeSelectChain([existingBucket])); // existing 500 credits

      const insertChain = makeInsertChain();
      mockDbInsert.mockReturnValue(insertChain);

      const { addMonthlyCredits } = await import('../rollover-manager');
      await addMonthlyCredits('user-test-003', 'LITE', periodStart, periodEnd, 'sub-test-003');

      const valuesArg = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(valuesArg.totalCredits).toBe(100); // 600 - 500 = 100
    });

    it('sets expiresAt = periodEnd for FREE tier (no rollover)', async () => {
      mockDbSelect
        .mockReturnValueOnce(makeSelectChain([{ value: '25' }]))
        .mockReturnValueOnce(makeSelectChain([{ value: '60' }]))
        .mockReturnValueOnce(makeSelectChain([{ value: '3' }]))
        .mockReturnValueOnce(makeSelectChain([]));

      const insertChain = makeInsertChain();
      mockDbInsert.mockReturnValue(insertChain);

      const { addMonthlyCredits } = await import('../rollover-manager');
      await addMonthlyCredits('user-test-004', 'FREE', periodStart, periodEnd, 'sub-test-004');

      const valuesArg = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(valuesArg.expiresAt).toEqual(periodEnd);
    });

    it('sets expiresAt = now + 60 days for LITE tier (rollover enabled)', async () => {
      const before = Date.now();
      mockDbSelect
        .mockReturnValueOnce(makeSelectChain([{ value: '200' }]))
        .mockReturnValueOnce(makeSelectChain([{ value: '60' }]))
        .mockReturnValueOnce(makeSelectChain([{ value: '3' }]))
        .mockReturnValueOnce(makeSelectChain([]));

      const insertChain = makeInsertChain();
      mockDbInsert.mockReturnValue(insertChain);

      const { addMonthlyCredits } = await import('../rollover-manager');
      await addMonthlyCredits('user-test-005', 'LITE', periodStart, periodEnd, 'sub-test-005');

      const valuesArg = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      const after = Date.now();
      const expectedMs = 60 * 24 * 60 * 60 * 1000;
      const actualMs = valuesArg.expiresAt.getTime() - before;
      expect(actualMs).toBeGreaterThanOrEqual(expectedMs - 1000);
      expect(valuesArg.expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs + 1000);
    });

    it('reads rollover days from platform_settings (not hardcoded)', async () => {
      // Use 90 days instead of 60 to prove it reads the setting
      mockDbSelect
        .mockReturnValueOnce(makeSelectChain([{ value: '200' }]))
        .mockReturnValueOnce(makeSelectChain([{ value: '90' }])) // 90-day rollover
        .mockReturnValueOnce(makeSelectChain([{ value: '3' }]))
        .mockReturnValueOnce(makeSelectChain([]));

      const insertChain = makeInsertChain();
      mockDbInsert.mockReturnValue(insertChain);

      const before = Date.now();
      const { addMonthlyCredits } = await import('../rollover-manager');
      await addMonthlyCredits('user-test-014', 'LITE', periodStart, periodEnd, 'sub-test-014');

      const valuesArg = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      const expectedMs = 90 * 24 * 60 * 60 * 1000;
      expect(valuesArg.expiresAt.getTime() - before).toBeGreaterThanOrEqual(expectedMs - 1000);
    });

    it('reads max multiplier from platform_settings (not hardcoded)', async () => {
      // cap = 200 * 5 = 1000; existing = 0 → add full 200
      mockDbSelect
        .mockReturnValueOnce(makeSelectChain([{ value: '200' }]))
        .mockReturnValueOnce(makeSelectChain([{ value: '60' }]))
        .mockReturnValueOnce(makeSelectChain([{ value: '5' }])) // multiplier = 5
        .mockReturnValueOnce(makeSelectChain([]));

      const insertChain = makeInsertChain();
      mockDbInsert.mockReturnValue(insertChain);

      const { addMonthlyCredits } = await import('../rollover-manager');
      await addMonthlyCredits('user-test-015', 'LITE', periodStart, periodEnd, 'sub-test-015');

      const valuesArg = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(valuesArg.totalCredits).toBe(200); // not capped (1000 cap, 0 existing)
    });
  });

  // ─── addOverageCredits ─────────────────────────────────────────────────────

  describe('addOverageCredits', () => {
    it('inserts OVERAGE creditType with periodEnd as expiresAt', async () => {
      const periodEnd = new Date('2025-07-01T00:00:00Z');
      const insertChain = makeInsertChain();
      mockDbInsert.mockReturnValue(insertChain);

      const { addOverageCredits } = await import('../rollover-manager');
      await addOverageCredits('user-test-006', 500, periodEnd);

      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      const valuesArg = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(valuesArg.creditType).toBe('OVERAGE');
      expect(valuesArg.totalCredits).toBe(500);
      expect(valuesArg.expiresAt).toEqual(periodEnd);
      expect(valuesArg.listerSubscriptionId).toBeNull();
    });
  });

  // ─── getAvailableCredits ───────────────────────────────────────────────────

  describe('getAvailableCredits', () => {
    it('excludes expired rows', async () => {
      // The WHERE clause filters expired rows — DB query returns only non-expired
      mockDbSelect.mockReturnValueOnce(makeSelectChain([])); // expired filtered by DB

      const { getAvailableCredits } = await import('../rollover-manager');
      const result = await getAvailableCredits('user-test-007');

      expect(result.total).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    it('returns correct breakdown with remaining calculated from totalCredits - usedCredits', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      const periodStart = new Date('2025-06-01');
      const periodEnd = new Date('2025-07-01');

      const rows = [
        { id: 'pcl-a1', creditType: 'MONTHLY' as const, totalCredits: 200, usedCredits: 50, expiresAt, periodStart, periodEnd },
        { id: 'pcl-a2', creditType: 'OVERAGE' as const, totalCredits: 500, usedCredits: 100, expiresAt, periodStart, periodEnd },
      ];
      mockDbSelect.mockReturnValueOnce(makeSelectChain(rows));

      const { getAvailableCredits } = await import('../rollover-manager');
      const result = await getAvailableCredits('user-test-008');

      expect(result.total).toBe(550); // (200-50) + (500-100)
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown[0]!.remaining).toBe(150);
      expect(result.breakdown[1]!.remaining).toBe(400);
    });
  });

  // ─── consumeCredits ────────────────────────────────────────────────────────

  describe('consumeCredits', () => {
    it('returns false when insufficient credits (no partial consumption)', async () => {
      // Only 10 credits available, asking for 50
      const rows = [{ id: 'pcl-c1', totalCredits: 20, usedCredits: 10 }];
      mockTxSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              for: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      });

      const { consumeCredits } = await import('../rollover-manager');
      const result = await consumeCredits('user-test-009', 50);

      expect(result).toBe(false);
      expect(mockTxUpdate).not.toHaveBeenCalled();
    });

    it('returns true and consumes from soonest-to-expire bucket first', async () => {
      const rows = [
        { id: 'pcl-c2', totalCredits: 100, usedCredits: 0 }, // soonest, consume from here
        { id: 'pcl-c3', totalCredits: 200, usedCredits: 0 }, // later
      ];
      mockTxSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              for: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      });

      const updateChain = makeUpdateChain();
      mockTxUpdate.mockReturnValue(updateChain);

      const { consumeCredits } = await import('../rollover-manager');
      const result = await consumeCredits('user-test-010', 50);

      expect(result).toBe(true);
      expect(mockTxUpdate).toHaveBeenCalledTimes(1);
      const setCall = (updateChain.set as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(setCall.usedCredits).toBe(50); // consumed 50 from first row
    });

    it('spans across multiple buckets when first is insufficient', async () => {
      const rows = [
        { id: 'pcl-c4', totalCredits: 30, usedCredits: 0 },  // consume all 30
        { id: 'pcl-c5', totalCredits: 100, usedCredits: 0 }, // consume 20 more
      ];
      mockTxSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              for: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      });

      const updateChain1 = makeUpdateChain();
      const updateChain2 = makeUpdateChain();
      mockTxUpdate.mockReturnValueOnce(updateChain1).mockReturnValueOnce(updateChain2);

      const { consumeCredits } = await import('../rollover-manager');
      const result = await consumeCredits('user-test-011', 50);

      expect(result).toBe(true);
      expect(mockTxUpdate).toHaveBeenCalledTimes(2);
      expect((updateChain1.set as ReturnType<typeof vi.fn>).mock.calls[0]![0].usedCredits).toBe(30);
      expect((updateChain2.set as ReturnType<typeof vi.fn>).mock.calls[0]![0].usedCredits).toBe(20);
    });
  });

  // ─── forfeitExcessRollover ─────────────────────────────────────────────────

  describe('forfeitExcessRollover', () => {
    it('returns 0 when total credits are within new cap', async () => {
      const rows = [{ id: 'pcl-f1', totalCredits: 500, usedCredits: 0 }];
      mockDbSelect.mockReturnValueOnce(makeSelectChain(rows));

      const { forfeitExcessRollover } = await import('../rollover-manager');
      const forfeited = await forfeitExcessRollover('user-test-012', 600);

      expect(forfeited).toBe(0);
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('forfeits excess on PRO→LITE downgrade (cap=600, total=800)', async () => {
      const rows = [
        { id: 'pcl-f2', totalCredits: 400, usedCredits: 0 }, // DESC order: newest first
        { id: 'pcl-f3', totalCredits: 400, usedCredits: 0 },
      ];
      mockDbSelect.mockReturnValueOnce(makeSelectChain(rows));
      const updateChain = makeUpdateChain();
      mockDbUpdate.mockReturnValue(updateChain);

      const { forfeitExcessRollover } = await import('../rollover-manager');
      const forfeited = await forfeitExcessRollover('user-test-012', 600);

      expect(forfeited).toBe(200); // 800 - 600 = 200 forfeited
    });
  });

  // ─── forfeitAllCredits ─────────────────────────────────────────────────────

  describe('forfeitAllCredits', () => {
    it('returns 0 and makes no updates when no active credits', async () => {
      mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

      const { forfeitAllCredits } = await import('../rollover-manager');
      const forfeited = await forfeitAllCredits('user-test-013');

      expect(forfeited).toBe(0);
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('sets usedCredits = totalCredits on all active rows', async () => {
      const rows = [
        { id: 'pcl-g1', totalCredits: 200, usedCredits: 50 },
        { id: 'pcl-g2', totalCredits: 500, usedCredits: 0 },
      ];
      mockDbSelect.mockReturnValueOnce(makeSelectChain(rows));
      const updateChain = makeUpdateChain();
      mockDbUpdate.mockReturnValue(updateChain);

      const { forfeitAllCredits } = await import('../rollover-manager');
      const forfeited = await forfeitAllCredits('user-test-013');

      expect(forfeited).toBe(650); // 150 + 500
      expect(mockDbUpdate).toHaveBeenCalledTimes(2);
      const setCall0 = (updateChain.set as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(setCall0.usedCredits).toBe(200); // totalCredits
    });
  });
});
