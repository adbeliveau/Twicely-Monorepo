import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { getEnrichedPaymentsList, getPaymentKPIs } from '@/lib/queries/admin-orders';
import { formatCentsToDollars } from '@twicely/finance/format';
import { DollarSign, RefreshCw, CreditCard, TrendingUp } from 'lucide-react';

export const metadata: Metadata = { title: 'Payments | Twicely Hub' };

const PAYMENT_STATUS_CLASSES: Record<string, string> = {
  captured: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
};

export default async function PaymentsPage({
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

  const [kpis, { payments, total }] = await Promise.all([
    getPaymentKPIs(30),
    getEnrichedPaymentsList({ page, pageSize: 50, status: params.status, dateFrom, dateTo, search: params.search }),
  ]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Payments" description={`${total} payments (read-only)`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Captured (30d)" value={formatCentsToDollars(kpis.capturedCents)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Refunded (30d)" value={formatCentsToDollars(kpis.refundedCents)} icon={<RefreshCw className="h-4 w-4" />} />
        <StatCard label="Payment Processing (30d)" value={formatCentsToDollars(kpis.stripeFeeCents)} icon={<CreditCard className="h-4 w-4" />} />
        <StatCard label="Transaction Fees (30d)" value={formatCentsToDollars(kpis.tfCollectedCents)} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <select name="status" defaultValue={params.status ?? ''} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="captured">Captured</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <input type="date" name="from" defaultValue={params.from} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <input type="date" name="to" defaultValue={params.to} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <input name="search" defaultValue={params.search} placeholder="Order # or payment intent" className="rounded-md border border-gray-300 px-3 py-2 text-sm w-52" />
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-3 py-3 font-medium text-primary/70">Order #</th>
              <th className="px-3 py-3 font-medium text-primary/70">Payment Intent</th>
              <th className="px-3 py-3 font-medium text-primary/70">Amount</th>
              <th className="px-3 py-3 font-medium text-primary/70">Transaction Fee</th>
              <th className="px-3 py-3 font-medium text-primary/70">Payment Processing</th>
              <th className="px-3 py-3 font-medium text-primary/70">Net to Seller</th>
              <th className="px-3 py-3 font-medium text-primary/70">Status</th>
              <th className="px-3 py-3 font-medium text-primary/70">Captured</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-3 font-medium">
                  <Link href={`/tx/orders/${p.orderId}`} className="text-primary hover:text-primary/80">
                    {p.orderNumber}
                  </Link>
                </td>
                <td className="px-3 py-3 font-mono text-xs text-gray-500 truncate max-w-[120px]">
                  {p.stripePaymentIntentId ?? '—'}
                </td>
                <td className="px-3 py-3 font-medium">{formatCentsToDollars(p.amountCents)}</td>
                <td className="px-3 py-3 text-red-600">{p.tfAmountCents != null ? formatCentsToDollars(p.tfAmountCents) : '—'}</td>
                <td className="px-3 py-3 text-red-600">{p.stripeFeesCents != null ? formatCentsToDollars(p.stripeFeesCents) : '—'}</td>
                <td className="px-3 py-3 font-medium text-green-600">{p.netToSellerCents != null ? formatCentsToDollars(p.netToSellerCents) : '—'}</td>
                <td className="px-3 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PAYMENT_STATUS_CLASSES[p.status] ?? 'bg-gray-100'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500">{p.capturedAt?.toLocaleDateString() ?? '—'}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No payments found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && <Link href={`/tx/payments?page=${page - 1}&status=${params.status ?? ''}`} className="rounded border px-3 py-1 hover:bg-gray-50">Previous</Link>}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={`/tx/payments?page=${page + 1}&status=${params.status ?? ''}`} className="rounded border px-3 py-1 hover:bg-gray-50">Next</Link>}
        </div>
      )}
    </div>
  );
}
