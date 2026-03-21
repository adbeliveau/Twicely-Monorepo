import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getOrderById, getOrdersByPaymentIntent } from '@/lib/queries/order-detail';
import { finalizeOrder } from '@/lib/actions/checkout';
import { OrderConfirmation } from '@/components/pages/checkout/order-confirmation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Order Confirmation | Twicely',
};

interface ConfirmationPageProps {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>;
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: ConfirmationPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login?redirect=/checkout');
  }

  const { orderId } = await params;
  const { payment_intent, redirect_status } = await searchParams;

  // Handle 3DS redirect: finalize order if payment_intent is present
  if (payment_intent && redirect_status === 'succeeded') {
    // Verify this payment_intent belongs to the user
    const orders = await getOrdersByPaymentIntent(payment_intent);
    const userOwnsOrders = orders.some((o) => o.buyerId === session.user.id);

    if (userOwnsOrders) {
      // Finalize if not already finalized
      const needsFinalization = orders.some((o) => o.status === 'CREATED');
      if (needsFinalization) {
        await finalizeOrder(payment_intent);
      }
    }
  }

  // Fetch the order
  const order = await getOrderById(orderId, session.user.id);

  if (!order) {
    notFound();
  }

  // If order is still CREATED (payment not yet processed), show pending state
  if (order.status === 'CREATED') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-lg border bg-white p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Processing Payment</h1>
          <p className="text-muted-foreground">
            Your payment is being processed. Please wait...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <OrderConfirmation order={order} />
    </div>
  );
}
