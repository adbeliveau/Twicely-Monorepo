import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getLedgerEntries } from '@/lib/queries/admin-finance';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { formatCentsToDollars } from '@twicely/finance/format';

export const metadata: Metadata = { title: 'Ledger Explorer | Twicely Hub' };

const LEDGER_TYPES = [
  'ORDER_PAYMENT_CAPTURED', 'ORDER_TF_FEE', 'ORDER_BOOST_FEE', 'ORDER_STRIPE_PROCESSING_FEE',
  'REFUND_FULL', 'REFUND_PARTIAL', 'SELLER_ADJUSTMENT',
  'REFUND_TF_REVERSAL', 'REFUND_BOOST_REVERSAL', 'REFUND_STRIPE_REVERSAL',
  'CHARGEBACK_DEBIT', 'CHARGEBACK_REVERSAL', 'CHARGEBACK_FEE',
  'SHIPPING_LABEL_PURCHASE', 'SHIPPING_LABEL_REFUND',
  'INSERTION_FEE', 'INSERTION_FEE_WAIVER',
  'SUBSCRIPTION_CHARGE', 'SUBSCRIPTION_CREDIT', 'OVERAGE_CHARGE',
  'PAYOUT_SENT', 'PAYOUT_FAILED', 'PAYOUT_REVERSED',
  'RESERVE_HOLD', 'RESERVE_RELEASE',
  'MANUAL_CREDIT', 'MANUAL_DEBIT', 'PLATFORM_ABSORBED_COST',
  'AUTH_FEE_BUYER', 'AUTH_FEE_SELLER', 'AUTH_FEE_REFUND',
  'LOCAL_TRANSACTION_FEE', 'FINANCE_SUBSCRIPTION_CHARGE',
  'BUYER_REFERRAL_CREDIT_ISSUED', 'BUYER_REFERRAL_CREDIT_REDEEMED',
  'AFFILIATE_COMMISSION_PAYOUT', 'CROSSLISTER_SALE_REVENUE', 'CROSSLISTER_PLATFORM_FEE',
  'LOCAL_FRAUD_REVERSAL', 'LOCAL_PRICE_ADJUSTMENT',
] as const;

const STATUS_CLASSES: Record<string, string> = {
  POSTED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  REVERSED: 'bg-gray-100 text-gray-500',
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; status?: string; userId?: string; orderId?: string; from?: string; to?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'LedgerEntry')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const dateFrom = params.from ? new Date(params.from) : undefined;
  const dateTo = params.to ? new Date(params.to) : undefined;

  const { entries, total } = await getLedgerEntries({
    page,
    pageSize: 100,
    type: params.type,
    userId: params.userId,
    status: params.status,
    orderId: params.orderId,
    dateFrom,
    dateTo,
  });

  const totalPages = Math.ceil(total / 100);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Ledger Explorer" description={`${total} entries (read-only)`} />

      <form className="flex flex-wrap gap-2" method="get">
        <select name="type" defaultValue={params.type ?? ''} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Types</option>
          {LEDGER_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ''} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="POSTED">POSTED</option>
          <option value="REVERSED">REVERSED</option>
        </select>
        <input name="userId" defaultValue={params.userId} placeholder="Seller ID or email" className="rounded-md border border-gray-300 px-3 py-2 text-sm w-48" />
        <input name="orderId" defaultValue={params.orderId} placeholder="Order ID" className="rounded-md border border-gray-300 px-3 py-2 text-sm w-40" />
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
              <th className="px-4 py-3 font-medium text-primary/70">Date</th>
              <th className="px-4 py-3 font-medium text-primary/70">Type</th>
              <th className="px-4 py-3 font-medium text-primary/70">User</th>
              <th className="px-4 py-3 font-medium text-primary/70">Order</th>
              <th className="px-4 py-3 font-medium text-primary/70">Amount</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Stripe Event</th>
              <th className="px-4 py-3 font-medium text-primary/70">Memo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{e.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{e.type}</span></td>
                <td className="px-4 py-3">
                  {e.userId ? (
                    <Link href={`/usr/${e.userId}`} className="text-primary hover:text-primary/80">
                      {e.userName ?? e.userId}
                    </Link>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  {e.orderId ? (
                    <Link href={`/tx/orders/${e.orderId}`} className="text-primary hover:text-primary/80">
                      {e.orderId}
                    </Link>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className={`px-4 py-3 font-medium ${e.amountCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCentsToDollars(e.amountCents)}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[e.status] ?? 'bg-gray-100'}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400 truncate max-w-[120px]">
                  {e.stripeEventId ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 truncate max-w-[160px]">{e.memo ?? '—'}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No ledger entries</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && <Link href={`/fin/ledger?page=${page - 1}&type=${params.type ?? ''}&status=${params.status ?? ''}`} className="rounded border px-3 py-1 hover:bg-gray-50">Previous</Link>}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={`/fin/ledger?page=${page + 1}&type=${params.type ?? ''}&status=${params.status ?? ''}`} className="rounded border px-3 py-1 hover:bg-gray-50">Next</Link>}
        </div>
      )}
    </div>
  );
}
