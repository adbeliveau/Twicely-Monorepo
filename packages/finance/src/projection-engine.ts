/**
 * Finance Intelligence Layer — pure projection compute engine.
 * All functions are pure: no DB reads inside. Inputs pre-fetched by the job.
 * Financial Center Canonical §6.
 */

import type {
  ProjectionInput,
  ProjectionOutput,
  OrderSummary,
  ExpenseSummary,
  ListingSummary,
  PerformingPeriods,
} from './projection-types';
import { daysAgoFilter, expensesInDays } from './projection-engine-helpers';

// ─── Revenue projection ──────────────────────────────────────────────────────

/**
 * Linear extrapolation of 90-day trailing revenue to a 30-day projection.
 * Returns null when fewer than 3 orders in trailing 90 days.
 */
export function computeProjectedRevenue30d(orders: OrderSummary[]): number | null {
  const trailing = daysAgoFilter(orders, 90);
  if (trailing.length < 3) return null;
  const totalRevenue = trailing.reduce((s, o) => s + o.totalCents, 0);
  return Math.round((totalRevenue / 90) * 30);
}

/**
 * Linear extrapolation of 90-day trailing expenses to a 30-day projection.
 * Returns null when fewer than 3 expense records in trailing 90 days.
 */
export function computeProjectedExpenses30d(expenses: ExpenseSummary[]): number | null {
  const trailing = expensesInDays(expenses, 90);
  if (trailing.length < 3) return null;
  const totalExpenses = trailing.reduce((s, e) => s + e.amountCents, 0);
  return Math.round((totalExpenses / 90) * 30);
}

// ─── Sell-through + pricing ──────────────────────────────────────────────────

/**
 * Returns basis-point sell-through rate (orders / active+sold listings * 10000).
 * Trailing 90-day orders vs current active listing count.
 */
export function computeSellThroughRate90d(
  orders: OrderSummary[],
  activeListings: ListingSummary[],
): number | null {
  const trailing = daysAgoFilter(orders, 90);
  const denominator = trailing.length + activeListings.length;
  if (denominator === 0) return null;
  return Math.round((trailing.length / denominator) * 10000);
}

/** Average sale price over trailing 90 days in cents. */
export function computeAvgSalePrice90d(orders: OrderSummary[]): number | null {
  const trailing = daysAgoFilter(orders, 90);
  if (trailing.length === 0) return null;
  const total = trailing.reduce((s, o) => s + o.totalCents, 0);
  return Math.round(total / trailing.length);
}

/**
 * Effective fee rate as basis points (fees / revenue * 10000).
 * Includes TF + Stripe fees only.
 */
export function computeEffectiveFeeRate90d(orders: OrderSummary[]): number | null {
  const trailing = daysAgoFilter(orders, 90);
  if (trailing.length === 0) return null;
  const revenue = trailing.reduce((s, o) => s + o.totalCents, 0);
  if (revenue === 0) return null;
  const fees = trailing.reduce((s, o) => s + o.tfFeesCents + o.stripeFeesCents, 0);
  return Math.round((fees / revenue) * 10000);
}

/** Average days from listing activation to sale over trailing 90 days. */
export function computeAvgDaysToSell90d(orders: OrderSummary[]): number | null {
  const trailing = daysAgoFilter(orders, 90).filter((o) => o.listingActivatedAt !== null);
  if (trailing.length === 0) return null;
  const totalMs = trailing.reduce((s, o) => {
    const ms = o.completedAt.getTime() - o.listingActivatedAt!.getTime();
    return s + Math.max(0, ms);
  }, 0);
  return Math.round(totalMs / trailing.length / (1000 * 60 * 60 * 24));
}

// ─── Break-even ──────────────────────────────────────────────────────────────

/**
 * Monthly break-even revenue = fixed expenses / (1 - variable cost ratio).
 * Returns null if insufficient expense data (< 3 records in 90 days).
 */
export function computeBreakEven(
  orders: OrderSummary[],
  expenses: ExpenseSummary[],
): { breakEvenRevenueCents: number | null; breakEvenOrders: number | null } {
  const trailing90Expenses = expensesInDays(expenses, 90);
  if (trailing90Expenses.length < 3) {
    return { breakEvenRevenueCents: null, breakEvenOrders: null };
  }

  const monthlyExpenses = Math.round(
    trailing90Expenses.reduce((s, e) => s + e.amountCents, 0) / 3,
  );

  const trailing90Orders = daysAgoFilter(orders, 90);
  if (trailing90Orders.length === 0) {
    return { breakEvenRevenueCents: monthlyExpenses, breakEvenOrders: null };
  }

  const revenue90 = trailing90Orders.reduce((s, o) => s + o.totalCents, 0);
  const fees90 = trailing90Orders.reduce(
    (s, o) => s + o.tfFeesCents + o.stripeFeesCents + o.shippingCostsCents,
    0,
  );
  const variableRatio = revenue90 > 0 ? fees90 / revenue90 : 0;
  const marginRatio = 1 - Math.min(0.99, variableRatio);

  const breakEvenRevenueCents =
    marginRatio > 0 ? Math.round(monthlyExpenses / marginRatio) : null;

  const avgSalePrice = computeAvgSalePrice90d(orders);
  const breakEvenOrders =
    breakEvenRevenueCents !== null && avgSalePrice !== null && avgSalePrice > 0
      ? Math.ceil(breakEvenRevenueCents / avgSalePrice)
      : null;

  return { breakEvenRevenueCents, breakEvenOrders };
}

// ─── Inventory turns ─────────────────────────────────────────────────────────

/**
 * Inventory turns per month in basis points.
 * = (COGS sold per month / avg inventory value per month) * 10000.
 * Returns null if COGS data missing or active inventory is 0.
 */
export function computeInventoryTurns(
  orders: OrderSummary[],
  activeListings: ListingSummary[],
): number | null {
  const trailing90 = daysAgoFilter(orders, 90);
  const cogsSold = trailing90.reduce((s, o) => s + o.cogsCents, 0);
  if (cogsSold === 0) return null;

  const cogsSoldMonthly = cogsSold / 3;

  const inventoryValue = activeListings.reduce(
    (s, l) => s + (l.cogsCents ?? l.priceCents ?? 0),
    0,
  );
  if (inventoryValue === 0) return null;

  return Math.round((cogsSoldMonthly / inventoryValue) * 10000);
}

// ─── Performing periods ──────────────────────────────────────────────────────

/**
 * Day-of-week (0=Sun..6=Sat) average revenue and monthly revenue totals.
 * Returns null if fewer than 20 orders in trailing 90 days.
 */
export function computePerformingPeriods(orders: OrderSummary[]): PerformingPeriods | null {
  const trailing = daysAgoFilter(orders, 90);
  if (trailing.length < 20) return null;

  const dowSum = new Array<number>(7).fill(0);
  const dowCount = new Array<number>(7).fill(0);
  const monthMap = new Map<string, number>();

  for (const o of trailing) {
    const dow = o.completedAt.getUTCDay();
    dowSum[dow] = (dowSum[dow] ?? 0) + o.totalCents;
    dowCount[dow] = (dowCount[dow] ?? 0) + 1;
    const month = o.completedAt.toISOString().slice(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + o.totalCents);
  }

  const dayOfWeek = dowSum.map((sum, i) => {
    const count = dowCount[i] ?? 0;
    return count > 0 ? Math.round(sum / count) : 0;
  });

  const monthlyRevenue = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, revenueCents]) => ({ month, revenueCents }));

  return { dayOfWeek, monthlyRevenue };
}

// ─── Data quality score ──────────────────────────────────────────────────────

/**
 * 0-100 data quality score based on COGS coverage and history depth.
 */
export function computeDataQualityScore(
  orders: OrderSummary[],
  accountCreatedAt: Date,
): number {
  const daysSinceCreated = Math.round(
    (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  const trailing90 = daysAgoFilter(orders, 90);
  const ordersWithCogs = trailing90.filter((o) => o.cogsCents > 0).length;
  const cogsRatio = trailing90.length > 0 ? ordersWithCogs / trailing90.length : 0;
  const cogsScore = Math.round(cogsRatio * 50);

  const historyScore = Math.min(50, Math.round((daysSinceCreated / 180) * 50));

  return cogsScore + historyScore;
}

// ─── Main entry point ────────────────────────────────────────────────────────

import { computeHealthScore } from './projection-health';

/**
 * Compute all projection metrics from pre-fetched input data.
 * Pure function — no DB reads.
 */
export async function computeProjection(input: ProjectionInput): Promise<ProjectionOutput> {
  const { orders, expenses, activeListings, accountCreatedAt } = input;

  const projectedRevenue30dCents = computeProjectedRevenue30d(orders);
  const projectedExpenses30dCents = computeProjectedExpenses30d(expenses);

  const projectedProfit30dCents =
    projectedRevenue30dCents !== null && projectedExpenses30dCents !== null
      ? projectedRevenue30dCents - projectedExpenses30dCents
      : null;

  const sellThroughRate90d = computeSellThroughRate90d(orders, activeListings);
  const avgSalePrice90dCents = computeAvgSalePrice90d(orders);
  const effectiveFeeRate90d = computeEffectiveFeeRate90d(orders);
  const avgDaysToSell90d = computeAvgDaysToSell90d(orders);

  const { breakEvenRevenueCents, breakEvenOrders } = computeBreakEven(orders, expenses);
  const inventoryTurnsPerMonth = computeInventoryTurns(orders, activeListings);
  const performingPeriodsJson = computePerformingPeriods(orders);
  const dataQualityScore = computeDataQualityScore(orders, accountCreatedAt);

  const partialOutput: Partial<ProjectionOutput> = {
    projectedRevenue30dCents,
    projectedExpenses30dCents,
    projectedProfit30dCents,
    sellThroughRate90d,
    avgSalePrice90dCents,
    effectiveFeeRate90d,
    avgDaysToSell90d,
    breakEvenRevenueCents,
    breakEvenOrders,
    inventoryTurnsPerMonth,
    performingPeriodsJson,
    dataQualityScore,
  };

  const healthResult = await computeHealthScore(input, partialOutput);

  return {
    projectedRevenue30dCents,
    projectedExpenses30dCents,
    projectedProfit30dCents,
    sellThroughRate90d,
    avgSalePrice90dCents,
    effectiveFeeRate90d,
    avgDaysToSell90d,
    breakEvenRevenueCents,
    breakEvenOrders,
    inventoryTurnsPerMonth,
    performingPeriodsJson,
    dataQualityScore,
    healthScore: healthResult?.score ?? null,
    healthScoreBreakdownJson: healthResult?.breakdown ?? null,
  };
}
