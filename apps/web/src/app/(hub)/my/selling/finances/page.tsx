import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getSellerProfile } from '@/lib/queries/seller';
import { getSellerStripeStatus } from '@/lib/queries/stripe-seller';
import { getFinanceDashboardAction } from '@/lib/actions/finance-center';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { AlertCircle } from 'lucide-react';
import { KpiCard } from '@/components/finance/kpi-card';
import { RevenueChart } from '@/components/finance/revenue-chart';
import { PnlSummary } from '@/components/finance/pnl-summary';
import { ExpenseSummaryCard } from '@/components/finance/expense-summary-card';
import { formatCentsToDollars } from '@twicely/finance/format';
import { Badge } from '@twicely/ui/badge';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Finances | Twicely',
  robots: 'noindex',
};

export default async function FinancesPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/finances');
  }

  const [sellerProfile, stripeStatus] = await Promise.all([
    getSellerProfile(session.userId),
    getSellerStripeStatus(session.userId),
  ]);

  if (!sellerProfile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Finances</h1>
        <Card>
          <CardHeader>
            <CardTitle>Start Selling First</CardTitle>
            <CardDescription>
              Create your first listing to access the financial center.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/my/selling/listings/new">Create Listing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stripeStatus?.payoutsEnabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Finances</h1>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <CardTitle>Complete Payment Setup</CardTitle>
            </div>
            <CardDescription>
              Connect your bank account to view your financial data and receive payouts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/my/selling/onboarding">Set Up Payouts</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [dashResult, financeProAnnualCents] = await Promise.all([
    getFinanceDashboardAction(),
    getPlatformSetting<number>('finance.pricing.pro.annualCents', 1199),
  ]);

  if (!dashResult.success) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Finances</h1>
        <p className="text-sm text-muted-foreground">{dashResult.error}</p>
      </div>
    );
  }

  const { kpis, timeSeries, expenses, mileage, financeTier } = dashResult;
  const hasOrders = kpis.totalOrderCount > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Finances</h1>
        <div className="flex items-center gap-2">
          {financeTier === 'FREE' ? (
            <Link href="/my/selling/subscription">
              <Badge variant="outline" className="cursor-pointer text-primary border-primary hover:bg-primary/5">
                Upgrade to Finance Pro — {formatCentsToDollars(financeProAnnualCents)}/mo
              </Badge>
            </Link>
          ) : (
            <Badge variant="default">Finance Pro</Badge>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/my/selling/finances/payouts">Payout Settings</Link>
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {!hasOrders && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Your financial data will appear here after your first sale.
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Gross revenue (30 days)"
          valueCents={kpis.grossRevenueCents}
          subtitle={`${kpis.totalOrderCount} order${kpis.totalOrderCount !== 1 ? 's' : ''}`}
        />
        <KpiCard
          title="Net earnings"
          valueCents={kpis.netEarningsCents}
          subtitle="After fees and shipping"
        />
        <KpiCard
          title="Total fees"
          valueCents={kpis.totalFeesCents}
          subtitle={`Effective rate: ${kpis.effectiveFeeRatePercent.toFixed(2)}%`}
        />
        <KpiCard
          title="Available for payout"
          valueCents={kpis.availableForPayoutCents}
          subtitle={
            kpis.pendingCents > 0
              ? `${formatCentsToDollars(kpis.pendingCents)} pending`
              : undefined
          }
        />
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart data={timeSeries} />
        </CardContent>
      </Card>

      {/* P&L Summary */}
      <PnlSummary kpis={kpis} expenses={expenses} mileage={mileage} financeTier={financeTier} />

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link href="/my/selling/finances/transactions" className="text-sm text-primary underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {kpis.totalOrderCount === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {timeSeries.slice(-5).map((d) => (
                <div key={d.date} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                  <span className="text-muted-foreground">{d.date}</span>
                  <span>{formatCentsToDollars(d.revenueCents)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense Summary */}
      <ExpenseSummaryCard expenses={expenses} financeTier={financeTier} />

      {/* Quick Links */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/my/selling/finances/transactions">Transactions</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/my/selling/finances/payouts">Payouts</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/my/selling/finances/statements">Statements</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/my/selling/finances/platforms">Platform Revenue</Link>
            </Button>
            {financeTier === 'PRO' && (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href="/my/selling/finances/expenses">Expenses</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/my/selling/finances/mileage">Mileage</Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
