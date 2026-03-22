import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  getDashboardKPIs,
  getDashboardCharts,
  getRecentAdminActivity,
} from '@/lib/queries/admin-dashboard';
import { getLocalDashboardStats } from '@/lib/queries/local-dashboard-stats';
import { DashboardPeriodToggle } from '@/components/admin/dashboard-period-toggle';
import {
  DashboardStatCard,
  RequiresAttention,
  DashboardQuickLinks,
  DashboardChartCard,
} from '@/components/admin/dashboard-cards';
import {
  DollarIcon,
  ShoppingBagIcon,
  UsersIcon,
  AlertIcon,
} from '@/components/admin/dashboard-icons';

export const metadata: Metadata = { title: 'Dashboard | Twicely Hub' };

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
  })}`;
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: Props) {
  await staffAuthorize();

  const raw = await searchParams;
  const rawPeriod = Array.isArray(raw.period) ? raw.period[0] : raw.period;
  const period: '7d' | '30d' = rawPeriod === '30d' ? '30d' : '7d';

  const [kpis, charts, activity, localStats] = await Promise.all([
    getDashboardKPIs(),
    getDashboardCharts(period),
    getRecentAdminActivity(10),
    getLocalDashboardStats(),
  ]);

  const periodLabel = period === '7d' ? '7d' : '30d';

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Platform Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Overview of platform metrics and activity
          </p>
        </div>
        <DashboardPeriodToggle currentPeriod={period} />
      </div>

      {/* Stats Grid -- V2 card style */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          label="GMV Today"
          value={formatCents(kpis.revenueToday)}
          subtitle={`${kpis.ordersToday} orders today`}
          iconBg="bg-brand-100 dark:bg-brand-900/20"
          iconColor="text-brand-600 dark:text-brand-400"
          icon={<DollarIcon />}
        />
        <DashboardStatCard
          label="Orders Today"
          value={String(kpis.ordersToday)}
          subtitle={`${kpis.openCases} open cases`}
          iconBg="bg-green-100 dark:bg-green-900/20"
          iconColor="text-green-600 dark:text-green-400"
          icon={<ShoppingBagIcon />}
        />
        <DashboardStatCard
          label="Active Users (24h)"
          value={kpis.activeUsers.toLocaleString()}
          subtitle={`${kpis.signupsToday} new today`}
          iconBg="bg-purple-100 dark:bg-purple-900/20"
          iconColor="text-purple-600 dark:text-purple-400"
          icon={<UsersIcon />}
        />
        <DashboardStatCard
          label="Open Cases"
          value={String(kpis.openCases)}
          subtitle={`${localStats.scheduledToday} local meetups today`}
          iconBg="bg-red-100 dark:bg-red-900/20"
          iconColor="text-red-600 dark:text-red-400"
          icon={<AlertIcon />}
          link={{ href: '/mod/disputes', label: 'View all' }}
        />
      </div>

      {/* Requires Attention + Quick Links */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RequiresAttention
          openCases={kpis.openCases}
          scheduledMeetups={localStats.scheduledToday}
        />
        <DashboardQuickLinks />
      </div>

      {/* Charts */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <DashboardChartCard
          title={`GMV Trend (${periodLabel})`}
          data={charts.gmv}
          formatKind="cents"
          barColor="bg-green-500"
        />
        <DashboardChartCard
          title={`Orders Trend (${periodLabel})`}
          data={charts.orders}
          barColor="bg-blue-500"
        />
        <DashboardChartCard
          title={`New Users (${periodLabel})`}
          data={charts.users}
          barColor="bg-purple-500"
        />
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
          Recent Activity
        </h2>
        <div className="space-y-2">
          {activity.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0 dark:border-gray-700"
            >
              <div className="text-sm">
                <span className="font-medium text-gray-800 dark:text-white">
                  {event.action}
                </span>
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  {event.subject}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    event.severity === 'CRITICAL'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : event.severity === 'HIGH'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                  }`}
                >
                  {event.severity}
                </span>
                <span className="text-xs text-gray-400">
                  {event.createdAt.toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
          {activity.length === 0 && (
            <p className="text-sm text-gray-400">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
