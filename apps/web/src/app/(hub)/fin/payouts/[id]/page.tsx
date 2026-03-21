// NAV_ENTRY: /fin/payouts/[id] — Payout Detail
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getPayoutDetail } from '@/lib/queries/admin-finance';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { formatCentsToDollars } from '@twicely/finance/format';

export const metadata: Metadata = { title: 'Payout Detail | Twicely Hub' };

const STATUS_CLASSES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  REVERSED: 'bg-gray-100 text-gray-600',
};

export default async function PayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Payout')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const detail = await getPayoutDetail(id);
  if (!detail) notFound();

  const { payout: p, seller, batch, relatedLedgerEntries } = detail;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Payout ${formatCentsToDollars(p.amountCents)}`}
        description={`Initiated ${p.createdAt.toLocaleDateString()}`}
      />

      {/* Status + header card */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Payout Info</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Status</dt>
            <dd>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[p.status] ?? 'bg-gray-100'}`}>
                {p.status}
              </span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Amount</dt>
            <dd className="font-medium">{formatCentsToDollars(p.amountCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Type</dt>
            <dd>{p.isOnDemand ? 'On-demand' : 'Automatic'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Initiated</dt>
            <dd className="text-gray-600">{p.createdAt.toLocaleDateString()}</dd>
          </div>
          {p.completedAt && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Completed</dt>
              <dd className="text-gray-600">{p.completedAt.toLocaleDateString()}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Seller info */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Seller</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Name</dt>
            <dd>
              <Link href={`/usr/${seller.id}`} className="text-primary hover:text-primary/80">
                {seller.name}
              </Link>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Email</dt>
            <dd className="text-gray-600">{seller.email}</dd>
          </div>
        </dl>
      </div>

      {/* Batch info */}
      {batch && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Batch</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Batch ID</dt>
              <dd className="font-mono text-xs">{batch.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd>{batch.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Sellers</dt>
              <dd>{batch.totalSellers}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Succeeded / Failed</dt>
              <dd>{batch.successCount} / {batch.failureCount}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Stripe correlation */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Stripe Correlation</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Transfer ID</dt>
            <dd className="font-mono text-xs text-gray-600 truncate max-w-[200px]">
              {p.stripeTransferId ?? '—'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Payout ID</dt>
            <dd className="font-mono text-xs text-gray-600 truncate max-w-[200px]">
              {p.stripePayoutId ?? '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Failure reason */}
      {p.status === 'FAILED' && p.failureReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase text-red-700">Failure Reason</h3>
          <p className="text-sm text-red-700">{p.failureReason}</p>
        </div>
      )}

      {/* Related ledger entries */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">Related Ledger Entries</h3>
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-primary/70">Type</th>
              <th className="px-3 py-2 font-medium text-primary/70">Amount</th>
              <th className="px-3 py-2 font-medium text-primary/70">Status</th>
              <th className="px-3 py-2 font-medium text-primary/70">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {relatedLedgerEntries.map((le) => (
              <tr key={le.id}>
                <td className="px-3 py-2">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{le.type}</span>
                </td>
                <td className={`px-3 py-2 font-medium ${le.amountCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCentsToDollars(le.amountCents)}
                </td>
                <td className="px-3 py-2 text-gray-500">{le.status}</td>
                <td className="px-3 py-2 text-gray-500">{le.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {relatedLedgerEntries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400">No related ledger entries</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
