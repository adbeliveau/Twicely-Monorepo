/**
 * Tests for finance intelligence layer projection compute functions.
 * Financial Center Canonical §6.
 * Part 1: individual compute functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((key: string, fallback?: unknown) => {
    const settings: Record<string, unknown> = {
      'finance.healthScore.weights.profitMarginTrend': 25,
      'finance.healthScore.weights.expenseRatio': 20,
      'finance.healthScore.weights.sellThroughVelocity': 20,
      'finance.healthScore.weights.inventoryAge': 20,
      'finance.healthScore.weights.revenueGrowth': 15,
    };
    return Promise.resolve(key in settings ? settings[key] : fallback);
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

import type { OrderSummary, ExpenseSummary, ListingSummary } from '../projection-types';

function makeOrder(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: 'ord-001',
    totalCents: 5000,
    tfFeesCents: 500,
    stripeFeesCents: 175,
    shippingCostsCents: 800,
    cogsCents: 1000,
    completedAt: new Date(),
    listingActivatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    categoryId: 'cat-clothing',
    ...overrides,
  };
}

function makeExpense(overrides: Partial<ExpenseSummary> = {}): ExpenseSummary {
  return {
    id: 'exp-001',
    amountCents: 1000,
    category: 'Packaging',
    expenseDate: new Date(),
    ...overrides,
  };
}

function makeListing(overrides: Partial<ListingSummary> = {}): ListingSummary {
  return {
    id: 'lst-001',
    priceCents: 5000,
    cogsCents: 1000,
    status: 'ACTIVE',
    activatedAt: new Date(),
    ...overrides,
  };
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeProjectedRevenue30d', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when fewer than 3 orders in trailing 90 days', async () => {
    const { computeProjectedRevenue30d } = await import('../projection-engine');
    const orders = [makeOrder({ completedAt: daysAgo(5) }), makeOrder({ completedAt: daysAgo(10) })];
    expect(computeProjectedRevenue30d(orders)).toBeNull();
  });

  it('extrapolates 90-day revenue to 30 days', async () => {
    const { computeProjectedRevenue30d } = await import('../projection-engine');
    const orders = [
      makeOrder({ totalCents: 9000, completedAt: daysAgo(5) }),
      makeOrder({ totalCents: 9000, completedAt: daysAgo(30) }),
      makeOrder({ totalCents: 9000, completedAt: daysAgo(60) }),
    ];
    expect(computeProjectedRevenue30d(orders)).toBe(9000);
  });

  it('ignores orders older than 90 days', async () => {
    const { computeProjectedRevenue30d } = await import('../projection-engine');
    const orders = [
      makeOrder({ totalCents: 5000, completedAt: daysAgo(91) }),
      makeOrder({ totalCents: 5000, completedAt: daysAgo(92) }),
      makeOrder({ totalCents: 5000, completedAt: daysAgo(93) }),
    ];
    expect(computeProjectedRevenue30d(orders)).toBeNull();
  });
});

describe('computeProjectedExpenses30d', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when fewer than 3 expenses in trailing 90 days', async () => {
    const { computeProjectedExpenses30d } = await import('../projection-engine');
    const expenses = [makeExpense(), makeExpense()];
    expect(computeProjectedExpenses30d(expenses)).toBeNull();
  });

  it('extrapolates 90-day expenses to 30 days', async () => {
    const { computeProjectedExpenses30d } = await import('../projection-engine');
    const expenses = [
      makeExpense({ amountCents: 3000, expenseDate: daysAgo(5) }),
      makeExpense({ amountCents: 3000, expenseDate: daysAgo(30) }),
      makeExpense({ amountCents: 3000, expenseDate: daysAgo(60) }),
    ];
    expect(computeProjectedExpenses30d(expenses)).toBe(3000);
  });
});

describe('computeSellThroughRate90d', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no orders and no active listings', async () => {
    const { computeSellThroughRate90d } = await import('../projection-engine');
    expect(computeSellThroughRate90d(90, [], [])).toBeNull();
  });

  it('returns 5000 bps when 1 sold of 2 total', async () => {
    const { computeSellThroughRate90d } = await import('../projection-engine');
    const orders = [makeOrder({ completedAt: daysAgo(5) })];
    const listings = [makeListing()];
    expect(computeSellThroughRate90d(90, orders, listings)).toBe(5000);
  });

  it('returns 10000 bps when all items sold (2 orders, 0 active)', async () => {
    const { computeSellThroughRate90d } = await import('../projection-engine');
    const orders = [
      makeOrder({ completedAt: daysAgo(5) }),
      makeOrder({ completedAt: daysAgo(10) }),
    ];
    expect(computeSellThroughRate90d(90, orders, [])).toBe(10000);
  });
});

describe('computeAvgSalePrice90d', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null with no orders', async () => {
    const { computeAvgSalePrice90d } = await import('../projection-engine');
    expect(computeAvgSalePrice90d([])).toBeNull();
  });

  it('computes average correctly', async () => {
    const { computeAvgSalePrice90d } = await import('../projection-engine');
    const orders = [
      makeOrder({ totalCents: 6000, completedAt: daysAgo(5) }),
      makeOrder({ totalCents: 4000, completedAt: daysAgo(10) }),
    ];
    expect(computeAvgSalePrice90d(orders)).toBe(5000);
  });
});

describe('computeEffectiveFeeRate90d', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null with no orders', async () => {
    const { computeEffectiveFeeRate90d } = await import('../projection-engine');
    expect(computeEffectiveFeeRate90d([])).toBeNull();
  });

  it('computes fee rate in basis points', async () => {
    const { computeEffectiveFeeRate90d } = await import('../projection-engine');
    const orders = [makeOrder({
      totalCents: 5000, tfFeesCents: 500, stripeFeesCents: 175, completedAt: daysAgo(5),
    })];
    expect(computeEffectiveFeeRate90d(orders)).toBe(1350);
  });
});

describe('computeAvgDaysToSell90d', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no orders have activation date', async () => {
    const { computeAvgDaysToSell90d } = await import('../projection-engine');
    const orders = [makeOrder({ listingActivatedAt: null, completedAt: daysAgo(5) })];
    expect(computeAvgDaysToSell90d(orders)).toBeNull();
  });

  it('computes average days from activation to sale', async () => {
    const { computeAvgDaysToSell90d } = await import('../projection-engine');
    const completedAt = daysAgo(5);
    const activatedAt = new Date(completedAt.getTime() - 10 * 24 * 60 * 60 * 1000);
    const orders = [makeOrder({ completedAt, listingActivatedAt: activatedAt })];
    expect(computeAvgDaysToSell90d(orders)).toBe(10);
  });
});

describe('computeBreakEven', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null for both when fewer than 3 expenses', async () => {
    const { computeBreakEven } = await import('../projection-engine');
    const result = computeBreakEven(90, 3, [], [makeExpense(), makeExpense()]);
    expect(result.breakEvenRevenueCents).toBeNull();
    expect(result.breakEvenOrders).toBeNull();
  });

  it('returns breakEvenRevenueCents when enough expense data', async () => {
    const { computeBreakEven } = await import('../projection-engine');
    const expenses = [
      makeExpense({ amountCents: 3000, expenseDate: daysAgo(5) }),
      makeExpense({ amountCents: 3000, expenseDate: daysAgo(30) }),
      makeExpense({ amountCents: 3000, expenseDate: daysAgo(60) }),
    ];
    const orders = [
      makeOrder({ totalCents: 5000, tfFeesCents: 500, stripeFeesCents: 175, shippingCostsCents: 0, completedAt: daysAgo(5) }),
    ];
    const result = computeBreakEven(90, 3, orders, expenses);
    expect(result.breakEvenRevenueCents).toBeGreaterThan(0);
  });
});

describe('computeInventoryTurns', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no COGS data', async () => {
    const { computeInventoryTurns } = await import('../projection-engine');
    const orders = [makeOrder({ cogsCents: 0, completedAt: daysAgo(5) })];
    const listings = [makeListing()];
    expect(computeInventoryTurns(90, orders, listings)).toBeNull();
  });

  it('computes turns in basis points', async () => {
    const { computeInventoryTurns } = await import('../projection-engine');
    const orders = [makeOrder({ cogsCents: 3000, completedAt: daysAgo(5) })];
    const listings = [makeListing({ cogsCents: 10000, priceCents: 15000 })];
    expect(computeInventoryTurns(90, orders, listings)).toBe(1000);
  });
});

describe('computePerformingPeriods', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when fewer than 20 orders in trailing 90 days', async () => {
    const { computePerformingPeriods } = await import('../projection-engine');
    const orders = Array.from({ length: 5 }, (_, i) =>
      makeOrder({ completedAt: daysAgo(i + 1) }),
    );
    expect(computePerformingPeriods(orders)).toBeNull();
  });

  it('returns dayOfWeek array of length 7 when gate met', async () => {
    const { computePerformingPeriods } = await import('../projection-engine');
    const orders = Array.from({ length: 25 }, (_, i) =>
      makeOrder({ completedAt: daysAgo((i % 85) + 1) }),
    );
    const result = computePerformingPeriods(orders);
    expect(result).not.toBeNull();
    expect(result!.dayOfWeek).toHaveLength(7);
  });
});

describe('computeDataQualityScore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 0 for brand new account with no orders', async () => {
    const { computeDataQualityScore } = await import('../projection-engine');
    expect(computeDataQualityScore(90, [], new Date())).toBe(0);
  });

  it('increases score with COGS coverage', async () => {
    const { computeDataQualityScore } = await import('../projection-engine');
    const orders = [
      makeOrder({ cogsCents: 1000, completedAt: daysAgo(5) }),
      makeOrder({ cogsCents: 1000, completedAt: daysAgo(10) }),
    ];
    const score = computeDataQualityScore(90, orders, daysAgo(90));
    expect(score).toBeGreaterThan(0);
  });

  it('caps at 100', async () => {
    const { computeDataQualityScore } = await import('../projection-engine');
    const orders = Array.from({ length: 20 }, (_, i) =>
      makeOrder({ cogsCents: 500, completedAt: daysAgo(i + 1) }),
    );
    const score = computeDataQualityScore(90, orders, daysAgo(400));
    expect(score).toBeLessThanOrEqual(100);
  });
});
