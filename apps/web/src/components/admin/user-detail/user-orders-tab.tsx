import Link from 'next/link';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  buyerId: string;
  sellerId: string;
  createdAt: Date;
}

interface UserOrdersTabProps {
  userId: string;
  orders: Order[];
  total: number;
  page: number;
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export function UserOrdersTab({ userId, orders, total, page }: UserOrdersTabProps) {
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{total} total orders</p>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Order #</th>
              <th className="px-4 py-3 font-medium text-primary/70">Role</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Total</th>
              <th className="px-4 py-3 font-medium text-primary/70">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/tx/orders/${o.id}`} className="font-medium text-primary hover:underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${o.buyerId === userId ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                    {o.buyerId === userId ? 'Buyer' : 'Seller'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{o.status}</span>
                </td>
                <td className="px-4 py-3">{fmt(o.totalCents)}</td>
                <td className="px-4 py-3 text-gray-500">{o.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No orders</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`/usr/${userId}?tab=orders&orderPage=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Previous
            </Link>
          )}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/usr/${userId}?tab=orders&orderPage=${page + 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
