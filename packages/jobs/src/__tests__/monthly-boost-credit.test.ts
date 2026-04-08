/**
 * Tests for monthly-boost-credit.ts
 * Seller Score Canonical §5.4 — POWER_SELLER ($15) and TOP_RATED ($10) monthly credit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock fns ──────────────────────────────────────────────────────────

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'boost-credit-1' }));
const mockDbSelect = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbInsert = vi.hoisted(() => vi.fn());
const mockDbTransaction = vi.hoisted(() => vi.fn());

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({ add: mockQueueAdd }),
  createWorker: vi.fn().mockReturnValue({ close: vi.fn() }),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    transaction: mockDbTransaction,
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: {
    userId: 'user_id',
    status: 'status',
    performanceBand: 'performance_band',
    boostCreditCents: 'boost_credit_cents',
  },
  ledgerEntry: {
    id: 'id',
    type: 'type',
    userId: 'user_id',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ eq: true })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  inArray: vi.fn((_col: unknown, _vals: unknown) => ({ inArray: true })),
  gte: vi.fn((_col: unknown, _val: unknown) => ({ gte: true })),
  lt: vi.fn((_col: unknown, _val: unknown) => ({ lt: true })),
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn().mockReturnValue('test-cuid-001'),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((key: string, fallback?: unknown) => {
    const settings: Record<string, unknown> = {
      'score.rewards.powerSellerMonthlyCreditCents': 1500,
      'score.rewards.topRatedMonthlyCreditCents': 1000,
      'score.rewards.batchSize': 500,
      'jobs.cron.monthlyBoostCredit.pattern': '0 6 1 * *',
    };
    return Promise.resolve(key in settings ? settings[key] : fallback);
  }),
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Chain where .offset() is the terminal method (paginated seller queries).
 * Usage: db.select().from().where().limit(N).offset(M) → rows
 */
function buildPaginatedSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(rows),
  };
}

/**
 * Chain where .limit() is the terminal method (idempotency check queries).
 * Usage: db.select().from().where().limit(1) → rows
 */
function buildLimitedSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    offset: vi.fn().mockResolvedValue(rows),
  };
}

function buildInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function buildUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('registerMonthlyBoostCreditJob — cron registration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers the job with the correct cron schedule from platform_settings', async () => {
    const { registerMonthlyBoostCreditJob } = await import('../monthly-boost-credit');
    await registerMonthlyBoostCreditJob();

    expect(mockQueueAdd).toHaveBeenCalledOnce();
    const opts = mockQueueAdd.mock.calls[0]?.[2] as Record<string, unknown>;
    const repeat = opts['repeat'] as Record<string, unknown>;
    expect(repeat['pattern']).toBe('0 6 1 * *');
    expect(repeat['tz']).toBe('UTC');
  });

  it('uses a stable jobId to prevent duplicate cron registrations', async () => {
    const { registerMonthlyBoostCreditJob } = await import('../monthly-boost-credit');
    await registerMonthlyBoostCreditJob();

    const opts = mockQueueAdd.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(opts['jobId']).toBe('monthly-boost-credit');
  });

  it('reads cron pattern from platform_settings, not hardcoded', async () => {
    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');
    const { registerMonthlyBoostCreditJob } = await import('../monthly-boost-credit');
    await registerMonthlyBoostCreditJob();

    expect(getPlatformSetting).toHaveBeenCalledWith(
      'jobs.cron.monthlyBoostCredit.pattern',
      '0 6 1 * *',
    );
  });
});

describe('processMonthlyBoostCredit — POWER_SELLER', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('issues 1500 cents credit to POWER_SELLER and creates ledger entry + notification', async () => {
    const mockNotify = vi.fn().mockResolvedValue(undefined);

    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Paginated sellers query
        return buildPaginatedSelectChain([
          { userId: 'user-power-1', performanceBand: 'POWER_SELLER', boostCreditCents: 0 },
        ]);
      }
      // Idempotency check — no existing entry
      return buildLimitedSelectChain([]);
    });

    mockDbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        insert: vi.fn().mockReturnValue(buildInsertChain()),
        update: vi.fn().mockReturnValue(buildUpdateChain()),
      };
      await fn(tx);
    });

    const { processMonthlyBoostCredit } = await import('../monthly-boost-credit');
    const result = await processMonthlyBoostCredit(mockNotify);

    expect(result.processed).toBe(1);
    expect(result.totalCents).toBe(1500);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);

    expect(mockNotify).toHaveBeenCalledWith(
      'user-power-1',
      'seller.boostCredit.issued',
      expect.objectContaining({ amountCents: '1500', band: 'POWER_SELLER' }),
    );
  });
});

describe('processMonthlyBoostCredit — TOP_RATED', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('issues 1000 cents credit to TOP_RATED and creates ledger entry + notification', async () => {
    const mockNotify = vi.fn().mockResolvedValue(undefined);

    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return buildPaginatedSelectChain([
          { userId: 'user-top-1', performanceBand: 'TOP_RATED', boostCreditCents: 0 },
        ]);
      }
      return buildLimitedSelectChain([]);
    });

    mockDbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        insert: vi.fn().mockReturnValue(buildInsertChain()),
        update: vi.fn().mockReturnValue(buildUpdateChain()),
      };
      await fn(tx);
    });

    const { processMonthlyBoostCredit } = await import('../monthly-boost-credit');
    const result = await processMonthlyBoostCredit(mockNotify);

    expect(result.processed).toBe(1);
    expect(result.totalCents).toBe(1000);

    expect(mockNotify).toHaveBeenCalledWith(
      'user-top-1',
      'seller.boostCredit.issued',
      expect.objectContaining({ amountCents: '1000', band: 'TOP_RATED' }),
    );
  });
});

describe('processMonthlyBoostCredit — ineligible bands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('does not process EMERGING or SUSPENDED sellers (not returned by band filter)', async () => {
    const mockNotify = vi.fn().mockResolvedValue(undefined);

    // The query filters by inArray(['POWER_SELLER', 'TOP_RATED']), so only eligible sellers are returned
    mockDbSelect.mockImplementation(() => buildPaginatedSelectChain([]));

    const { processMonthlyBoostCredit } = await import('../monthly-boost-credit');
    const result = await processMonthlyBoostCredit(mockNotify);

    expect(result.processed).toBe(0);
    expect(result.totalCents).toBe(0);
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe('processMonthlyBoostCredit — idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('skips a seller who already received credit this month', async () => {
    const mockNotify = vi.fn().mockResolvedValue(undefined);

    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Sellers query returns one eligible seller
        return buildPaginatedSelectChain([
          { userId: 'user-power-1', performanceBand: 'POWER_SELLER', boostCreditCents: 1500 },
        ]);
      }
      // Idempotency check: existing entry found — already issued this month
      return buildLimitedSelectChain([{ id: 'existing-entry-id' }]);
    });

    const { processMonthlyBoostCredit } = await import('../monthly-boost-credit');
    const result = await processMonthlyBoostCredit(mockNotify);

    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.totalCents).toBe(0);
    expect(mockNotify).not.toHaveBeenCalled();
    // Transaction should not have been called when seller is skipped
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });
});

describe('processMonthlyBoostCredit — platform_settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('reads credit amounts from platform_settings, not hardcoded', async () => {
    const mockNotify = vi.fn().mockResolvedValue(undefined);
    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');

    // Confirm the settings keys consulted are the canonical ones
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return buildPaginatedSelectChain([
          { userId: 'user-power-1', performanceBand: 'POWER_SELLER', boostCreditCents: 0 },
        ]);
      }
      return buildLimitedSelectChain([]);
    });

    mockDbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        insert: vi.fn().mockReturnValue(buildInsertChain()),
        update: vi.fn().mockReturnValue(buildUpdateChain()),
      };
      await fn(tx);
    });

    const { processMonthlyBoostCredit } = await import('../monthly-boost-credit');
    await processMonthlyBoostCredit(mockNotify);

    // The key check: platform_settings was consulted for the amounts
    expect(getPlatformSetting).toHaveBeenCalledWith(
      'score.rewards.powerSellerMonthlyCreditCents',
      1500,
    );
    expect(getPlatformSetting).toHaveBeenCalledWith(
      'score.rewards.topRatedMonthlyCreditCents',
      1000,
    );
  });
});

describe('processMonthlyBoostCredit — batch pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('processes sellers in batches using batchSize from platform_settings', async () => {
    const mockNotify = vi.fn().mockResolvedValue(undefined);

    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');
    vi.mocked(getPlatformSetting).mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'score.rewards.batchSize') return Promise.resolve(2);
      if (key === 'score.rewards.powerSellerMonthlyCreditCents') return Promise.resolve(1500);
      if (key === 'score.rewards.topRatedMonthlyCreditCents') return Promise.resolve(1000);
      if (key === 'jobs.cron.monthlyBoostCredit.pattern') return Promise.resolve('0 6 1 * *');
      return Promise.resolve(fallback);
    });

    // Calls: (1) first batch sellers[offset=0] → 2 sellers, (2) idempotency user1, (3) idempotency user2, (4) second batch[offset=2] → empty
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return buildPaginatedSelectChain([
          { userId: 'user-power-1', performanceBand: 'POWER_SELLER', boostCreditCents: 0 },
          { userId: 'user-top-1', performanceBand: 'TOP_RATED', boostCreditCents: 0 },
        ]);
      }
      if (selectCallCount === 2 || selectCallCount === 3) {
        return buildLimitedSelectChain([]);
      }
      return buildPaginatedSelectChain([]);
    });

    mockDbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        insert: vi.fn().mockReturnValue(buildInsertChain()),
        update: vi.fn().mockReturnValue(buildUpdateChain()),
      };
      await fn(tx);
    });

    const { processMonthlyBoostCredit } = await import('../monthly-boost-credit');
    const result = await processMonthlyBoostCredit(mockNotify);

    expect(result.processed).toBe(2);
    expect(result.totalCents).toBe(2500); // 1500 + 1000
    expect(getPlatformSetting).toHaveBeenCalledWith('score.rewards.batchSize', 500);
  });
});
