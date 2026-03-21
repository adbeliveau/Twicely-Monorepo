import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getEnforcementActions, getAppealKPIs } from '@/lib/queries/enforcement-actions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Enforcement Actions | Twicely Hub' };

type StatusTab = 'ACTIVE' | 'EXPIRED' | 'LIFTED' | 'APPEALED' | 'APPEAL_APPROVED' | 'ALL';

const STATUS_TABS: { label: string; value: StatusTab }[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Expired', value: 'EXPIRED' },
  { label: 'Lifted', value: 'LIFTED' },
  { label: 'Appealed', value: 'APPEALED' },
  { label: 'Appeal Approved', value: 'APPEAL_APPROVED' },
  { label: 'All', value: 'ALL' },
];

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function EnforcementActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'EnforcementAction')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const activeTab = (params.status ?? 'ACTIVE') as StatusTab;
  const statusFilter = activeTab === 'ALL' ? null : activeTab;

  const [{ actions, total }, appealKPIs] = await Promise.all([
    getEnforcementActions(
      null,
      statusFilter as 'ACTIVE' | 'EXPIRED' | 'LIFTED' | 'APPEALED' | 'APPEAL_APPROVED' | null,
      page,
      50
    ),
    getAppealKPIs(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader title="Enforcement Actions" description={`${total} actions`} />
        <Link
          href="/mod/enforcement/new"
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Issue Action
        </Link>
      </div>

      {appealKPIs.pendingAppeals > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-center gap-3">
          <span className="font-semibold text-yellow-900">{appealKPIs.pendingAppeals}</span>
          <span>pending appeal{appealKPIs.pendingAppeals !== 1 ? 's' : ''} awaiting review</span>
          {appealKPIs.avgReviewHours > 0 && (
            <span className="ml-auto text-yellow-700">Avg review time: {appealKPIs.avgReviewHours}h</span>
          )}
          <Link
            href="/mod/enforcement?status=APPEALED"
            className="ml-2 rounded bg-yellow-700 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-800"
          >
            Review appeals
          </Link>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/mod/enforcement?status=${tab.value}`}
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
              <th className="px-4 py-3 font-medium text-primary/70">User</th>
              <th className="px-4 py-3 font-medium text-primary/70">Action Type</th>
              <th className="px-4 py-3 font-medium text-primary/70">Trigger</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Issued By</th>
              <th className="px-4 py-3 font-medium text-primary/70">Created</th>
              <th className="px-4 py-3 font-medium text-primary/70">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {actions.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700">{a.userName}</td>
                <td className="px-4 py-3">
                  <Link href={`/mod/enforcement/${a.id}`} className="text-blue-600 hover:underline font-medium">
                    {a.actionType.replace(/_/g, ' ')}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{a.trigger.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {a.issuedByStaffId ? a.issuedByStaffId.slice(0, 8) : 'System'}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(a.createdAt)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(a.expiresAt)}</td>
              </tr>
            ))}
            {actions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No enforcement actions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
