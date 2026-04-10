import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSearchDashboard } from '@/lib/queries/admin-search-opensearch';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = {
  title: 'Search Engine | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function SearchDashboardPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const dashboard = await getSearchDashboard();

  const healthColor = dashboard.clusterHealth?.status === 'green'
    ? 'bg-green-100 text-green-800'
    : dashboard.clusterHealth?.status === 'yellow'
      ? 'bg-yellow-100 text-yellow-800'
      : dashboard.clusterHealth?.status === 'red'
        ? 'bg-red-100 text-red-800'
        : 'bg-gray-100 text-gray-600';

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Search Engine</span>
      </div>

      <AdminPageHeader
        title="Search Engine"
        description="OpenSearch cluster dashboard — engine status, index health, and recent operations."
      />

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-500">Active Engine</p>
          <p className="mt-1 text-2xl font-semibold capitalize">{dashboard.engine}</p>
          {dashboard.dualWrite && (
            <span className="mt-1 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Dual-write ON</span>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-500">Cluster Health</p>
          <p className={`mt-1 inline-block rounded px-2 py-1 text-lg font-semibold ${healthColor}`}>
            {dashboard.clusterHealth?.status?.toUpperCase() ?? 'UNKNOWN'}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-500">Active Index</p>
          <p className="mt-1 truncate text-sm font-mono">{dashboard.activeIndex ?? 'None'}</p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-500">Documents</p>
          <p className="mt-1 text-2xl font-semibold">{dashboard.docCount.toLocaleString()}</p>
        </div>
      </div>

      {/* Feature Gate Status */}
      <div className="rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900">OpenSearch Feature Gate</h3>
        <p className="mt-1 text-sm text-gray-600">
          {dashboard.gateEnabled
            ? 'gate.opensearch is ENABLED — reads are routed to OpenSearch'
            : 'gate.opensearch is DISABLED — reads use the configured engine'}
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/cfg/search/settings" className="rounded-lg border p-3 text-center hover:bg-gray-50">
          <span className="text-sm font-medium">Settings</span>
        </Link>
        <Link href="/cfg/search/relevance" className="rounded-lg border p-3 text-center hover:bg-gray-50">
          <span className="text-sm font-medium">Relevance</span>
        </Link>
        <Link href="/cfg/search/indexes" className="rounded-lg border p-3 text-center hover:bg-gray-50">
          <span className="text-sm font-medium">Indexes</span>
        </Link>
        <Link href="/cfg/search/analytics" className="rounded-lg border p-3 text-center hover:bg-gray-50">
          <span className="text-sm font-medium">Analytics</span>
        </Link>
      </div>

      {/* Recent Jobs */}
      {dashboard.recentJobs.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">Recent Index Operations</h3>
          </div>
          <div className="divide-y">
            {dashboard.recentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-mono text-sm">{job.jobType}</span>
                  <span className={`ml-2 rounded px-2 py-0.5 text-xs ${
                    job.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    job.status === 'RUNNING' ? 'bg-blue-100 text-blue-700' :
                    job.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {job.succeededItems ?? 0}/{job.totalItems ?? 0} docs
                  <span className="ml-2">{job.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
