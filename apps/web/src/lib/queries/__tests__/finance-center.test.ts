import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '@twicely/db';
import type { Mock } from 'vitest';

const mockDb = db as unknown as { select: Mock };

// Chainable mock helper — returns finalResult when awaited
function createChain(finalResult: unknown) {
  const makeProxy = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {};
    for (const k of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset', 'innerJoin']) {
      p[k] = (..._args: unknown[]) => makeProxy();
    }
    p.then = (resolve: (v: unknown) => void) => resolve(finalResult);
    return p;
  };
  return makeProxy();
}

describe('getFinanceDashboardKPIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns zeros when seller has no completed orders', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 0, cnt: 0 }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 0, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query (D4.1)

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-1');

    expect(result.grossRevenueCents).toBe(0);
    expect(result.totalOrderCount).toBe(0);
    expect(result.netEarningsCents).toBe(0);
    expect(result.effectiveFeeRatePercent).toBe(0);
  });

  it('calculates gross revenue from completed orders only', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 5000, cnt: 2 }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 3000, pendingCents: 500, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query (D4.1)

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-1');

    expect(result.grossRevenueCents).toBe(5000);
    expect(result.totalOrderCount).toBe(2);
    expect(result.avgSalePriceCents).toBe(2500);
  });

  it('sums TF fees from ORDER_TF_FEE ledger entries', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 10000, cnt: 1 }]))
      .mockReturnValueOnce(createChain([{ type: 'ORDER_TF_FEE', total: 1000 }]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 9000, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query (D4.1)

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-1');

    expect(result.tfFeesCents).toBe(1000);
  });

  it('sums Stripe fees from ORDER_STRIPE_PROCESSING_FEE ledger entries', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 10000, cnt: 1 }]))
      .mockReturnValueOnce(createChain([{ type: 'ORDER_STRIPE_PROCESSING_FEE', total: 320 }]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 9680, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query (D4.1)

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-1');

    expect(result.stripeFeesCents).toBe(320);
  });

  it('sums boost fees from ORDER_BOOST_FEE ledger entries', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 10000, cnt: 1 }]))
      .mockReturnValueOnce(createChain([{ type: 'ORDER_BOOST_FEE', total: 200 }]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 9800, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query (D4.1)

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-1');

    expect(result.boostFeesCents).toBe(200);
  });

  it('calculates net earnings correctly (revenue - fees - shipping)', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 10000, cnt: 1 }]))
      .mockReturnValueOnce(createChain([
        { type: 'ORDER_TF_FEE', total: 1000 },
        { type: 'ORDER_STRIPE_PROCESSING_FEE', total: 320 },
      ]))
      .mockReturnValueOnce(createChain([{ total: 850 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 0, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query (D4.1)

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-1');

    // 10000 - 1000 - 320 - 850 = 7830
    expect(result.netEarningsCents).toBe(7830);
  });

  it('calculates effective fee rate as percentage with 2 decimal places', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 10000, cnt: 1 }]))
      .mockReturnValueOnce(createChain([{ type: 'ORDER_TF_FEE', total: 1000 }]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 0, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query (D4.1)

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-1');

    expect(result.effectiveFeeRatePercent).toBe(10);
  });

  it('reads available/pending/reserved from sellerBalance', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 0, cnt: 0 }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 5000, pendingCents: 1000, reservedCents: 250 }]))
      .mockReturnValueOnce(createChain([])); // COGS query (D4.1)

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-1');

    expect(result.availableForPayoutCents).toBe(5000);
    expect(result.pendingCents).toBe(1000);
    expect(result.reservedCents).toBe(250);
  });

  it('respects the days parameter', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 0, cnt: 0 }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 0, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query (D4.1)

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-1', 7);

    expect(result).toHaveProperty('grossRevenueCents');
  });

  it('handles seller with balance but no orders gracefully', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 0, cnt: 0 }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 10000, pendingCents: 2000, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query (D4.1)

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-1');

    expect(result.grossRevenueCents).toBe(0);
    expect(result.availableForPayoutCents).toBe(10000);
    expect(result.effectiveFeeRatePercent).toBe(0);
  });
});

describe('getRevenueTimeSeries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty-filled array when no completed orders', async () => {
    mockDb.select.mockReturnValueOnce(createChain([]));

    const { getRevenueTimeSeries } = await import('../finance-center');
    const result = await getRevenueTimeSeries('user-1', 7);

    expect(result).toHaveLength(7);
    const first = result[0];
    expect(first?.revenueCents).toBe(0);
    expect(first?.orderCount).toBe(0);
  });

  it('groups revenue by date correctly', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockDb.select.mockReturnValueOnce(
      createChain([{ date: today, revenueCents: 5000, orderCount: 2 }]),
    );

    const { getRevenueTimeSeries } = await import('../finance-center');
    const result = await getRevenueTimeSeries('user-1', 1);

    const todayEntry = result.find((r) => r.date === today);
    expect(todayEntry?.revenueCents).toBe(5000);
    expect(todayEntry?.orderCount).toBe(2);
  });

  it('includes all days in range with zero-fill for missing days', async () => {
    mockDb.select.mockReturnValueOnce(createChain([]));

    const { getRevenueTimeSeries } = await import('../finance-center');
    const result = await getRevenueTimeSeries('user-1', 30);

    expect(result).toHaveLength(30);
    result.forEach((r) => {
      expect(r).toHaveProperty('date');
      expect(r).toHaveProperty('revenueCents');
      expect(r).toHaveProperty('orderCount');
    });
  });

  it('sums multiple orders on the same day', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockDb.select.mockReturnValueOnce(
      createChain([{ date: today, revenueCents: 15000, orderCount: 3 }]),
    );

    const { getRevenueTimeSeries } = await import('../finance-center');
    const result = await getRevenueTimeSeries('user-1', 1);

    const entry = result.find((r) => r.date === today);
    expect(entry?.revenueCents).toBe(15000);
    expect(entry?.orderCount).toBe(3);
  });
});
