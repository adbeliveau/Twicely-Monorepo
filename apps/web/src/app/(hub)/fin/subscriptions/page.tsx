// NAV_ENTRY: /fin/subscriptions — Platform Subscriptions Overview
import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSubscriptionStats, getRecentSubscriptionChanges } from '@/lib/queries/admin-subscriptions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { Users, TrendingUp } from 'lucide-react';

export const metadata: Metadata = { title: 'Subscriptions | Twicely Hub' };

const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  TRIALING: 'bg-blue-100 text-blue-700',
  PAST_DUE: 'bg-yellow-100 text-yellow-700',
  CANCELED: 'bg-gray-100 text-gray-500',
  PAUSED: 'bg-orange-100 text-orange-700',
  PENDING: 'bg-gray-100 text-gray-500',
};

export default async function SubscriptionsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Subscription')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [stats, recentChanges] = await Promise.all([
    getSubscriptionStats(),
    getRecentSubscriptionChanges(50),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Subscriptions" description="Platform subscription metrics (read-only)" />

      {/* Top KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        <StatCard label="Total Active" value={String(stats.totalActiveSubscriptions)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Finance Pro" value={String(stats.finance.PRO)} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      {/* Tier distribution */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Store */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Store Subscriptions</h3>
          <dl className="space-y-1 text-sm">
            {(['NONE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE'] as const).map((tier) => (
              <div key={tier} className="flex justify-between">
                <dt className="text-gray-500">{tier}</dt>
                <dd className="font-medium">{stats.store[tier]}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Crosslister */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Crosslister Subscriptions</h3>
          <dl className="space-y-1 text-sm">
            {(['NONE', 'FREE', 'LITE', 'PRO'] as const).map((tier) => (
              <div key={tier} className="flex justify-between">
                <dt className="text-gray-500">{tier}</dt>
                <dd className="font-medium">{stats.lister[tier]}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Finance + Automation */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Other Subscriptions</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Finance FREE</dt><dd className="font-medium">{stats.finance.FREE}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Finance PRO</dt><dd className="font-medium">{stats.finance.PRO}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Automation</dt><dd className="font-medium">{stats.automation.active}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Bundle STARTER</dt><dd className="font-medium">{stats.bundle.STARTER}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Bundle PRO</dt><dd className="font-medium">{stats.bundle.PRO}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Bundle POWER</dt><dd className="font-medium">{stats.bundle.POWER}</dd></div>
          </dl>
        </div>
      </div>

      {/* Recent changes */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">Recent Subscription Changes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary/5 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-primary/70">Seller</th>
                <th className="px-3 py-2 font-medium text-primary/70">Axis</th>
                <th className="px-3 py-2 font-medium text-primary/70">Tier</th>
                <th className="px-3 py-2 font-medium text-primary/70">Status</th>
                <th className="px-3 py-2 font-medium text-primary/70">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentChanges.map((c, i) => (
                <tr key={`${c.sellerProfileId}-${c.axis}-${i}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    {c.userId ? (
                      <Link href={`/usr/${c.userId}`} className="text-primary hover:text-primary/80">
                        {c.userName ?? c.userId}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-gray-400">{c.sellerProfileId}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{c.axis}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium">{c.tier}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{c.updatedAt.toLocaleDateString()}</td>
                </tr>
              ))}
              {recentChanges.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-400">No recent changes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
