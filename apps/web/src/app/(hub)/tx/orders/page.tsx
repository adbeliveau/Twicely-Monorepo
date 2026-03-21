import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminOrderList } from '@/lib/queries/admin-orders';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { formatCentsToDollars } from '@twicely/finance/format';

export const metadata: Metadata = { title: 'Orders | Twicely Hub' };

const ORDER_STATUSES = [
  'CREATED', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'SHIPPED',
  'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELED', 'REFUNDED', 'DISPUTED',
] as const;

const STATUS_CLASSES: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  REFUNDED: 'bg-red-100 text-red-700',
  CANCELED: 'bg-gray-100 text-gray-500',
  SHIPPED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-teal-100 text-teal-700',
  PAYMENT_PENDING: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  CREATED: 'bg-gray-100 text-gray-600',
  DISPUTED: 'bg-orange-100 text-orange-700',
};

const PAYMENT_STATUS_CLASSES: Record<string, string> = {
  captured: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
};

export default async function OrdersListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string; local?: string; from?: string; to?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Order')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const localPickup = params.local === '1' ? true : undefined;
  const dateFrom = params.from ? new Date(params.from) : undefined;
  const dateTo = params.to ? new Date(params.to) : undefined;

  const { orders, total } = await getAdminOrderList({
    page,
    pageSize: 50,
    search: params.search,
    status: params.status,
    dateFrom,
    dateTo,
    localPickup,
  });

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="All Orders" description={`${total} orders total`} />

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="search"
          defaultValue={params.search}
          placeholder="Search by order number or email..."
          className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <select name="status" defaultValue={params.status ?? ''} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" name="from" defaultValue={params.from} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <input type="date" name="to" defaultValue={params.to} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <label className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
          <input type="checkbox" name="local" value="1" defaultChecked={params.local === '1'} />
          Local Pickup
        </label>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Order #</th>
              <th className="px-4 py-3 font-medium text-primary/70">Buyer</th>
              <th className="px-4 py-3 font-medium text-primary/70">Seller</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Payment</th>
              <th className="px-4 py-3 font-medium text-primary/70">Total</th>
              <th className="px-4 py-3 font-medium text-primary/70">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/tx/orders/${o.id}`} className="font-medium text-primary hover:text-primary/80">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{o.buyerName}</td>
                <td className="px-4 py-3 text-gray-600">{o.sellerName}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[o.status] ?? 'bg-gray-100'}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {o.paymentStatus ? (
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PAYMENT_STATUS_CLASSES[o.paymentStatus] ?? 'bg-gray-100'}`}>
                      {o.paymentStatus}
                    </span>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 font-medium">{formatCentsToDollars(o.totalCents)}</td>
                <td className="px-4 py-3 text-gray-500">{o.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && <Link href={`/tx/orders?page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">Previous</Link>}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={`/tx/orders?page=${page + 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">Next</Link>}
        </div>
      )}

      <p className="text-center text-xs text-gray-400">Export coming soon</p>
    </div>
  );
}
