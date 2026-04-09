/**
 * Finance Intelligence Layer — health score engine.
 * Financial Center Canonical §6.3 — 5-component weighted composite.
 *
 * Data gate: returns null if < 60 days account history OR < 10 orders.
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { ProjectionInput, ProjectionOutput, HealthScoreBreakdown } from './projection-types';
import { daysAgoFilter } from './projection-engine-helpers';

// ─── Data gate ───────────────────────────────────────────────────────────────

const MIN_ACCOUNT_DAYS = 60;
const MIN_ORDER_COUNT = 10;

// ─── Component scorers (0-100 each) ─────────────────────────────────────────

function scoreProfileMarginTrend(orders: ReturnType<typeof daysAgoFilter>): number {
  if (orders.length === 0) return 0;
  // Split into two 45-day halves; compare revenue growth
  const midpoint = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const recent = orders.filter((o) => o.completedAt >= midpoint);
  const older = orders.filter((o) => o.completedAt < midpoint);
  if (older.length === 0) return 50; // not enough history to compare
  const recentAvg = recent.length > 0
    ? recent.reduce((s, o) => s + o.totalCents, 0) / recent.length
    : 0;
  const olderAvg = older.reduce((s, o) => s + o.totalCents, 0) / older.length;
  if (olderAvg === 0) return recentAvg > 0 ? 100 : 50;
  const growth = (recentAvg - olderAvg) / olderAvg;
  // Map -50%..+50% → 0..100
  return Math.max(0, Math.min(100, Math.round((growth + 0.5) * 100)));
}

function scoreExpenseRatio(
  orders: ReturnType<typeof daysAgoFilter>,
  expenses: { amountCents: number }[],
): number {
  const revenue = orders.reduce((s, o) => s + o.totalCents, 0);
  if (revenue === 0) return 50;
  const totalExpenses = expenses.reduce((s, e) => s + e.amountCents, 0);
  const ratio = totalExpenses / revenue;
  // < 20% expense ratio = 100, > 80% = 0
  return Math.max(0, Math.min(100, Math.round((1 - Math.max(0, ratio - 0.2) / 0.6) * 100)));
}

function scoreSellThroughVelocity(sellThroughRate90dBps: number | null | undefined): number {
  if (sellThroughRate90dBps === null || sellThroughRate90dBps === undefined) return 0;
  // 10000 bps = 100% sell-through → 100 score; 0 bps → 0 score
  return Math.max(0, Math.min(100, Math.round(sellThroughRate90dBps / 100)));
}

function scoreInventoryAge(avgDaysToSell90d: number | null | undefined): number {
  if (avgDaysToSell90d === null || avgDaysToSell90d === undefined) return 50;
  // < 7 days = 100; > 60 days = 0
  return Math.max(0, Math.min(100, Math.round((1 - Math.max(0, avgDaysToSell90d - 7) / 53) * 100)));
}

function scoreRevenueGrowth(orders: ReturnType<typeof daysAgoFilter>): number {
  if (orders.length < 2) return 50;
  const sorted = [...orders].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
  const first = sorted[0]!.totalCents;
  const last = sorted[sorted.length - 1]!.totalCents;
  if (first === 0) return last > 0 ? 100 : 50;
  const growth = (last - first) / first;
  return Math.max(0, Math.min(100, Math.round((growth + 0.5) * 100)));
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface HealthScoreResult {
  score: number;
  breakdown: HealthScoreBreakdown;
}

export async function computeHealthScore(
  input: ProjectionInput,
  metrics: Partial<ProjectionOutput>,
): Promise<HealthScoreResult | null> {
  const { accountCreatedAt, orders } = input;

  const daysSinceCreated = Math.round(
    (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const trailing90 = orders.filter((o) => o.completedAt >= cutoff);

  // Data gate
  if (daysSinceCreated < MIN_ACCOUNT_DAYS || trailing90.length < MIN_ORDER_COUNT) {
    return null;
  }

  // Load weights from platform_settings
  const [wMargin, wExpense, wSellThrough, wInventory, wGrowth] = await Promise.all([
    getPlatformSetting<number>('finance.healthScore.weights.profitMarginTrend', 25),
    getPlatformSetting<number>('finance.healthScore.weights.expenseRatio', 20),
    getPlatformSetting<number>('finance.healthScore.weights.sellThroughVelocity', 20),
    getPlatformSetting<number>('finance.healthScore.weights.inventoryAge', 20),
    getPlatformSetting<number>('finance.healthScore.weights.revenueGrowth', 15),
  ]);

  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const expensesIn90 = input.expenses.filter((e) => e.expenseDate >= cutoff90);

  const breakdown: HealthScoreBreakdown = {
    profitMarginTrend: scoreProfileMarginTrend(trailing90),
    expenseRatio: scoreExpenseRatio(trailing90, expensesIn90),
    sellThroughVelocity: scoreSellThroughVelocity(metrics.sellThroughRate90d),
    inventoryAge: scoreInventoryAge(metrics.avgDaysToSell90d),
    revenueGrowth: scoreRevenueGrowth(trailing90),
  };

  const totalWeight = Number(wMargin) + Number(wExpense) + Number(wSellThrough) + Number(wInventory) + Number(wGrowth);
  const score = totalWeight > 0
    ? Math.round(
        (breakdown.profitMarginTrend * Number(wMargin) +
          breakdown.expenseRatio * Number(wExpense) +
          breakdown.sellThroughVelocity * Number(wSellThrough) +
          breakdown.inventoryAge * Number(wInventory) +
          breakdown.revenueGrowth * Number(wGrowth)) /
          totalWeight,
      )
    : 0;

  return { score: Math.max(0, Math.min(100, score)), breakdown };
}
