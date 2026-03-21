/**
 * Edge-case and missing-branch tests for finance-center.ts queries.
 * Companion to finance-center.test.ts — covers getFinanceTier, daysAgo,
 * avgSalePriceCents with single order, negative net earnings, no balance row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '@twicely/db';
import type { Mock } from 'vitest';

const mockDb = db as unknown as { select: Mock };

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

describe('getFinanceTier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns FREE when sellerProfile has financeTier FREE', async () => {
    mockDb.select.mockReturnValueOnce(createChain([{ financeTier: 'FREE' }]));

    const { getFinanceTier } = await import('../finance-center');
    const result = await getFinanceTier('user-test-001');

    expect(result).toBe('FREE');
  });

  it('returns PRO when sellerProfile has financeTier PRO', async () => {
    mockDb.select.mockReturnValueOnce(createChain([{ financeTier: 'PRO' }]));

    const { getFinanceTier } = await import('../finance-center');
    const result = await getFinanceTier('user-test-002');

    expect(result).toBe('PRO');
  });

  it('defaults to FREE when no sellerProfile row exists', async () => {
    mockDb.select.mockReturnValueOnce(createChain([]));

    const { getFinanceTier } = await import('../finance-center');
    const result = await getFinanceTier('user-test-003');

    expect(result).toBe('FREE');
  });
});

describe('daysAgo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns a Date object', async () => {
    const { daysAgo } = await import('../finance-center');
    const result = daysAgo(7);
    expect(result).toBeInstanceOf(Date);
  });

  it('returns a date 7 days in the past', async () => {
    const { daysAgo } = await import('../finance-center');
    const before = new Date();
    const result = daysAgo(7);
    const msIn7Days = 7 * 24 * 60 * 60 * 1000;
    const dstToleranceMs = 3_600_000; // ±1 hour for DST transitions
    expect(before.getTime() - result.getTime()).toBeGreaterThanOrEqual(msIn7Days - dstToleranceMs);
  });

  it('returns a date 0 days ago (today)', async () => {
    const { daysAgo } = await import('../finance-center');
    const before = new Date();
    const result = daysAgo(0);
    // Should be within a few milliseconds of now
    expect(Math.abs(before.getTime() - result.getTime())).toBeLessThan(100);
  });

  it('returns a date 30 days in the past for default period', async () => {
    const { daysAgo } = await import('../finance-center');
    const result = daysAgo(30);
    const msIn30Days = 30 * 24 * 60 * 60 * 1000;
    const dstToleranceMs = 3_600_000; // ±1 hour for DST transitions
    const now = new Date();
    expect(now.getTime() - result.getTime()).toBeGreaterThanOrEqual(msIn30Days - dstToleranceMs);
  });
});

describe('getFinanceDashboardKPIs — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('calculates avgSalePriceCents correctly for single order', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 7500, cnt: 1 }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 0, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-test-001');

    expect(result.avgSalePriceCents).toBe(7500);
  });

  it('floors avgSalePriceCents when revenue does not divide evenly', async () => {
    // 3 orders totaling 100 cents -> avg = 33.33 -> floors to 33
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 100, cnt: 3 }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 0, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-test-002');

    expect(result.avgSalePriceCents).toBe(33);
  });

  it('produces negative netEarningsCents when fees exceed revenue', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 500, cnt: 1 }]))
      .mockReturnValueOnce(createChain([
        { type: 'ORDER_TF_FEE', total: 400 },
        { type: 'ORDER_STRIPE_PROCESSING_FEE', total: 320 },
      ]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 0, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-test-003');

    // 500 - 400 - 320 = -220
    expect(result.netEarningsCents).toBe(-220);
  });

  it('returns zeros for balance fields when no sellerBalance row', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 0, cnt: 0 }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([])) // no balance row
      .mockReturnValueOnce(createChain([])); // COGS query

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-test-004');

    expect(result.availableForPayoutCents).toBe(0);
    expect(result.pendingCents).toBe(0);
    expect(result.reservedCents).toBe(0);
  });

  it('sums all three fee types to produce totalFeesCents', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 10000, cnt: 2 }]))
      .mockReturnValueOnce(createChain([
        { type: 'ORDER_TF_FEE', total: 1000 },
        { type: 'ORDER_STRIPE_PROCESSING_FEE', total: 320 },
        { type: 'ORDER_BOOST_FEE', total: 200 },
      ]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 0, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-test-005');

    expect(result.tfFeesCents).toBe(1000);
    expect(result.stripeFeesCents).toBe(320);
    expect(result.boostFeesCents).toBe(200);
    expect(result.totalFeesCents).toBe(1520);
  });

  it('effectiveFeeRatePercent at 10.5% (rounds to 2 decimal places)', async () => {
    // 1050 / 10000 = 10.5%
    mockDb.select
      .mockReturnValueOnce(createChain([{ gross: 10000, cnt: 1 }]))
      .mockReturnValueOnce(createChain([{ type: 'ORDER_TF_FEE', total: 1050 }]))
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([{ availableCents: 0, pendingCents: 0, reservedCents: 0 }]))
      .mockReturnValueOnce(createChain([])); // COGS query

    const { getFinanceDashboardKPIs } = await import('../finance-center');
    const result = await getFinanceDashboardKPIs('user-test-006');

    expect(result.effectiveFeeRatePercent).toBe(10.5);
  });
});
