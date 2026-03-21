// NAV_ENTRY: /fin/chargebacks — Chargeback List
import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getChargebackList, getChargebackStats } from '@/lib/queries/admin-finance-chargebacks';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { formatCentsToDollars } from '@twicely/finance/format';
import { AlertTriangle, TrendingDown, RefreshCw, DollarSign } from 'lucide-react';

export const metadata: Metadata = { title: 'Chargebacks | Twicely Hub' };

export default async function ChargebacksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; from?: string; to?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'LedgerEntry')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const status = (params.status as 'all' | 'open' | 'won') ?? 'all';
  const dateFrom = params.from ? new Date(params.from) : undefined;
  const dateTo = params.to ? new Date(params.to) : undefined;

  const [stats, { chargebacks, total }] = await Promise.all([
    getChargebackStats(30),
    getChargebackList({ page, pageSize: 50, status, dateFrom, dateTo }),
  ]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Chargebacks" description="Stripe dispute ledger entries (read-only)" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total (30d)" value={String(stats.totalCount)} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Amount (30d)" value={formatCentsToDollars(stats.totalAmountCents)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Reversal Rate" value={`${stats.reversalRate}%`} icon={<RefreshCw className="h-4 w-4" />} />
        <StatCard label="Avg Amount" value={formatCentsToDollars(stats.avgAmountCents)} icon={<TrendingDown className="h-4 w-4" />} />
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          <option value="all">All Disputes</option>
          <option value="open">Open</option>
          <option value="won">Won</option>
        </select>
        <input type="date" name="from" defaultValue={params.from} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <input type="date" name="to" defaultValue={params.to} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Dispute ID</th>
              <th className="px-4 py-3 font-medium text-primary/70">Seller</th>
              <th className="px-4 py-3 font-medium text-primary/70">Order</th>
              <th className="px-4 py-3 font-medium text-primary/70">Amount</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {chargebacks.map((cb) => (
              <tr key={cb.stripeDisputeId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/fin/chargebacks/${encodeURIComponent(cb.stripeDisputeId)}`} className="font-mono text-xs text-primary hover:text-primary/80">
                    {cb.stripeDisputeId}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {cb.userId ? (
                    <Link href={`/usr/${cb.userId}`} className="text-primary hover:text-primary/80">
                      {cb.userId}
                    </Link>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {cb.orderId ? (
                    <Link href={`/tx/orders/${cb.orderId}`} className="text-primary hover:text-primary/80">
                      {cb.orderId}
                    </Link>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-red-600">{formatCentsToDollars(cb.totalDebitCents)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cb.status === 'Won' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {cb.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{cb.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {chargebacks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No chargebacks found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`/fin/chargebacks?page=${page - 1}&status=${status}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Previous
            </Link>
          )}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/fin/chargebacks?page=${page + 1}&status=${status}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
