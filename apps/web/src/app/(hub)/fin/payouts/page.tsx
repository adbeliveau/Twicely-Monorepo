import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getPayoutList, getPayoutKPIs } from '@/lib/queries/admin-finance';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { formatCentsToDollars } from '@twicely/finance/format';
import { DollarSign, Clock, XCircle, TrendingUp } from 'lucide-react';

export const metadata: Metadata = { title: 'Payouts | Twicely Hub' };

const STATUS_CLASSES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  REVERSED: 'bg-gray-100 text-gray-600',
};

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; from?: string; to?: string; search?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Payout')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const dateFrom = params.from ? new Date(params.from) : undefined;
  const dateTo = params.to ? new Date(params.to) : undefined;

  const [kpis, { payouts, total }] = await Promise.all([
    getPayoutKPIs(30),
    getPayoutList({ page, pageSize: 50, status: params.status, dateFrom, dateTo, search: params.search }),
  ]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Payouts" description={`${total} payouts`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Paid Out (30d)" value={formatCentsToDollars(kpis.paidOutCents)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Pending" value={String(kpis.pendingCount)} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Failed (30d)" value={String(kpis.failedCount)} icon={<XCircle className="h-4 w-4" />} />
        <StatCard label="Avg Payout" value={formatCentsToDollars(kpis.avgPayoutCents)} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <select name="status" defaultValue={params.status ?? ''} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="PROCESSING">PROCESSING</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="FAILED">FAILED</option>
          <option value="REVERSED">REVERSED</option>
        </select>
        <input type="date" name="from" defaultValue={params.from} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <input type="date" name="to" defaultValue={params.to} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <input name="search" defaultValue={params.search} placeholder="Seller name or email" className="rounded-md border border-gray-300 px-3 py-2 text-sm w-48" />
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">User</th>
              <th className="px-4 py-3 font-medium text-primary/70">Amount</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Type</th>
              <th className="px-4 py-3 font-medium text-primary/70">Batch</th>
              <th className="px-4 py-3 font-medium text-primary/70">Initiated</th>
              <th className="px-4 py-3 font-medium text-primary/70">Completed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {payouts.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/usr/${p.userId}`} className="text-primary hover:text-primary/80">
                    {p.userName ?? p.userId}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/fin/payouts/${p.id}`} className="text-primary hover:text-primary/80">
                    {formatCentsToDollars(p.amountCents)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[p.status] ?? 'bg-gray-100'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.isOnDemand ? 'On-demand' : 'Auto'}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">
                  {p.batchId ? p.batchId.slice(0, 8) + '…' : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{p.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-500">{p.completedAt?.toLocaleDateString() ?? '—'}</td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No payouts</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && <Link href={`/fin/payouts?page=${page - 1}&status=${params.status ?? ''}`} className="rounded border px-3 py-1 hover:bg-gray-50">Previous</Link>}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={`/fin/payouts?page=${page + 1}&status=${params.status ?? ''}`} className="rounded border px-3 py-1 hover:bg-gray-50">Next</Link>}
        </div>
      )}
    </div>
  );
}
