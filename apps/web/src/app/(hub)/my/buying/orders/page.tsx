import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getBuyerOrders } from '@/lib/queries/orders';
import { BuyerOrderList } from '@/components/pages/orders/buyer-order-list';

export const dynamic = 'force-dynamic';

export default async function MyPurchasesPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Get all orders (paginated, default 20 per page)
  const { items: orders } = await getBuyerOrders(session.user.id, {
    page: 1,
    pageSize: 20,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Purchases</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage all your orders
        </p>
      </div>

      <BuyerOrderList orders={orders} />
    </div>
  );
}
