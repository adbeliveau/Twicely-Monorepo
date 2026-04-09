/**
 * PRO intelligence dashboard sub-component.
 * Renders 10 intelligence cards in Financial Center Canonical §7 order.
 */

import { GoalTrackerCard } from '@/components/finance/intelligence/goal-tracker-card';
import { RevenueVelocityCard } from '@/components/finance/intelligence/revenue-velocity-card';
import { HealthScoreCard } from '@/components/finance/intelligence/health-score-card';
import { ProfitByCategoryCard } from '@/components/finance/intelligence/profit-by-category-card';
import { TaxWithholdingCard } from '@/components/finance/intelligence/tax-withholding-card';
import { QuarterlyTaxCard } from '@/components/finance/intelligence/quarterly-tax-card';
import { CostTrendsCard } from '@/components/finance/intelligence/cost-trends-card';
import { DeadStockCard } from '@/components/finance/intelligence/dead-stock-card';
import { CapitalEfficiencyCard } from '@/components/finance/intelligence/capital-efficiency-card';
import { PerformingPeriodsCard } from '@/components/finance/intelligence/performing-periods-card';
import {
  getCurrentMonthRevenue,
  getCurrentMonthOrderCount,
  getProfitByCategory,
  getExpenseTrends,
  getStaleListings,
  getFinancialProjection,
  getNetProfitYtd,
} from '@/lib/queries/finance-intelligence';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type { HealthScoreBreakdown, PerformingPeriods } from '@twicely/finance/projection-types';

interface ProIntelligenceDashboardProps {
  userId: string;
  sellerProfileId: string;
  financeGoals: { revenueGoalCents?: number | null; profitGoalCents?: number | null } | null;
}

export async function ProIntelligenceDashboard({
  userId,
  sellerProfileId,
  financeGoals,
}: ProIntelligenceDashboardProps) {
  const now = new Date();
  const currentDayOfMonth = now.getUTCDate();

  const [
    currentMonthRevenueCents,
    currentMonthOrderCount,
    profitByCategory,
    expenseTrends,
    staleListings,
    projection,
    netProfitYtdCents,
    estimatedTaxRateBps,
  ] = await Promise.all([
    getCurrentMonthRevenue(userId),
    getCurrentMonthOrderCount(userId),
    getProfitByCategory(userId),
    getExpenseTrends(userId, 6),
    getStaleListings(userId),
    getFinancialProjection(sellerProfileId),
    getNetProfitYtd(userId),
    getPlatformSetting<number>('finance.tax.estimatedRateBps', 2500),
  ]);

  // Estimate current month profit for goal tracker
  const currentMonthProfitCents =
    currentMonthRevenueCents -
    (expenseTrends[expenseTrends.length - 1]?.totalCents ?? 0);

  // Build category profit rows with names (fallback to ID if category not resolved)
  const categoryRows = profitByCategory.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryId ?? 'Uncategorized',
    soldCount: r.soldCount,
    revenueCents: r.revenueCents,
    cogsCents: r.cogsCents,
    profitCents: r.revenueCents - r.cogsCents,
    marginPercent:
      r.revenueCents > 0
        ? Math.round(((r.revenueCents - r.cogsCents) / r.revenueCents) * 10000) / 100
        : 0,
  }));

  const totalWithCogs = profitByCategory.reduce((s, r) => s + r.soldCount, 0);

  const expenseTrendRows = expenseTrends.map((e) => ({
    month: e.month,
    totalCents: e.totalCents,
    topCategory: e.topCategory,
  }));

  const staleListingRows = staleListings.map((l) => ({
    id: l.id,
    title: l.title,
    slug: l.slug,
    priceCents: l.priceCents,
    activatedAt: l.activatedAt,
    daysActive: l.daysActive,
  }));

  return (
    <div className="space-y-4">
      {/* Goal Tracker → Velocity → Health Score → Profit by Category */}
      <GoalTrackerCard
        sellerProfileId={sellerProfileId}
        financeGoals={financeGoals}
        currentMonthRevenueCents={currentMonthRevenueCents}
        currentMonthProfitCents={currentMonthProfitCents}
      />
      <RevenueVelocityCard
        sellerProfileId={sellerProfileId}
        currentMonthRevenueCents={currentMonthRevenueCents}
        currentMonthOrderCount={currentMonthOrderCount}
        currentDayOfMonth={currentDayOfMonth}
      />
      <HealthScoreCard
        sellerProfileId={sellerProfileId}
        healthScore={projection?.healthScore ?? null}
        healthScoreBreakdownJson={
          (projection?.healthScoreBreakdownJson as HealthScoreBreakdown | null) ?? null
        }
      />
      <ProfitByCategoryCard
        sellerProfileId={sellerProfileId}
        rows={categoryRows}
        totalWithCogs={totalWithCogs}
      />
      {/* Tax cards */}
      <TaxWithholdingCard
        sellerProfileId={sellerProfileId}
        netProfitYtdCents={netProfitYtdCents}
        estimatedTaxRateBps={Number(estimatedTaxRateBps)}
      />
      <QuarterlyTaxCard
        sellerProfileId={sellerProfileId}
        quarters={[]}
      />
      {/* Cost Trends → Dead Stock → Capital Efficiency → Performing Periods */}
      <CostTrendsCard
        sellerProfileId={sellerProfileId}
        monthlyExpenses={expenseTrendRows}
      />
      <DeadStockCard
        sellerProfileId={sellerProfileId}
        staleListings={staleListingRows}
      />
      <CapitalEfficiencyCard
        sellerProfileId={sellerProfileId}
        inventoryTurnsPerMonth={projection?.inventoryTurnsPerMonth ?? null}
        breakEvenRevenueCents={projection?.breakEvenRevenueCents ?? null}
        breakEvenOrders={projection?.breakEvenOrders ?? null}
        avgSalePrice90dCents={projection?.avgSalePrice90dCents ?? null}
      />
      <PerformingPeriodsCard
        sellerProfileId={sellerProfileId}
        performingPeriodsJson={
          (projection?.performingPeriodsJson as PerformingPeriods | null) ?? null
        }
      />
    </div>
  );
}
