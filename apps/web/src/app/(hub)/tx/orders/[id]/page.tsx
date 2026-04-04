import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminOrderDetail, getOrderItems, getOrderPayment, getOrderDisputes } from '@/lib/queries/admin-orders';
import { getLocalTransactionByOrderId } from '@/lib/queries/local-transaction';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { OrderActions } from '@/components/admin/actions/order-actions';
import { LocalTransactionDetail } from '@/components/hub/orders/local-transaction-detail';
import { formatCentsToDollars } from '@twicely/finance/format';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export const metadata: Metadata = { title: 'Order Detail | Twicely Hub' };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Order')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const [detail, localTx, items, payment, disputes, escrowHoldHours] = await Promise.all([
    getAdminOrderDetail(id),
    getLocalTransactionByOrderId(id),
    getOrderItems(id),
    getOrderPayment(id),
    getOrderDisputes(id),
    getPlatformSetting<number>('commerce.escrow.holdHours', 72),
  ]);
  if (!detail) notFound();

  const { order: o, buyer, seller, ledgerEntries } = detail;

  // Escrow calculation — reads from platform_settings
  const escrowReleaseAt = o.deliveredAt
    ? new Date(o.deliveredAt.getTime() + escrowHoldHours * 60 * 60 * 1000)
    : null;
  const now = new Date().getTime();
  const escrowStatus = !o.deliveredAt
    ? null
    : now < (escrowReleaseAt?.getTime() ?? 0)
      ? 'HELD'
      : 'RELEASED';

  // Order timeline
  const timeline: { label: string; date: Date | null | undefined }[] = [
    { label: 'Created', date: o.createdAt },
    { label: 'Paid', date: o.paidAt },
    { label: 'Shipped', date: o.shippedAt },
    { label: 'Delivered', date: o.deliveredAt },
    { label: 'Completed', date: o.completedAt },
    { label: 'Canceled', date: o.canceledAt },
  ].filter((e) => e.date != null);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Order ${o.orderNumber}`}
        description={`Status: ${o.status}`}
        actions={
          <OrderActions
            orderId={id}
            totalCents={o.totalCents}
            canUpdate={ability.can('update', 'Order')}
            canManage={ability.can('manage', 'Order')}
          />
        }
      />

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase text-primary">Order Info</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Total</dt><dd className="font-medium">{formatCentsToDollars(o.totalCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd>{formatCentsToDollars(o.itemSubtotalCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Shipping</dt><dd>{formatCentsToDollars(o.shippingCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Tax</dt><dd>{formatCentsToDollars(o.taxCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Discount</dt><dd>{formatCentsToDollars(o.discountCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Created</dt><dd>{o.createdAt.toLocaleDateString()}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase text-primary">Buyer</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Name</dt><dd><Link href={`/usr/${o.buyerId}`} className="text-primary hover:text-primary/80">{buyer.name}</Link></dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd>{buyer.email}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase text-primary">Seller</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Name</dt><dd><Link href={`/usr/${o.sellerId}`} className="text-primary hover:text-primary/80">{seller.name}</Link></dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd>{seller.email}</dd></div>
          </dl>
        </div>
      </div>

      {/* Shipping */}
      {o.trackingNumber && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Shipping</h3>
          <p className="text-sm">Tracking: {o.trackingNumber} {o.shippingMethod && `(${o.shippingMethod})`}</p>
        </div>
      )}

      {/* Order items */}
      {items.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-primary">Order Items</h3>
          <table className="w-full text-sm">
            <thead className="bg-primary/5 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-primary/70">Item</th>
                <th className="px-3 py-2 font-medium text-primary/70">Qty</th>
                <th className="px-3 py-2 font-medium text-primary/70">Unit Price</th>
                <th className="px-3 py-2 font-medium text-primary/70">Transaction Fee Rate</th>
                <th className="px-3 py-2 font-medium text-primary/70">Transaction Fee</th>
                <th className="px-3 py-2 font-medium text-primary/70">Fee Bucket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">{item.title}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{formatCentsToDollars(item.unitPriceCents)}</td>
                  <td className="px-3 py-2">{item.tfRateBps != null ? `${item.tfRateBps / 100}%` : '—'}</td>
                  <td className="px-3 py-2 text-red-600">{item.tfAmountCents != null ? formatCentsToDollars(item.tfAmountCents) : '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{item.feeBucket ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment breakdown — UX language pack compliant */}
      {payment && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-primary">Payment Breakdown</h3>
          <dl className="space-y-1 text-sm font-mono">
            <div className="flex justify-between"><dt className="text-gray-600">Gross sale</dt><dd>{formatCentsToDollars(payment.amountCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">Transaction Fee ({payment.tfRateBps != null ? `${payment.tfRateBps / 100}%` : ''})</dt><dd className="text-red-600">-{payment.tfAmountCents != null ? formatCentsToDollars(payment.tfAmountCents) : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">Payment Processing</dt><dd className="text-red-600">-{payment.stripeFeesCents != null ? formatCentsToDollars(payment.stripeFeesCents) : '—'}</dd></div>
            {(payment.boostFeeAmountCents ?? 0) > 0 && (
              <div className="flex justify-between"><dt className="text-gray-600">Boost Fee</dt><dd className="text-red-600">-{formatCentsToDollars(payment.boostFeeAmountCents ?? 0)}</dd></div>
            )}
            <div className="mt-2 flex justify-between border-t pt-2"><dt className="font-semibold">Net Earnings</dt><dd className="font-semibold text-green-600">{payment.netToSellerCents != null ? formatCentsToDollars(payment.netToSellerCents) : '—'}</dd></div>
          </dl>
        </div>
      )}

      {/* Escrow status */}
      {o.deliveredAt && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-primary">Escrow Status</h3>
          <p className="text-sm text-gray-700">
            Delivered {o.deliveredAt.toLocaleDateString()}. Escrow hold: {escrowHoldHours}h from delivery. Funds release: {escrowReleaseAt?.toLocaleString() ?? '—'}.
          </p>
          <p className="mt-1 text-sm">
            Status: <span className={`font-medium ${escrowStatus === 'HELD' ? 'text-yellow-600' : 'text-green-600'}`}>{escrowStatus}</span>
          </p>
        </div>
      )}

      {/* Order timeline */}
      {timeline.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-primary">Order Timeline</h3>
          <ol className="space-y-2">
            {timeline.map((e) => (
              <li key={e.label} className="flex items-center gap-3 text-sm">
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                <span className="w-24 font-medium text-gray-700">{e.label}</span>
                <span className="text-gray-500">{e.date?.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Related disputes */}
      {disputes.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-orange-700">Related Disputes</h3>
          {disputes.map((d) => (
            <div key={d.id} className="text-sm">
              <span className="font-medium">{d.claimType}</span> — <span>{d.status}</span>
              {d.resolutionAmountCents != null && <span className="ml-2 text-gray-600">Resolution: {formatCentsToDollars(d.resolutionAmountCents)}</span>}
            </div>
          ))}
        </div>
      )}

      {localTx && <LocalTransactionDetail localTx={localTx} />}

      {/* Ledger entries */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">Ledger Entries</h3>
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
            {ledgerEntries.map((le) => (
              <tr key={le.id}>
                <td className="px-3 py-2"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{le.type}</span></td>
                <td className={`px-3 py-2 font-medium ${le.amountCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCentsToDollars(le.amountCents)}</td>
                <td className="px-3 py-2 text-gray-500">{le.status}</td>
                <td className="px-3 py-2 text-gray-500">{le.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {ledgerEntries.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">No ledger entries</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
