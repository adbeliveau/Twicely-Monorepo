import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAnalyticsSummary, getAnalyticsTimeSeries, getUserCohortRetention } from '@/lib/queries/admin-analytics';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { AnalyticsCharts } from '@/components/admin/analytics-charts';
import { DollarSign, ShoppingCart, Receipt, TrendingUp, UserPlus, Users, Tag } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Platform Analytics | Twicely Hub',
  robots: { index: false, follow: false },
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function calcChange(current: number, previous: number): { value: number; period: string } | undefined {
  if (previous === 0) return undefined;
  return { value: Math.round(((current - previous) / previous) * 100), period: 'vs prev period' };
}

function retentionColor(pct: number): string {
  if (pct >= 50) return 'bg-success-100 text-success-700';
  if (pct >= 20) return 'bg-warning-100 text-warning-700';
  return 'bg-error-100 text-error-700';
}

export default async function AnalyticsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Analytics')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [summary, gmvSeries, ordersSeries, usersSeries, feesSeries, cohortData] =
    await Promise.all([
      getAnalyticsSummary(30),
      getAnalyticsTimeSeries('gmv', 30),
      getAnalyticsTimeSeries('orders', 30),
      getAnalyticsTimeSeries('users', 30),
      getAnalyticsTimeSeries('fees', 30),
      getUserCohortRetention(6),
    ]);

  const gmvChange = calcChange(summary.gmvCents, summary.gmvPreviousCents);
  const ordersChange = calcChange(summary.orderCount, summary.orderCountPrevious);
  const usersChange = calcChange(summary.newUserCount, summary.newUserCountPrevious);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Platform Analytics"
        description="GMV, take rate, user growth, and cohort retention."
      />

      {/* Section A — KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="GMV (30d)"
          value={formatCents(summary.gmvCents)}
          change={gmvChange}
          icon={<DollarSign className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          label="Orders (30d)"
          value={summary.orderCount}
          change={ordersChange}
          icon={<ShoppingCart className="h-5 w-5" />}
          color="info"
        />
        <StatCard
          label="Avg Order Value"
          value={formatCents(summary.averageOrderCents)}
          icon={<Receipt className="h-5 w-5" />}
          color="default"
        />
        <StatCard
          label="Fee Revenue (30d)"
          value={formatCents(summary.totalFeeRevenueCents)}
          icon={<DollarSign className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          label="Take Rate"
          value={formatBps(summary.takeRateBps)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="info"
        />
        <StatCard
          label="New Users (30d)"
          value={summary.newUserCount}
          change={usersChange}
          icon={<UserPlus className="h-5 w-5" />}
          color="info"
        />
        <StatCard
          label="New Sellers (30d)"
          value={summary.newSellerCount}
          icon={<Users className="h-5 w-5" />}
          color="default"
        />
        <StatCard
          label="Active Listings"
          value={summary.activeListingCount.toLocaleString()}
          icon={<Tag className="h-5 w-5" />}
          color="default"
        />
      </div>

      {/* Section B — Trend Charts */}
      <AnalyticsCharts
        initialData={{
          gmv: gmvSeries,
          orders: ordersSeries,
          users: usersSeries,
          fees: feesSeries,
        }}
      />

      {/* Section C — Cohort Retention Table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Cohort Retention
          </h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Percentage of users who placed an order in each subsequent month after signup
          </p>
        </div>
        <div className="overflow-x-auto p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="pb-2 pr-4 font-medium">Cohort Month</th>
                <th className="pb-2 pr-4 font-medium">Cohort Size</th>
                <th className="pb-2 pr-4 font-medium">Month 1</th>
                <th className="pb-2 pr-4 font-medium">Month 2</th>
                <th className="pb-2 pr-4 font-medium">Month 3</th>
                <th className="pb-2 pr-4 font-medium">Month 4</th>
                <th className="pb-2 pr-4 font-medium">Month 5</th>
                <th className="pb-2 font-medium">Month 6</th>
              </tr>
            </thead>
            <tbody>
              {cohortData.map((row) => (
                <tr key={row.cohortMonth} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 pr-4 font-medium text-gray-900">{row.cohortMonth}</td>
                  <td className="py-2 pr-4 text-gray-600">{row.cohortSize.toLocaleString()}</td>
                  {[0, 1, 2, 3, 4, 5].map((idx) => {
                    const pct = row.retentionPcts[idx];
                    return (
                      <td key={idx} className="py-2 pr-4">
                        {pct != null ? (
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${retentionColor(pct)}`}>
                            {pct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {cohortData.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-sm text-gray-400">
                    No cohort data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section D — Link to Sellers */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Seller Performance
            </h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              GMV, cancel rate, return rate, and ratings by seller
            </p>
          </div>
          <Link
            href="/analytics/sellers"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            View Seller Performance Table
          </Link>
        </div>
      </div>
    </div>
  );
}
