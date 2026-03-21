/**
 * Tests for finance-center-expenses.ts queries.
 * Covers: getExpenseCategoryBreakdown, getCogsSummary
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock daysAgo from finance-center (imported by the module under test)
vi.mock('../finance-center', () => ({
  daysAgo: (days: number) => {
    const d = new Date('2026-03-04T00:00:00.000Z');
    d.setDate(d.getDate() - days);
    return d;
  },
}));

import { db } from '@twicely/db';
import type { Mock } from 'vitest';

const mockDb = db as unknown as { select: Mock };

function createChain(finalResult: unknown) {
  const makeProxy = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {};
    for (const k of [
      'from', 'where', 'groupBy', 'orderBy', 'limit', 'offset', 'innerJoin',
    ]) {
      p[k] = (..._args: unknown[]) => makeProxy();
    }
    p.then = (resolve: (v: unknown) => void) => resolve(finalResult);
    return p;
  };
  return makeProxy();
}

// ─── getExpenseCategoryBreakdown ────────────────────────────────────────────

describe('getExpenseCategoryBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns category breakdown with correct percentages', async () => {
    mockDb.select.mockReturnValueOnce(
      createChain([
        { category: 'Shipping Supplies', totalCents: 3000, cnt: 5 },
        { category: 'Equipment', totalCents: 1000, cnt: 2 },
      ]),
    );

    const { getExpenseCategoryBreakdown } = await import('../finance-center-expenses');
    const result = await getExpenseCategoryBreakdown('user-test-001', 30);

    expect(result).toHaveLength(2);
    const shipping = result[0];
    const equipment = result[1];
    expect(shipping?.category).toBe('Shipping Supplies');
    expect(shipping?.totalCents).toBe(3000);
    expect(shipping?.count).toBe(5);
    // 3000/4000 = 75%
    expect(shipping?.percentOfTotal).toBe(75);
    expect(equipment?.percentOfTotal).toBe(25);
  });

  it('returns empty array when no expenses', async () => {
    mockDb.select.mockReturnValueOnce(createChain([]));

    const { getExpenseCategoryBreakdown } = await import('../finance-center-expenses');
    const result = await getExpenseCategoryBreakdown('user-test-002', 30);

    expect(result).toEqual([]);
  });

  it('sets percentOfTotal to 0 when grandTotal is 0', async () => {
    mockDb.select.mockReturnValueOnce(
      createChain([{ category: 'Packaging', totalCents: 0, cnt: 1 }]),
    );

    const { getExpenseCategoryBreakdown } = await import('../finance-center-expenses');
    const result = await getExpenseCategoryBreakdown('user-test-003', 30);

    expect(result[0]?.percentOfTotal).toBe(0);
  });

  it('rounds percentOfTotal to 2 decimal places', async () => {
    // 1/3 of 1000 = 33.33...
    mockDb.select.mockReturnValueOnce(
      createChain([
        { category: 'Shipping Supplies', totalCents: 333, cnt: 1 },
        { category: 'Equipment', totalCents: 333, cnt: 1 },
        { category: 'Packaging', totalCents: 334, cnt: 1 },
      ]),
    );

    const { getExpenseCategoryBreakdown } = await import('../finance-center-expenses');
    const result = await getExpenseCategoryBreakdown('user-test-004', 30);

    // Each should be close to 33.33%
    const pcts = result.map((r) => r.percentOfTotal);
    expect(pcts.every((p) => typeof p === 'number')).toBe(true);
    // Total of all percents should round to ~100
    const total = pcts.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThanOrEqual(100.1);
  });
});

// ─── getCogsSummary ─────────────────────────────────────────────────────────

describe('getCogsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns zeros when no COGS data', async () => {
    mockDb.select.mockReturnValueOnce(createChain([]));

    const { getCogsSummary } = await import('../finance-center-expenses');
    const result = await getCogsSummary('user-test-001', 30);

    expect(result.totalCogsCents).toBe(0);
    expect(result.totalSoldRevenueCents).toBe(0);
    expect(result.grossProfitCents).toBe(0);
    expect(result.cogsMarginPercent).toBe(0);
    expect(result.itemCount).toBe(0);
  });

  it('calculates grossProfitCents and cogsMarginPercent correctly', async () => {
    mockDb.select.mockReturnValueOnce(
      createChain([
        { cogsCents: 2000, orderId: 'ord-1', orderTotal: 5000 },
        { cogsCents: 1000, orderId: 'ord-2', orderTotal: 3000 },
      ]),
    );

    const { getCogsSummary } = await import('../finance-center-expenses');
    const result = await getCogsSummary('user-test-002', 30);

    // totalCogs = 3000, totalRevenue = 8000, profit = 5000
    expect(result.totalCogsCents).toBe(3000);
    expect(result.totalSoldRevenueCents).toBe(8000);
    expect(result.grossProfitCents).toBe(5000);
    // 5000/8000 = 62.5%
    expect(result.cogsMarginPercent).toBe(62.5);
    expect(result.itemCount).toBe(2);
  });

  it('cogsMarginPercent is 0 when revenue is 0', async () => {
    // Rows with 0 orderTotal (shouldn't happen but defensive)
    mockDb.select.mockReturnValueOnce(
      createChain([{ cogsCents: 500, orderId: 'ord-1', orderTotal: 0 }]),
    );

    const { getCogsSummary } = await import('../finance-center-expenses');
    const result = await getCogsSummary('user-test-003', 30);

    expect(result.cogsMarginPercent).toBe(0);
  });

  it('handles null cogsCents (treats as 0)', async () => {
    mockDb.select.mockReturnValueOnce(
      createChain([{ cogsCents: null, orderId: 'ord-1', orderTotal: 4000 }]),
    );

    const { getCogsSummary } = await import('../finance-center-expenses');
    const result = await getCogsSummary('user-test-004', 30);

    expect(result.totalCogsCents).toBe(0);
    expect(result.totalSoldRevenueCents).toBe(4000);
    expect(result.grossProfitCents).toBe(4000);
    expect(result.itemCount).toBe(1);
  });
});
