// NAV_ENTRY: /fin/chargebacks/[id] — Chargeback Detail (id = stripeDisputeId)
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getChargebackDetail } from '@/lib/queries/admin-finance-chargebacks';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { formatCentsToDollars } from '@twicely/finance/format';

export const metadata: Metadata = { title: 'Chargeback Detail | Twicely Hub' };

const TYPE_COLORS: Record<string, string> = {
  CHARGEBACK_DEBIT: 'bg-red-100 text-red-700',
  CHARGEBACK_FEE: 'bg-orange-100 text-orange-700',
  CHARGEBACK_REVERSAL: 'bg-green-100 text-green-700',
};

export default async function ChargebackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Chargeback')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const detail = await getChargebackDetail(decodeURIComponent(id));
  if (!detail) notFound();

  const chronological = [...detail.entries].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Chargeback: ${detail.stripeDisputeId}`}
        description={`Status: ${detail.status}`}
      />

      {/* Dispute header */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Dispute Summary</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Stripe Dispute ID</dt>
            <dd className="font-mono text-xs text-gray-600">{detail.stripeDisputeId}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Status</dt>
            <dd>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${detail.status === 'Won' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {detail.status}
              </span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Total Disputed</dt>
            <dd className="font-medium text-red-600">{formatCentsToDollars(detail.totalDebitCents)}</dd>
          </div>
        </dl>
      </div>

      {/* Seller card */}
      {detail.userId && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Seller</h3>
          <Link href={`/usr/${detail.userId}`} className="text-sm text-primary hover:text-primary/80">
            {detail.userId}
          </Link>
        </div>
      )}

      {/* Order card */}
      {detail.orderId && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Order</h3>
          <Link href={`/tx/orders/${detail.orderId}`} className="text-sm text-primary hover:text-primary/80">
            {detail.orderId}
          </Link>
        </div>
      )}

      {/* All ledger entries */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">Ledger Entries for This Dispute</h3>
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-primary/70">Type</th>
              <th className="px-3 py-2 font-medium text-primary/70">Amount</th>
              <th className="px-3 py-2 font-medium text-primary/70">Status</th>
              <th className="px-3 py-2 font-medium text-primary/70">Date</th>
              <th className="px-3 py-2 font-medium text-primary/70">Memo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {detail.entries.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_COLORS[e.type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {e.type}
                  </span>
                </td>
                <td className={`px-3 py-2 font-medium ${e.amountCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCentsToDollars(e.amountCents)}
                </td>
                <td className="px-3 py-2 text-gray-500">{e.status}</td>
                <td className="px-3 py-2 text-gray-500">{e.createdAt.toLocaleDateString()}</td>
                <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]">{e.memo ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">Timeline</h3>
        <ol className="space-y-2">
          {chronological.map((e) => (
            <li key={e.id} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
              <span className="text-gray-500">{e.createdAt.toLocaleString()}</span>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_COLORS[e.type] ?? 'bg-gray-100 text-gray-600'}`}>
                {e.type}
              </span>
              <span className={`font-medium ${e.amountCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCentsToDollars(e.amountCents)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
