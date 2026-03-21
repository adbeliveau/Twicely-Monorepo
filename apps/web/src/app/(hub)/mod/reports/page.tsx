import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getContentReports } from '@/lib/queries/content-reports';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Content Reports | Twicely Hub' };

type StatusTab = 'PENDING' | 'UNDER_REVIEW' | 'CONFIRMED' | 'DISMISSED' | 'ALL';

const STATUS_TABS: { label: string; value: StatusTab }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Dismissed', value: 'DISMISSED' },
  { label: 'All', value: 'ALL' },
];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function ContentReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ContentReport')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const activeTab = (params.status ?? 'PENDING') as StatusTab;
  const statusFilter = activeTab === 'ALL' ? null : activeTab;

  const { reports, total } = await getContentReports(
    statusFilter as 'PENDING' | 'UNDER_REVIEW' | 'CONFIRMED' | 'DISMISSED' | null,
    page,
    50
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Content Reports" description={`${total} reports`} />

      <div className="flex gap-1 border-b border-gray-200">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/mod/reports?status=${tab.value}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Reporter</th>
              <th className="px-4 py-3 font-medium text-primary/70">Target Type</th>
              <th className="px-4 py-3 font-medium text-primary/70">Target ID</th>
              <th className="px-4 py-3 font-medium text-primary/70">Reason</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {reports.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3 text-gray-700">{r.reporterName}</td>
                <td className="px-4 py-3 text-gray-600">{r.targetType}</td>
                <td className="px-4 py-3">
                  <Link href={`/mod/reports/${r.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                    {r.targetId.slice(0, 12)}…
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{r.reason.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(r.createdAt)}</td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No reports found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
