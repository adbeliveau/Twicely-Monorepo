import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getSellerOrders } from '@/lib/queries/orders';
import { getActiveLocalTransactionsForUser, getCompletedLocalTransactionsForUser } from '@/lib/queries/local-transaction';
import { SellerOrderList } from '@/components/pages/orders/seller-order-list';

export const dynamic = 'force-dynamic';

export default async function SellerOrdersPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Get all seller orders and local transactions in parallel
  const [{ items: orders }, activeLocalTxns, completedLocalTxns] = await Promise.all([
    getSellerOrders(session.user.id, { page: 1, pageSize: 50 }),
    getActiveLocalTransactionsForUser(session.user.id),
    getCompletedLocalTransactionsForUser(session.user.id, 10),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your customer orders
        </p>
      </div>

      {activeLocalTxns.length > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-900">
            {activeLocalTxns.length} active local pickup{activeLocalTxns.length !== 1 ? 's' : ''}
          </p>
          {activeLocalTxns.map((txn) => (
            <div key={txn.id} className="flex items-center justify-between text-xs text-blue-800">
              <span className="font-mono">{txn.id.slice(0, 8)}</span>
              <span>{txn.status}</span>
              <span>{txn.scheduledAt ? txn.scheduledAt.toLocaleDateString() : '—'}</span>
            </div>
          ))}
        </div>
      )}

      <SellerOrderList orders={orders} />

      {completedLocalTxns.length > 0 && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">
            Completed local pickups ({completedLocalTxns.length})
          </h2>
          {completedLocalTxns.map((txn) => (
            <div key={txn.id} className="flex items-center justify-between text-xs text-gray-600 border-b border-gray-100 pb-1 last:border-0 last:pb-0">
              <span className="font-mono">{txn.id.slice(0, 8)}</span>
              <span>{txn.status}</span>
              <span>{txn.confirmedAt ? txn.confirmedAt.toLocaleDateString() : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
