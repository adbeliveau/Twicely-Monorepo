import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@twicely/auth';
import { getOrderDetail } from '@/lib/queries/orders';
import { getReturnWindowDays, getCounterfeitWindowDays } from '@twicely/commerce/returns';
import { formatPrice } from '@twicely/utils/format';
import { Button } from '@twicely/ui/button';
import { db } from '@twicely/db';
import { returnRequest } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { ReturnRequestForm } from './return-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RequestReturnPage({ params }: PageProps) {
  const { id: orderId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  const orderData = await getOrderDetail(orderId, session.user.id);

  if (!orderData) {
    notFound();
  }

  // Verify user is the buyer
  if (orderData.order.buyerId !== session.user.id) {
    notFound();
  }

  const { order: ord, items } = orderData;

  // Check if return already exists
  const [existingReturn] = await db
    .select({ id: returnRequest.id, status: returnRequest.status })
    .from(returnRequest)
    .where(eq(returnRequest.orderId, orderId))
    .limit(1);

  if (existingReturn) {
    redirect(`/my/returns/${existingReturn.id}`);
  }

  // Must be delivered or completed
  if (!['DELIVERED', 'COMPLETED'].includes(ord.status)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/my/buying/orders/${orderId}`}
          className="text-sm text-primary hover:text-primary/80 mb-4 inline-block"
        >
          ← Back to order
        </Link>
        <div className="rounded-lg border bg-yellow-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Return Not Available</h2>
          <p className="text-yellow-700">
            Returns can only be requested after the order has been delivered.
          </p>
        </div>
      </div>
    );
  }

  // Check window (standard 30-day window)
  const deliveredAt = ord.deliveredAt;
  let withinWindow = false;
  let daysRemaining = 0;

  const returnWindowDays = await getReturnWindowDays();
  const counterfeitWindowDays = await getCounterfeitWindowDays();

  if (deliveredAt) {
    const windowEnd = new Date(deliveredAt.getTime() + returnWindowDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    withinWindow = now <= windowEnd;
    daysRemaining = Math.max(0, Math.ceil((windowEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  }

  if (!withinWindow) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/my/buying/orders/${orderId}`}
          className="text-sm text-primary hover:text-primary/80 mb-4 inline-block"
        >
          ← Back to order
        </Link>
        <div className="rounded-lg border bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Return Window Closed</h2>
          <p className="text-red-700">
            The {returnWindowDays}-day return window has expired. You may still be able to file
            a counterfeit claim within {counterfeitWindowDays} days.
          </p>
          <Link href={`/my/buying/orders/${orderId}/dispute`}>
            <Button variant="outline" className="mt-4">
              File Protection Claim
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={`/my/buying/orders/${orderId}`}
        className="text-sm text-primary hover:text-primary/80 mb-4 inline-block"
      >
        ← Back to order
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Request a Return</h1>
      <p className="text-gray-600 mb-6">
        Order #{ord.orderNumber} · {daysRemaining} days remaining in return window
      </p>

      {/* Order summary */}
      <div className="rounded-lg border bg-gray-50 p-4 mb-6">
        <h3 className="font-medium mb-2">Items in this order</h3>
        <div className="space-y-2 text-sm">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>{item.title} × {item.quantity}</span>
              <span className="font-medium">{formatPrice(item.unitPriceCents * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t pt-2 font-medium flex justify-between">
            <span>Order Total</span>
            <span>{formatPrice(ord.totalCents)}</span>
          </div>
        </div>
      </div>

      <ReturnRequestForm
        orderId={orderId}
        buyerId={session.user.id}
      />
    </div>
  );
}
