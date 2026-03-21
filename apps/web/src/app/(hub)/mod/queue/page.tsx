// NAV_ENTRY: Moderation Queue | /mod/queue | requires MODERATION or ADMIN
import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  getModerationQueue,
  getModerationStats,
  getModerationKPIs,
} from '@/lib/queries/admin-moderation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Clock, ListTodo, User } from 'lucide-react';

export const metadata: Metadata = { title: 'Moderation Queue | Twicely Hub' };

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Listing: 'bg-blue-100 text-blue-700',
    Report: 'bg-yellow-100 text-yellow-800',
    Review: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] ?? 'bg-gray-100 text-gray-700'}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default async function ModerationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Listing') && !ability.can('read', 'ContentReport')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));

  const [{ items, total }, stats, kpis] = await Promise.all([
    getModerationQueue(page, 50),
    getModerationStats(),
    getModerationKPIs(),
  ]);

  const queueSize = kpis.flaggedListings + kpis.pendingReports + kpis.flaggedReviews;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Moderation Queue"
        description="Prioritised list of all pending moderation work"
      />

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 flex items-center gap-3">
          <ListTodo className="h-5 w-5 text-primary/60" />
          <div>
            <p className="text-xs text-gray-500">Total queue size</p>
            <p className="text-xl font-bold text-gray-900">{queueSize}</p>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 flex items-center gap-3">
          <User className="h-5 w-5 text-primary/60" />
          <div>
            <p className="text-xs text-gray-500">Reports today</p>
            <p className="text-xl font-bold text-gray-900">{stats.reportsToday}</p>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary/60" />
          <div>
            <p className="text-xs text-gray-500">Avg resolution (30 days)</p>
            <p className="text-xl font-bold text-gray-900">{stats.avgResolutionHours}h</p>
          </div>
        </div>
      </div>

      {/* Queue table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70 w-12">#</th>
              <th className="px-4 py-3 font-medium text-primary/70">Type</th>
              <th className="px-4 py-3 font-medium text-primary/70">Target</th>
              <th className="px-4 py-3 font-medium text-primary/70">Source</th>
              <th className="px-4 py-3 font-medium text-primary/70">Flagged</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map((item) => (
              <tr key={`${item.type}-${item.targetId}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{item.priority}</td>
                <td className="px-4 py-3"><TypeBadge type={item.type} /></td>
                <td className="px-4 py-3 max-w-[220px] truncate text-gray-800 font-medium">
                  {item.targetTitle}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{item.source}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {item.dateFlagged.toLocaleDateString()}
                </td>
                <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-3">
                  <Link
                    href={item.detailUrl}
                    className="text-blue-600 hover:underline text-xs font-medium"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Queue is clear — no pending work items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <p className="text-xs text-gray-400 text-right">
          Showing {items.length} of {total} items
        </p>
      )}

    </div>
  );
}
