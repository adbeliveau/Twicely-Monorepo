import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@twicely/auth';
import { getOrderDetail } from '@/lib/queries/orders';
import { formatPrice } from '@twicely/utils/format';
import { ShipOrderForm } from '@/components/pages/orders/ship-order-form';
import { Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ShipOrderPage({ params }: PageProps) {
  const { id: orderId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  const orderData = await getOrderDetail(orderId, session.user.id);

  if (!orderData) {
    notFound();
  }

  // Verify user is the seller
  if (orderData.order.sellerId !== session.user.id) {
    notFound();
  }

  // Gate: Order must be PAID
  if (orderData.order.status !== 'PAID') {
    redirect(`/my/selling/orders/${orderId}`);
  }

  const { order: ord, items } = orderData;
  const shippingAddress = ord.shippingAddressJson as {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/my/selling/orders/${orderId}`}
          className="text-sm text-primary hover:text-primary/80 mb-4 inline-block"
        >
          ← Back to order
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Ship Order</h1>
        <p className="text-sm text-gray-500 mt-1">
          Order #{ord.orderNumber}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left column: Ship form */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-4">Shipping Information</h2>
          <ShipOrderForm orderId={orderId} />
        </div>

        {/* Right column: Order summary */}
        <div className="space-y-6">
          {/* Items */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="font-semibold mb-4">Order Items</h2>
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-gray-100">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="font-semibold mb-4">Ship To</h2>
            <div className="text-sm">
              <p className="font-medium">{shippingAddress.name}</p>
              <p className="text-gray-600">{shippingAddress.address1}</p>
              {shippingAddress.address2 && (
                <p className="text-gray-600">{shippingAddress.address2}</p>
              )}
              <p className="text-gray-600">
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
              </p>
              <p className="text-gray-600">{shippingAddress.country}</p>
            </div>
          </div>

          {/* Total */}
          <div className="rounded-lg border bg-white p-6">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Order Total</span>
              <span className="text-lg font-bold">{formatPrice(ord.totalCents)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
