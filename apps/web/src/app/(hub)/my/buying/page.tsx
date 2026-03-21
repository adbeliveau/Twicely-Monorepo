import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@twicely/auth';
import { getBuyerOrders } from '@/lib/queries/orders';
import { BuyerOrderList } from '@/components/pages/orders/buyer-order-list';
import { Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BuyingOverviewPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Get last 5 orders
  const { items: recentOrders } = await getBuyerOrders(session.user.id, {
    page: 1,
    pageSize: 5,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Purchases</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage your orders
        </p>
      </div>

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
