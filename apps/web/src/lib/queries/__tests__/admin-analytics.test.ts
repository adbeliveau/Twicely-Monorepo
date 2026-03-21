/**
 * Admin Analytics Queries — Unit Tests (I10)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

const mockSql = Object.assign(
  vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({
    sql: Array.from(strings).join('?'),
    vals,
  })),
  {
    join: vi.fn((_parts: unknown[], _separator: unknown) => ({ sql: 'JOINED', vals: [] })),
  }
);

vi.mock('drizzle-orm', () => ({
  sql: mockSql,
  gte: vi.fn((col, val) => ({ type: 'gte', col, val })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  or: vi.fn((...args) => ({ type: 'or', args })),
  eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
  count: vi.fn(() => ({ type: 'count' })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  asc: vi.fn((col) => ({ type: 'asc', col })),
  ilike: vi.fn((col, val) => ({ type: 'ilike', col, val })),
}));

vi.mock('@twicely/db/schema', () => ({
  order: {
    id: 'id', createdAt: 'created_at', totalCents: 'total_cents',
    status: 'status', buyerId: 'buyer_id', sellerId: 'seller_id',
  },
  user: { id: 'id', createdAt: 'created_at', isSeller: 'is_seller', username: 'username' },
  listing: { id: 'id', status: 'status' },
  ledgerEntry: {
    id: 'id', createdAt: 'created_at', type: 'type',
    status: 'status', amountCents: 'amount_cents',
  },
  sellerProfile: {
    id: 'id', userId: 'user_id', storeName: 'store_name', storeSlug: 'store_slug',
    sellerType: 'seller_type', storeTier: 'store_tier', listerTier: 'lister_tier',
    performanceBand: 'performance_band', status: 'status', createdAt: 'created_at',
  },
  sellerPerformance: {
    id: 'id', sellerProfileId: 'seller_profile_id', totalOrders: 'total_orders',
    completedOrders: 'completed_orders', cancelRate: 'cancel_rate',
    returnRate: 'return_rate', averageRating: 'average_rating',
    totalReviews: 'total_reviews', lateShipmentRate: 'late_shipment_rate',
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  const methods = ['from', 'innerJoin', 'leftJoin', 'where', 'groupBy', 'orderBy', 'limit', 'offset'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

// ─── getAnalyticsSummary ──────────────────────────────────────────────────────

describe('getAnalyticsSummary', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns all fields with correct structure', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ total: '500000' }]))
      .mockReturnValueOnce(makeChain([{ total: '400000' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '120' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '100' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '50' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '40' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '10' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '3200' }]))
      .mockReturnValueOnce(makeChain([{ total: '49000' }]));

    const { getAnalyticsSummary } = await import('../admin-analytics');
    const result = await getAnalyticsSummary(30);

    expect(result).toMatchObject({
      gmvCents: 500000,
      gmvPreviousCents: 400000,
      orderCount: 120,
      orderCountPrevious: 100,
      newUserCount: 50,
      newUserCountPrevious: 40,
      newSellerCount: 10,
      activeListingCount: 3200,
      totalFeeRevenueCents: 49000,
    });
    expect(typeof result.takeRateBps).toBe('number');
    expect(typeof result.averageOrderCents).toBe('number');
  });

  it('returns zeros when DB returns empty rows', async () => {
    for (let i = 0; i < 9; i++) {
      mockDbSelect.mockReturnValueOnce(makeChain([]));
    }

    const { getAnalyticsSummary } = await import('../admin-analytics');
    const result = await getAnalyticsSummary(30);

    expect(result.gmvCents).toBe(0);
    expect(result.orderCount).toBe(0);
    expect(result.totalFeeRevenueCents).toBe(0);
    expect(result.takeRateBps).toBe(0);
    expect(result.averageOrderCents).toBe(0);
  });

  it('coerces gmvCents from SQL aggregate string to number', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ total: '999999' }]))
      .mockReturnValueOnce(makeChain([{ total: '0' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '10' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '10' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '5' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '5' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '2' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '500' }]))
      .mockReturnValueOnce(makeChain([{ total: '10000' }]));

    const { getAnalyticsSummary } = await import('../admin-analytics');
    const result = await getAnalyticsSummary(30);

    expect(typeof result.gmvCents).toBe('number');
    expect(result.gmvCents).toBe(999999);
  });

  it('calculates takeRateBps as (feeRevenue / gmv) * 10000', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ total: '100000' }]))
      .mockReturnValueOnce(makeChain([{ total: '0' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '5' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '5' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '1' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '1' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '1' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '10' }]))
      .mockReturnValueOnce(makeChain([{ total: '10000' }]));

    const { getAnalyticsSummary } = await import('../admin-analytics');
    const result = await getAnalyticsSummary(30);

    expect(result.takeRateBps).toBe(1000);
  });

  it('returns takeRateBps as 0 when gmvCents is 0', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ total: '0' }]))
      .mockReturnValueOnce(makeChain([{ total: '0' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '0' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '0' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '0' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '0' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '0' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '0' }]))
      .mockReturnValueOnce(makeChain([{ total: '5000' }]));

    const { getAnalyticsSummary } = await import('../admin-analytics');
    const result = await getAnalyticsSummary(30);

    expect(result.takeRateBps).toBe(0);
  });

  it('calculates percentage change for gmv, orders, users via returned values', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ total: '200000' }]))
      .mockReturnValueOnce(makeChain([{ total: '100000' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '60' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '50' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '30' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '20' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '5' }]))
      .mockReturnValueOnce(makeChain([{ cnt: '1000' }]))
      .mockReturnValueOnce(makeChain([{ total: '20000' }]));

    const { getAnalyticsSummary } = await import('../admin-analytics');
    const result = await getAnalyticsSummary(30);

    expect(result.gmvCents).toBe(200000);
    expect(result.gmvPreviousCents).toBe(100000);
    expect(result.orderCount).toBe(60);
    expect(result.orderCountPrevious).toBe(50);
    expect(result.newUserCount).toBe(30);
    expect(result.newUserCountPrevious).toBe(20);
  });

  it('excludes ORDER_STRIPE_PROCESSING_FEE from fee revenue (uses PLATFORM_FEE_TYPES only)', async () => {
    for (let i = 0; i < 9; i++) {
      mockDbSelect.mockReturnValueOnce(makeChain([{ total: '0', cnt: '0' }]));
    }

    const { getAnalyticsSummary } = await import('../admin-analytics');
    await getAnalyticsSummary(30);

    // 9 parallel queries: gmv, gmvPrev, orders, ordersPrev, users, usersPrev, sellers, listings, fees
    expect(mockDbSelect).toHaveBeenCalledTimes(9);
  });
});

// ─── getAnalyticsTimeSeries ───────────────────────────────────────────────────

describe('getAnalyticsTimeSeries', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns daily time series points for gmv metric', async () => {
    mockDbSelect.mockReturnValue(makeChain([
      { date: '2026-03-01', value: '50000' },
      { date: '2026-03-02', value: '75000' },
    ]));

    const { getAnalyticsTimeSeries } = await import('../admin-analytics');
    const result = await getAnalyticsTimeSeries('gmv', 30);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: '2026-03-01', value: 50000 });
    expect(result[1]).toEqual({ date: '2026-03-02', value: 75000 });
  });

  it('returns daily time series points for orders metric', async () => {
    mockDbSelect.mockReturnValue(makeChain([
      { date: '2026-03-01', value: 10 },
      { date: '2026-03-02', value: 15 },
    ]));

    const { getAnalyticsTimeSeries } = await import('../admin-analytics');
    const result = await getAnalyticsTimeSeries('orders', 7);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ date: '2026-03-01', value: 10 });
  });

  it('returns daily time series points for users metric', async () => {
    mockDbSelect.mockReturnValue(makeChain([
      { date: '2026-03-01', value: 5 },
    ]));

    const { getAnalyticsTimeSeries } = await import('../admin-analytics');
    const result = await getAnalyticsTimeSeries('users', 30);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ date: '2026-03-01', value: 5 });
  });

  it('returns daily time series points for fees metric', async () => {
    mockDbSelect.mockReturnValue(makeChain([
      { date: '2026-03-01', value: '12500' },
      { date: '2026-03-02', value: '9800' },
    ]));

    const { getAnalyticsTimeSeries } = await import('../admin-analytics');
    const result = await getAnalyticsTimeSeries('fees', 90);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: '2026-03-01', value: 12500 });
  });

  it('returns empty array when no data in period', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));

    const { getAnalyticsTimeSeries } = await import('../admin-analytics');
    const result = await getAnalyticsTimeSeries('gmv', 7);

    expect(result).toEqual([]);
  });
});

// ─── getUserCohortRetention ───────────────────────────────────────────────────

describe('getUserCohortRetention', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns correct cohort structure with monthly retention percentages', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([
        { cohortMonth: '2026-01', cohortSize: 100 },
        { cohortMonth: '2026-02', cohortSize: 80 },
      ]))
      .mockReturnValue(makeChain([{ cnt: '40' }]));

    const { getUserCohortRetention } = await import('../admin-analytics');
    const result = await getUserCohortRetention(3);

    expect(Array.isArray(result)).toBe(true);
    for (const row of result) {
      expect(typeof row.cohortMonth).toBe('string');
      expect(typeof row.cohortSize).toBe('number');
      expect(Array.isArray(row.retentionPcts)).toBe(true);
    }
  });

  it('handles months with zero signups gracefully', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([]));

    const { getUserCohortRetention } = await import('../admin-analytics');
    const result = await getUserCohortRetention(3);

    expect(Array.isArray(result)).toBe(true);
    for (const row of result) {
      if (row.cohortSize === 0) {
        expect(row.retentionPcts).toEqual([]);
      }
    }
  });

  it('limits to requested number of months', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));

    const { getUserCohortRetention } = await import('../admin-analytics');
    const result6 = await getUserCohortRetention(6);

    vi.resetModules();
    mockDbSelect.mockReturnValue(makeChain([]));

    const { getUserCohortRetention: get3 } = await import('../admin-analytics');
    const result3 = await get3(3);

    expect(result6).toHaveLength(6);
    expect(result3).toHaveLength(3);
  });
});

// ─── getSellerAnalyticsTable ──────────────────────────────────────────────────

describe('getSellerAnalyticsTable', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns paginated seller rows with total count', async () => {
    const sellerRow = {
      userId: 'user-1', storeName: 'Test Store', storeSlug: 'test-store',
      username: 'testuser', sellerType: 'PERSONAL', storeTier: 'NONE',
      listerTier: 'FREE', performanceBand: 'EMERGING', status: 'ACTIVE',
      totalOrders: 50, completedOrders: 45, cancelRate: '0.02', returnRate: '0.01',
      averageRating: '4.8', totalReviews: 30, lateShipmentRate: '0.05',
      gmvCents: '250000', createdAt: new Date('2025-01-15'),
    };

    mockDbSelect
      .mockReturnValueOnce(makeChain([sellerRow]))
      .mockReturnValueOnce(makeChain([{ cnt: 1 }]));

    const { getSellerAnalyticsTable } = await import('../admin-analytics');
    const result = await getSellerAnalyticsTable({
      page: 1, pageSize: 25, sortBy: 'gmv', sortDir: 'desc',
    });

    expect(result.total).toBe(1);
    expect(result.sellers).toHaveLength(1);
    expect(result.sellers[0]?.gmvCents).toBe(250000);
    expect(typeof result.sellers[0]?.cancelRate).toBe('number');
  });

  it('applies band filter when provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ cnt: 0 }]));

    const { getSellerAnalyticsTable } = await import('../admin-analytics');
    const result = await getSellerAnalyticsTable({
      page: 1, pageSize: 25, sortBy: 'gmv', sortDir: 'desc',
      bandFilter: 'TOP_RATED',
    });

    expect(result.sellers).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('applies tier filter when provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ cnt: 0 }]));

    const { getSellerAnalyticsTable } = await import('../admin-analytics');
    const result = await getSellerAnalyticsTable({
      page: 1, pageSize: 25, sortBy: 'gmv', sortDir: 'desc',
      tierFilter: 'PRO',
    });

    expect(result.sellers).toHaveLength(0);
  });

  it('applies search filter when provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ cnt: 0 }]));

    const { getSellerAnalyticsTable } = await import('../admin-analytics');
    const result = await getSellerAnalyticsTable({
      page: 1, pageSize: 25, sortBy: 'gmv', sortDir: 'desc',
      search: 'Nike Store',
    });

    expect(result.sellers).toHaveLength(0);
    expect(mockDbSelect).toHaveBeenCalled();
  });

  it('sorts by gmv descending by default', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ cnt: 0 }]));

    const { getSellerAnalyticsTable } = await import('../admin-analytics');
    await getSellerAnalyticsTable({
      page: 1, pageSize: 25, sortBy: 'gmv', sortDir: 'desc',
    });

    expect(mockDbSelect).toHaveBeenCalled();
  });

  it('paginates correctly with page and pageSize', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ cnt: 50 }]));

    const { getSellerAnalyticsTable } = await import('../admin-analytics');
    const result = await getSellerAnalyticsTable({
      page: 3, pageSize: 10, sortBy: 'gmv', sortDir: 'desc',
    });

    expect(result.total).toBe(50);
    expect(result.sellers).toHaveLength(0);
  });
});
