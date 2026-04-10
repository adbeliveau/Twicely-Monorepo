import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSearchAnalytics } from '@/lib/queries/admin-search-opensearch';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Search Analytics | Twicely Hub' };

export default async function SearchAnalyticsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const analytics = await getSearchAnalytics(7);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <Link href="/cfg/search" className="hover:text-blue-600">Search Engine</Link>
        <span>/</span>
        <span className="text-gray-900">Analytics</span>
      </div>

      <AdminPageHeader
        title="Search Analytics"
        description="Query telemetry, top searches, zero-result rates, and engine performance (last 7 days)."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-500">Total Queries</p>
          <p className="mt-1 text-2xl font-semibold">{analytics.totalQueries.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-500">Avg Latency</p>
          <p className="mt-1 text-2xl font-semibold">{analytics.avgLatencyMs}ms</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-500">Zero-Result Rate</p>
          <p className="mt-1 text-2xl font-semibold">{(analytics.zeroResultRate * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Engine Breakdown */}
      {analytics.engineBreakdown.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">Queries by Engine</h3>
          </div>
          <div className="divide-y">
            {analytics.engineBreakdown.map((e) => (
              <div key={e.engine} className="flex items-center justify-between px-4 py-3">
                <span className="capitalize">{e.engine}</span>
                <span className="font-mono text-sm">{e.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Queries */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Top Queries</h3>
        </div>
        {analytics.topQueries.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No search queries recorded yet.</p>
        ) : (
          <div className="divide-y">
            {analytics.topQueries.map((q, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2">
                <span className="text-sm">{q.query}</span>
                <span className="font-mono text-xs text-gray-500">{q.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
