import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@twicely/auth';
import { getBuyerOrders } from '@/lib/queries/orders';
import { getReturnCountsByBuyer } from '@/lib/queries/returns';
import { BuyerOrderList } from '@/components/pages/orders/buyer-order-list';
import { Package, RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BuyingOverviewPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Get last 5 orders and return counts
  const [{ items: recentOrders }, returnCounts] = await Promise.all([
    getBuyerOrders(session.user.id, { page: 1, pageSize: 5 }),
    getReturnCountsByBuyer(session.user.id),
  ]);

  const activeReturnCount = (
    (returnCounts.PENDING_SELLER ?? 0) +
    (returnCounts.APPROVED ?? 0) +
    (returnCounts.LABEL_GENERATED ?? 0) +
    (returnCounts.SHIPPED ?? 0) +
    (returnCounts.DELIVERED ?? 0) +
    (returnCounts.PARTIAL_OFFERED ?? 0) +
    (returnCounts.ESCALATED ?? 0) +
    (returnCounts.CONDITION_DISPUTE ?? 0)
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Purchases</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage your orders
        </p>
      </div>

      {/* Active Returns Summary */}
      {activeReturnCount > 0 && (
        <Link
          href="/my/buying/orders"
          className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 hover:bg-blue-100 transition-colors mb-6"
        >
          <RotateCcw className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{activeReturnCount} active {activeReturnCount === 1 ? 'return' : 'returns'}</span>
            {' '}in progress
          </span>
        </Link>
      )}

      {recentOrders.length === 0 ? (
        <div className="text-center py-12 rounded-lg border bg-white">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            You haven&apos;t bought anything yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Start shopping to see your orders here
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90"
            >
              Browse Items
            </Link>
          </div>
        </div>
      ) : (
        <>
          <BuyerOrderList orders={recentOrders} />

          <div className="mt-6 text-center">
            <Link
              href="/my/buying/orders"
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              View all orders →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
