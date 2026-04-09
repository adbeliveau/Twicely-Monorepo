/**
 * Tests for finance-projection-compute.ts
 * Financial Center Canonical §6 — nightly PRO projection job.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock fns ──────────────────────────────────────────────────────────

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'fp-1' }));
const mockDbSelect = vi.hoisted(() => vi.fn());
const mockDbInsert = vi.hoisted(() => vi.fn());

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
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { id: 'id', userId: 'user_id', financeTier: 'finance_tier', createdAt: 'created_at' },
  financialProjection: { sellerProfileId: 'seller_profile_id' },
  order: { id: 'id', sellerId: 'seller_id', status: 'status', completedAt: 'completed_at' },
  orderItem: { orderId: 'order_id', listingId: 'listing_id' },
  listing: { id: 'id', ownerUserId: 'owner_user_id', status: 'status', cogsCents: 'cogs_cents', activatedAt: 'activated_at', categoryId: 'category_id', priceCents: 'price_cents' },
  expense: { id: 'id', userId: 'user_id', amountCents: 'amount_cents', category: 'category', expenseDate: 'expense_date' },
  user: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ eq: true })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  gte: vi.fn((_col: unknown, _val: unknown) => ({ gte: true })),
  isNotNull: vi.fn((_col: unknown) => ({ isNotNull: true })),
  inArray: vi.fn((_col: unknown, _vals: unknown) => ({ inArray: true })),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback?: unknown) =>
    Promise.resolve(fallback),
  ),
}));

vi.mock('@twicely/finance/projection-engine', () => ({
  computeProjection: vi.fn().mockResolvedValue({
    projectedRevenue30dCents: 50000,
    projectedExpenses30dCents: 10000,
    projectedProfit30dCents: 40000,
    sellThroughRate90d: 5000,
    avgSalePrice90dCents: 4500,
    effectiveFeeRate90d: 1000,
    avgDaysToSell90d: 14,
    breakEvenRevenueCents: 30000,
    breakEvenOrders: 7,
    healthScore: 72,
    healthScoreBreakdownJson: null,
    inventoryTurnsPerMonth: 500,
    performingPeriodsJson: null,
    dataQualityScore: 60,
  }),
}));

vi.mock('@twicely/finance/projection-types', () => ({}));

// ─── Select chain helpers ──────────────────────────────────────────────────────

/**
 * Build a paginated chain: .from().where().limit(N).offset(M) → rows
 */
function buildPaginatedChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(rows),
    innerJoin: vi.fn().mockReturnThis(),
  };
  // Make each method return 'chain' so chaining works
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  return chain;
}

/**
 * Build a simple chain: .from().where() → rows (no limit/offset)
 */
function buildSimpleChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(rows),
    innerJoin: vi.fn().mockReturnThis(),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  return chain;
}

function buildInsertChain() {
  return {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('registerFinanceProjectionComputeJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers job with correct queue name and UTC cron', async () => {
    const { registerFinanceProjectionComputeJob } = await import('../finance-projection-compute');
    await registerFinanceProjectionComputeJob();

    expect(mockQueueAdd).toHaveBeenCalledOnce();
    const opts = mockQueueAdd.mock.calls[0]?.[2] as Record<string, unknown>;
    const repeat = opts['repeat'] as Record<string, unknown>;
    expect(repeat['pattern']).toBe('0 2 * * *');
    expect(repeat['tz']).toBe('UTC');
  });

  it('uses stable jobId to prevent duplicate cron registrations', async () => {
    const { registerFinanceProjectionComputeJob } = await import('../finance-projection-compute');
    await registerFinanceProjectionComputeJob();

    const opts = mockQueueAdd.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(opts['jobId']).toBe('finance-projection-compute');
  });
});

describe('processFinanceProjectionCompute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('only processes PRO sellers', async () => {
    // Call order: (1) profiles[offset=0], (2) orders, (3) expenses, (4) listings, (5) profiles[offset=50]
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return buildPaginatedChain([
          { id: 'sp-1', userId: 'usr-1', createdAt: new Date() },
        ]);
      }
      if (callCount <= 4) return buildSimpleChain([]);
      return buildPaginatedChain([]); // next batch empty
    });
    mockDbInsert.mockReturnValue(buildInsertChain());

    const { processFinanceProjectionCompute } = await import('../finance-projection-compute');
    const result = await processFinanceProjectionCompute();

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);
  });

  it('upserts into financialProjection on conflict', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return buildPaginatedChain([
          { id: 'sp-1', userId: 'usr-1', createdAt: new Date() },
        ]);
      }
      if (callCount <= 4) return buildSimpleChain([]);
      return buildPaginatedChain([]);
    });

    const insertChain = buildInsertChain();
    mockDbInsert.mockReturnValue(insertChain);

    const { processFinanceProjectionCompute } = await import('../finance-projection-compute');
    await processFinanceProjectionCompute();

    expect(mockDbInsert).toHaveBeenCalled();
    expect(insertChain.onConflictDoUpdate).toHaveBeenCalled();
  });

  it('returns zero processed when no PRO sellers exist', async () => {
    mockDbSelect.mockImplementation(() => buildPaginatedChain([]));

    const { processFinanceProjectionCompute } = await import('../finance-projection-compute');
    const result = await processFinanceProjectionCompute();

    expect(result.processed).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('counts errors when compute fails and continues processing', async () => {
    const { computeProjection } = await import('@twicely/finance/projection-engine');
    vi.mocked(computeProjection).mockRejectedValueOnce(new Error('compute failed'));

    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return buildPaginatedChain([
          { id: 'sp-1', userId: 'usr-1', createdAt: new Date() },
        ]);
      }
      if (callCount <= 4) return buildSimpleChain([]);
      return buildPaginatedChain([]);
    });
    mockDbInsert.mockReturnValue(buildInsertChain());

    const { processFinanceProjectionCompute } = await import('../finance-projection-compute');
    const result = await processFinanceProjectionCompute();

    expect(result.errors).toBe(1);
    expect(result.processed).toBe(0);
  });

  it('processes sellers in batches of 50', async () => {
    const profiles = Array.from({ length: 50 }, (_, i) => ({
      id: `sp-${i}`,
      userId: `usr-${i}`,
      createdAt: new Date(),
    }));

    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return buildPaginatedChain(profiles);
      // 50 sellers × 3 queries (orders, expenses, listings) = 150 simple chains
      if (callCount <= 151) return buildSimpleChain([]);
      return buildPaginatedChain([]); // second batch empty
    });
    mockDbInsert.mockReturnValue(buildInsertChain());

    const { processFinanceProjectionCompute } = await import('../finance-projection-compute');
    const result = await processFinanceProjectionCompute();

    expect(result.processed).toBe(50);
  });
});
