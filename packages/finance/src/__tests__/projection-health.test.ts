/**
 * Tests for finance intelligence layer health score and integration.
 * Financial Center Canonical §6.3.
 * Part 2: computeHealthScore + computeProjection integration.
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

import type { OrderSummary, ExpenseSummary, ListingSummary, ProjectionInput } from '../projection-types';

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

function makeInput(
  orders: OrderSummary[],
  expenses: ExpenseSummary[] = [],
  listings: ListingSummary[] = [],
  accountCreatedAt: Date = daysAgo(365),
): ProjectionInput {
  return { orders, expenses, activeListings: listings, accountCreatedAt };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeHealthScore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when account is younger than 60 days', async () => {
    const { computeHealthScore } = await import('../projection-health');
    // 10 orders in trailing 90 days, but account only 30 days old
    const orders = Array.from({ length: 10 }, (_, i) =>
      makeOrder({ completedAt: daysAgo(i + 1) }),
    );
    const result = await computeHealthScore(
      makeInput(orders, [], [], daysAgo(30)),
      {},
    );
    expect(result).toBeNull();
  });

  it('returns null when fewer than 10 orders in trailing 90 days', async () => {
    const { computeHealthScore } = await import('../projection-health');
    // Account 90 days old, but only 5 orders
    const orders = Array.from({ length: 5 }, (_, i) =>
      makeOrder({ completedAt: daysAgo(i + 1) }),
    );
    const result = await computeHealthScore(
      makeInput(orders, [], [], daysAgo(90)),
      {},
    );
    expect(result).toBeNull();
  });

  it('returns score 0-100 and breakdown when data gate met', async () => {
    const { computeHealthScore } = await import('../projection-health');
    const orders = Array.from({ length: 15 }, (_, i) =>
      makeOrder({ totalCents: 5000, completedAt: daysAgo(i + 1) }),
    );
    const expenses = [makeExpense({ amountCents: 500, expenseDate: daysAgo(1) })];
    const result = await computeHealthScore(
      makeInput(orders, expenses, [], daysAgo(180)),
      { sellThroughRate90d: 7000, avgDaysToSell90d: 10 },
    );
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(0);
    expect(result!.score).toBeLessThanOrEqual(100);
    expect(result!.breakdown).toHaveProperty('profitMarginTrend');
    expect(result!.breakdown).toHaveProperty('expenseRatio');
    expect(result!.breakdown).toHaveProperty('sellThroughVelocity');
    expect(result!.breakdown).toHaveProperty('inventoryAge');
    expect(result!.breakdown).toHaveProperty('revenueGrowth');
  });

  it('reads weights from platform_settings', async () => {
    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');
    const { computeHealthScore } = await import('../projection-health');
    const orders = Array.from({ length: 15 }, (_, i) =>
      makeOrder({ totalCents: 5000, completedAt: daysAgo(i + 1) }),
    );
    await computeHealthScore(
      makeInput(orders, [], [], daysAgo(180)),
      {},
    );
    expect(getPlatformSetting).toHaveBeenCalledWith(
      'finance.healthScore.weights.profitMarginTrend',
      25,
    );
    expect(getPlatformSetting).toHaveBeenCalledWith(
      'finance.healthScore.weights.expenseRatio',
      20,
    );
  });
});

describe('computeProjection — integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns full output with all fields populated for healthy data', async () => {
    const { computeProjection } = await import('../projection-engine');
    const orders = Array.from({ length: 20 }, (_, i) =>
      makeOrder({
        totalCents: 5000,
        cogsCents: 1000,
        tfFeesCents: 500,
        stripeFeesCents: 175,
        shippingCostsCents: 300,
        completedAt: daysAgo((i % 85) + 1),
        listingActivatedAt: daysAgo((i % 85) + 11),
      }),
    );
    const expenses = Array.from({ length: 5 }, (_, i) =>
      makeExpense({ amountCents: 1000, expenseDate: daysAgo(i * 15 + 1) }),
    );
    const listings = [makeListing({ cogsCents: 5000, priceCents: 10000 })];

    const result = await computeProjection(
      makeInput(orders, expenses, listings, daysAgo(400)),
    );

    expect(result).toHaveProperty('projectedRevenue30dCents');
    expect(result).toHaveProperty('projectedExpenses30dCents');
    expect(result).toHaveProperty('sellThroughRate90d');
    expect(result).toHaveProperty('avgSalePrice90dCents');
    expect(result).toHaveProperty('effectiveFeeRate90d');
    expect(result).toHaveProperty('avgDaysToSell90d');
    expect(result).toHaveProperty('breakEvenRevenueCents');
    expect(result).toHaveProperty('inventoryTurnsPerMonth');
    expect(result).toHaveProperty('performingPeriodsJson');
    expect(result).toHaveProperty('dataQualityScore');
    expect(result).toHaveProperty('healthScore');
    expect(result).toHaveProperty('healthScoreBreakdownJson');
  });

  it('returns null for projected revenue with insufficient orders', async () => {
    const { computeProjection } = await import('../projection-engine');
    const orders = [makeOrder({ completedAt: daysAgo(5) })];

    const result = await computeProjection(
      makeInput(orders, [], [], daysAgo(365)),
    );

    expect(result.projectedRevenue30dCents).toBeNull();
  });
});
