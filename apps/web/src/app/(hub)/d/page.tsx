import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getDashboardKPIs, getDashboardCharts, getRecentAdminActivity } from '@/lib/queries/admin-dashboard';
import { getLocalDashboardStats } from '@/lib/queries/local-dashboard-stats';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { DashboardBarChart } from '@/components/admin/dashboard-bar-chart';
import { DashboardPeriodToggle } from '@/components/admin/dashboard-period-toggle';
import { DashboardQuickActions } from '@/components/admin/dashboard-quick-actions';
import { ShoppingCart, DollarSign, Headphones, Tag, Users, UserPlus, MapPin } from 'lucide-react';

export const metadata: Metadata = { title: 'Dashboard | Twicely Hub' };

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
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
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        description="Platform overview"
        actions={<DashboardPeriodToggle currentPeriod={period} />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Orders Today" value={kpis.ordersToday} icon={<ShoppingCart className="h-5 w-5" />} color="info" />
        <StatCard label="Revenue Today" value={formatCents(kpis.revenueToday)} icon={<DollarSign className="h-5 w-5" />} color="success" />
        <StatCard label="Open Cases" value={kpis.openCases} icon={<Headphones className="h-5 w-5" />} color="warning" />
        <StatCard label="Active Listings" value={kpis.activeListings.toLocaleString()} icon={<Tag className="h-5 w-5" />} color="default" />
        <StatCard label="Active Users (24h)" value={kpis.activeUsers} icon={<Users className="h-5 w-5" />} color="info" />
        <StatCard label="Signups Today" value={kpis.signupsToday} icon={<UserPlus className="h-5 w-5" />} color="success" />
        <StatCard label="Local Meetups Today" value={localStats.scheduledToday} icon={<MapPin className="h-5 w-5" />} color="default" />
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick Actions</h2>
        <DashboardQuickActions />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">GMV Trend ({periodLabel})</h2>
          <DashboardBarChart
            data={charts.gmv}
            formatKind="cents"
            barColor="bg-green-500"
            emptyMessage="No GMV data yet"
          />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">Orders Trend ({periodLabel})</h2>
          <DashboardBarChart
            data={charts.orders}
            barColor="bg-blue-500"
            emptyMessage="No order data yet"
          />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">New Users ({periodLabel})</h2>
          <DashboardBarChart
            data={charts.users}
            barColor="bg-purple-500"
            emptyMessage="No signup data yet"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-primary">Recent Activity</h2>
        <div className="space-y-2">
          {activity.map((event) => (
            <div key={event.id} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
              <div className="text-sm">
                <span className="font-medium text-gray-800">{event.action}</span>
                <span className="ml-2 text-gray-500">{event.subject}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  event.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                  event.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>{event.severity}</span>
                <span className="text-xs text-gray-400">
                  {event.createdAt.toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
          {activity.length === 0 && <p className="text-sm text-gray-400">No recent activity</p>}
        </div>
      </div>
    </div>
  );
}
