import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

export const metadata: Metadata = { title: 'Search Health | Twicely Hub' };

export default async function SearchHealthPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const engine = await getPlatformSetting<string>('search.engine', 'typesense');

  // Try to get live health data from OpenSearch
  let clusterHealth: {
    status: string;
    numberOfNodes: number;
    activeShards: number;
    relocatingShards: number;
    unassignedShards: number;
    pendingTasks: number;
  } | null = null;

  let indexStats: Array<{
    indexName: string;
    docCount: number;
    sizeBytes: number;
    searchQueryTotal: number;
    searchQueryTimeMs: number;
  }> = [];

  let docCount = 0;
  let error: string | null = null;

  if (engine === 'opensearch') {
    try {
      const admin = await import('@twicely/search/opensearch-admin');
      const [health, stats, count] = await Promise.all([
        admin.getClusterHealth(),
        admin.getIndexStats(),
        admin.getDocCount(),
      ]);
      clusterHealth = health;
      indexStats = stats;
      docCount = count;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  const healthColor = clusterHealth?.status === 'green'
    ? 'border-green-500 bg-green-50'
    : clusterHealth?.status === 'yellow'
      ? 'border-yellow-500 bg-yellow-50'
      : clusterHealth?.status === 'red'
        ? 'border-red-500 bg-red-50'
        : 'border-gray-300 bg-gray-50';

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <Link href="/cfg/search" className="hover:text-blue-600">Search Engine</Link>
        <span>/</span>
        <span className="text-gray-900">Health</span>
      </div>

      <AdminPageHeader
        title="Search Health"
        description="Live OpenSearch cluster health, index statistics, and document counts."
      />

      {engine !== 'opensearch' && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            Active engine is <strong>{engine}</strong>. OpenSearch health data is only available
            when search.engine is set to &quot;opensearch&quot;.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="font-semibold text-red-900">Connection Error</h3>
          <p className="mt-1 text-sm text-red-800">{error}</p>
        </div>
      )}

      {clusterHealth && (
        <>
          {/* Cluster Health */}
          <div className={`rounded-lg border-2 p-4 ${healthColor}`}>
            <h3 className="font-semibold">Cluster Status: {clusterHealth.status.toUpperCase()}</h3>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div>
                <p className="text-xs text-gray-500">Nodes</p>
                <p className="text-lg font-semibold">{clusterHealth.numberOfNodes}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Active Shards</p>
                <p className="text-lg font-semibold">{clusterHealth.activeShards}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Relocating</p>
                <p className="text-lg font-semibold">{clusterHealth.relocatingShards}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Unassigned</p>
                <p className="text-lg font-semibold">{clusterHealth.unassignedShards}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Pending Tasks</p>
                <p className="text-lg font-semibold">{clusterHealth.pendingTasks}</p>
              </div>
            </div>
          </div>

          {/* Document Count */}
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium text-gray-500">Total Documents (read alias)</p>
            <p className="mt-1 text-2xl font-semibold">{docCount.toLocaleString()}</p>
          </div>
        </>
      )}

      {/* Index Stats */}
      {indexStats.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">Index Statistics</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Index</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Docs</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Size</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Queries</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Query Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {indexStats.map((stat) => (
                  <tr key={stat.indexName}>
                    <td className="px-4 py-2 font-mono text-xs">{stat.indexName}</td>
                    <td className="px-4 py-2 text-right">{stat.docCount.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{formatBytes(stat.sizeBytes)}</td>
                    <td className="px-4 py-2 text-right">{stat.searchQueryTotal.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{stat.searchQueryTimeMs.toLocaleString()}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
