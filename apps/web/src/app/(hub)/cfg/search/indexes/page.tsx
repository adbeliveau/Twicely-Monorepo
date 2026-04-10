import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSearchIndexes, getSearchJobs } from '@/lib/queries/admin-search-opensearch';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Search Indexes | Twicely Hub' };

export default async function SearchIndexesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canManage = ability.can('manage', 'Setting');
  const [indexes, jobs] = await Promise.all([
    getSearchIndexes(),
    getSearchJobs(10),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <Link href="/cfg/search" className="hover:text-blue-600">Search Engine</Link>
        <span>/</span>
        <span className="text-gray-900">Indexes</span>
      </div>

      <AdminPageHeader
        title="Search Indexes"
        description="Physical OpenSearch indices, alias management, reindex, and rollback."
      />

      {canManage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            Use server actions to trigger reindex, swap aliases, or rollback.
            See <code className="rounded bg-blue-100 px-1">admin-search-opensearch.ts</code> actions.
          </p>
        </div>
      )}

      {/* Index Versions */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Physical Indices ({indexes.length})</h3>
        </div>
        {indexes.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No index versions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Index Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Docs</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">Read</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">Write</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {indexes.map((idx) => (
                  <tr key={idx.id}>
                    <td className="px-4 py-2 font-mono text-xs">{idx.physicalIndexName}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${
                        idx.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        idx.status === 'CREATING' ? 'bg-blue-100 text-blue-700' :
                        idx.status === 'RETIRED' ? 'bg-gray-100 text-gray-500' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {idx.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{idx.docCount.toLocaleString()}</td>
                    <td className="px-4 py-2 text-center">{idx.isReadActive ? 'Y' : '-'}</td>
                    <td className="px-4 py-2 text-center">{idx.isWriteActive ? 'Y' : '-'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{idx.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Job History */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Job History</h3>
        </div>
        {jobs.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No index jobs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Success</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Failed</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-2 font-mono text-xs">{job.jobType}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${
                        job.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        job.status === 'RUNNING' ? 'bg-blue-100 text-blue-700' :
                        job.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{job.succeededItems ?? 0}</td>
                    <td className="px-4 py-2 text-right text-red-600">{job.failedItems ?? 0}</td>
                    <td className="px-4 py-2 text-right">{job.totalItems ?? 0}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{job.startedAt?.toLocaleString() ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
