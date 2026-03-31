import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@twicely/auth';
import { getOrderDetail } from '@/lib/queries/orders';
import { confirmDelivery } from '@/lib/actions/orders';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { OrderStatusBadge } from '@/components/pages/orders/order-status-badge';
import { ShippingTracker } from '@/components/pages/orders/shipping-tracker';
import { Button } from '@twicely/ui/button';
import { Package, RotateCcw, Shield, ShieldCheck, HelpCircle } from 'lucide-react';
import { BuyerReviewSection } from './_components/buyer-review-section';
import { ShippingQuoteStatus } from '@/components/buyer/shipping-quote-status';
import { getShippingQuoteByOrderId } from '@/lib/queries/shipping-quote';
import { getLocalTransactionByOrderId } from '@/lib/queries/local-transaction';
import { LocalMeetupCard } from '@/components/local/local-meetup-card';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getReliabilityDisplay } from '@twicely/commerce/local-reliability';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BuyerOrderDetailPage({ params }: PageProps) {
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

  const { order: ord, items, shipment: ship, seller } = orderData;

  // Fetch combined shipping quote if present
  const shippingQuote = await getShippingQuoteByOrderId(orderId, session.user.id);

  // Fetch local transaction and counterparty reliability for local pickup orders
  const [localTransaction, maxAdjustmentPercent, sellerReliability] = await Promise.all([
    ord.isLocalPickup ? getLocalTransactionByOrderId(orderId) : Promise.resolve(null),
    getPlatformSetting<number>('commerce.local.maxAdjustmentPercent', 33),
    ord.isLocalPickup ? getReliabilityDisplay(ord.sellerId) : Promise.resolve(null),
  ]);

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
          href="/my/buying/orders"
          className="text-sm text-primary hover:text-primary/80 mb-4 inline-block"
        >
          ← Back to orders
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Order #{ord.orderNumber}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Placed on {formatDate(ord.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <OrderStatusBadge status={ord.status} />
            <Link
              href={`/h/contact?type=ORDER&orderId=${orderId}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <HelpCircle className="h-4 w-4" />
              Get Help
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* G2.3: Local Pickup — meetup card or shipping tracker */}
        {ord.isLocalPickup ? (
          localTransaction ? (
            <LocalMeetupCard
              transaction={localTransaction}
              role="BUYER"
              currentUserId={session.user.id}
              otherPartyName={seller.storeName ?? seller.name}
              originalPriceCents={ord.itemSubtotalCents}
              maxDiscountPercent={maxAdjustmentPercent}
              counterpartyReliability={sellerReliability}
            />
          ) : (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">📍</span>
                <span className="font-medium">Local Pickup</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Coordinate the meetup with the seller via Messages.
              </p>
            </div>
          )
        ) : (
          <ShippingTracker
            status={ord.status}
            paidAt={ord.paidAt}
            shippedAt={ord.shippedAt}
            deliveredAt={ord.deliveredAt}
          />
        )}

        {/* B3.5: Authentication Status */}
        {ord.authenticationOffered && (
          <div className="rounded-lg border bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">Authentication Requested</p>
                <p className="text-sm text-gray-600">
                  Your item will be professionally authenticated before delivery
                </p>
              </div>
            </div>
          </div>
        )}

        {/* D2.2: Combined Shipping Quote Status */}
        {shippingQuote && (
          <ShippingQuoteStatus quote={shippingQuote} orderId={orderId} />
        )}

        {/* Action buttons - only show Confirm Delivery for shipped (non-local) orders */}
        {ord.status === 'SHIPPED' && !ord.isLocalPickup && (
          <div className="rounded-lg border bg-white p-4">
            <form
              action={async () => {
                'use server';
                await confirmDelivery(orderId);
              }}
            >
              <Button type="submit" className="w-full sm:w-auto">
                Confirm Delivery
              </Button>
            </form>
          </div>
        )}

        {/* Return & Protection buttons (for delivered/completed orders) */}
        {['DELIVERED', 'COMPLETED'].includes(ord.status) && (
          <div className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap gap-3">
              <Link href={`/my/buying/orders/${orderId}/return`}>
                <Button variant="outline" className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Request Return
                </Button>
              </Link>
              <Link href={`/my/buying/orders/${orderId}/dispute`}>
                <Button variant="outline" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Protection Claim
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Review action button */}
        <BuyerReviewSection
          orderId={orderId}
          orderStatus={ord.status}
          deliveredAt={ord.deliveredAt}
        />

        {/* Order Items */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-4">Order Items</h2>
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-100">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {formatPrice(item.unitPriceCents * item.quantity)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatPrice(item.unitPriceCents)} each
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-4">Payment Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatPrice(ord.itemSubtotalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Shipping</span>
              <span>
                {ord.shippingCents === 0 ? 'Free' : formatPrice(ord.shippingCents)}
              </span>
            </div>
            {ord.taxCents > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Tax</span>
                <span>{formatPrice(ord.taxCents)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t font-semibold text-base">
              <span>Total</span>
              <span>{formatPrice(ord.totalCents)}</span>
            </div>
          </div>
        </div>

        {/* Shipping Address - hidden for local pickup */}
        {!ord.isLocalPickup && (
          <div className="rounded-lg border bg-white p-6">
            <h2 className="font-semibold mb-4">Shipping Address</h2>
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
        )}

        {/* Seller Info */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-4">Seller Information</h2>
          <div className="text-sm">
            <p className="font-medium">{seller.storeName ?? seller.name}</p>
          </div>
        </div>

        {/* Tracking Info (if shipped, not local pickup) */}
        {!ord.isLocalPickup && ship && ship.tracking && (
          <div className="rounded-lg border bg-white p-6">
            <h2 className="font-semibold mb-4">Tracking Information</h2>
            <div className="text-sm">
              <p className="text-gray-600">Carrier: {ship.carrier ?? 'N/A'}</p>
              <p className="font-mono text-gray-900 mt-1">{ship.tracking}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
