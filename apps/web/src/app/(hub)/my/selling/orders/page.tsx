import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getSellerOrders } from '@/lib/queries/orders';
import { SellerOrderList } from '@/components/pages/orders/seller-order-list';

export const dynamic = 'force-dynamic';

export default async function SellerOrdersPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Get all seller orders (PAID orders shown first)
  const { items: orders } = await getSellerOrders(session.user.id, {
    page: 1,
    pageSize: 50,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your customer orders
        </p>
      </div>

      <SellerOrderList orders={orders} />
    </div>
  );
}
