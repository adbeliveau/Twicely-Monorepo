/**
 * FREE tier intelligence dashboard sub-component.
 * Shows 3 KPIs + velocity teaser + health score teaser + PRO upgrade CTA.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';
import Link from 'next/link';
import { KpiCard } from '@/components/finance/kpi-card';
import { VelocityTeaser } from '@/components/finance/intelligence/velocity-teaser';
import { HealthScoreTeaser } from '@/components/finance/intelligence/health-score-teaser';
import { getCurrentMonthOrderCount } from '@/lib/queries/finance-intelligence';
import { formatCentsToDollars } from '@twicely/finance/format';

interface FreeIntelligenceDashboardProps {
  userId: string;
  grossRevenueCents: number;
  netEarningsCents: number;
  totalFeesCents: number;
  financeProAnnualCents: number;
}

export async function FreeIntelligenceDashboard({
  userId,
  grossRevenueCents,
  netEarningsCents,
  totalFeesCents,
  financeProAnnualCents,
}: FreeIntelligenceDashboardProps) {
  const orderCount = await getCurrentMonthOrderCount(userId);

  return (
    <div className="space-y-4">
      {/* 3 KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="Gross revenue (30 days)"
          valueCents={grossRevenueCents}
        />
        <KpiCard
          title="Net earnings"
          valueCents={netEarningsCents}
          subtitle="After fees and shipping"
        />
        <KpiCard
          title="Total fees"
          valueCents={totalFeesCents}
        />
      </div>

      {/* Intelligence teasers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <VelocityTeaser orderCountThisMonth={orderCount} />
        <HealthScoreTeaser />
      </div>

      {/* PRO upgrade CTA */}
      <Card className="border-primary/50">
        <CardHeader>
          <CardTitle>Unlock Finance Pro Intelligence</CardTitle>
          <CardDescription>
            Get 10 intelligent cards: Goal Tracker, Revenue Velocity, Health Score,
            Profit by Category, Tax Estimates, Cost Trends, Dead Stock alerts, and more.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/my/selling/subscription">
              Upgrade to Finance Pro — {formatCentsToDollars(financeProAnnualCents)}/mo
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
