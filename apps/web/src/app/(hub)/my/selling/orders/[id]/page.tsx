import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@twicely/auth';
import { getOrderDetail } from '@/lib/queries/orders';
import { formatDate } from '@twicely/utils/format';
import { OrderStatusBadge } from '@/components/pages/orders/order-status-badge';
import { ShippingTracker } from '@/components/pages/orders/shipping-tracker';
import { ShieldCheck, HelpCircle, MapPin, AlertTriangle } from 'lucide-react';
import { OrderItems } from './_components/order-items';
import { PaymentSummary } from './_components/payment-summary';
import { OrderActions } from './_components/order-actions';
import { ReviewSection } from './_components/review-section';
import { ShippingQuoteCard } from '@/components/seller/shipping-quote-card';
import { getShippingQuoteByOrderId } from '@/lib/queries/shipping-quote';
import { ShippingAddressCard } from './_components/shipping-address-card';
import { getLocalTransactionByOrderId, getMeetupPhotoContext } from '@/lib/queries/local-transaction';
import { getSafeMeetupLocationById } from '@/lib/queries/safe-meetup-locations';
import { LocalMeetupCard } from '@/components/local/local-meetup-card';
import { SafeMeetupLocationCard } from '@/components/local/safe-meetup-location-card';
import { MeetupPhotoContextCard } from '@/components/local/meetup-photo-context-card';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getReliabilityDisplay } from '@twicely/commerce/local-reliability';
import { loadOrderReviewData, RESPONSE_WINDOW_DAYS } from './_components/order-review-data';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SellerOrderDetailPage({ params }: PageProps) {
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

  const { order: ord, items, shipment: ship, buyer } = orderData;
  const shippingAddress = ord.shippingAddressJson as {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  // Show buyer name as first name + last initial
  const nameParts = buyer.name.split(' ');
  const buyerDisplayName = nameParts[0] + (nameParts[1]?.[0] ? ` ${nameParts[1][0]}.` : '');

  const [reviewData, shippingQuote, localTransaction, maxAdjustmentPercent, cancelLateHours, cancelSamedayHours, buyerReliability] = await Promise.all([
    loadOrderReviewData(orderId, ord.status, ord.deliveredAt),
    getShippingQuoteByOrderId(orderId, session.user.id),
    ord.isLocalPickup ? getLocalTransactionByOrderId(orderId) : Promise.resolve(null),
    getPlatformSetting<number>('commerce.local.maxAdjustmentPercent', 33),
    getPlatformSetting<number>('commerce.local.cancelLateHours', 24),
    getPlatformSetting<number>('commerce.local.cancelSamedayHours', 2),
    ord.isLocalPickup ? getReliabilityDisplay(ord.buyerId) : Promise.resolve(null),
  ]);

  const { orderReview, existingResponse, canRespondToReview, canEditResponse, existingBuyerReview, canRateBuyer } = reviewData;

  const [meetupLocation, meetupPhotoContext] = localTransaction
    ? await Promise.all([
        localTransaction.meetupLocationId
          ? getSafeMeetupLocationById(localTransaction.meetupLocationId)
          : Promise.resolve(null),
        getMeetupPhotoContext(localTransaction.id),
      ])
    : [null, null];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/my/selling/orders"
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
              Placed on {formatDate(ord.createdAt)} by {buyerDisplayName}
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
        <ShippingTracker
          status={ord.status}
          paidAt={ord.paidAt}
          shippedAt={ord.shippedAt}
          deliveredAt={ord.deliveredAt}
        />

        {ord.isLocalPickup && ( /* G2.3: Local Pickup */
          localTransaction
            ? <LocalMeetupCard transaction={localTransaction} role="SELLER" currentUserId={session.user.id} otherPartyName={buyerDisplayName} originalPriceCents={ord.itemSubtotalCents} maxDiscountPercent={maxAdjustmentPercent} cancelLateHours={cancelLateHours} cancelSamedayHours={cancelSamedayHours} counterpartyReliability={buyerReliability} />
            : <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="size-5 text-brand-500" strokeWidth={2} />
                  <span className="font-medium">Local Pickup</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  The buyer will coordinate the meetup via Messages.
                </p>
              </div>
        )}

        {/* Safe meetup location detail — rendered when location is a verified safe spot */}
        {meetupLocation && <SafeMeetupLocationCard location={meetupLocation} />}

        {/* Photo evidence context — visible to seller for dispute awareness */}
        {meetupPhotoContext && <MeetupPhotoContextCard context={meetupPhotoContext} />}

        {/* B3.5: Authentication Status */}
        {ord.authenticationOffered && (
          <div className="rounded-lg border bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">Authentication Requested</p>
                <p className="text-sm text-gray-600">
                  The buyer has requested professional authentication for this order
                </p>
              </div>
            </div>
          </div>
        )}

        <OrderActions
          orderId={orderId}
          status={ord.status}
          isLocalPickup={ord.isLocalPickup}
          canRateBuyer={canRateBuyer}
          buyerDisplayName={buyerDisplayName}
          existingBuyerReview={existingBuyerReview}
        />

        {/* D2.2: Combined Shipping Quote Card */}
        {shippingQuote && <ShippingQuoteCard quote={shippingQuote} />}

        {/* Buyer Note / Gift Message */}
        {(ord.buyerNote || (ord.isGift && ord.giftMessage)) && (
          <div className="rounded-lg border bg-blue-50 p-4">
            <h3 className="text-sm font-semibold mb-2">
              {ord.isGift ? 'Gift Message' : 'Buyer Note'}
            </h3>
            <p className="text-sm text-gray-700">
              {ord.isGift && ord.giftMessage ? ord.giftMessage : ord.buyerNote}
            </p>
          </div>
        )}

        <OrderItems items={items} />

        <PaymentSummary
          itemSubtotalCents={ord.itemSubtotalCents}
          shippingCents={ord.shippingCents}
          taxCents={ord.taxCents}
          totalCents={ord.totalCents}
          tfAmountCents={ord.tfAmountCents}
          stripeFeesCents={ord.stripeFeesCents}
        />

        {/* Shipping Address */}
        <ShippingAddressCard address={shippingAddress} />

        {/* Tracking Info (if shipped) */}
        {ship && ship.tracking && (
          <div className="rounded-lg border bg-white p-6">
            <h2 className="font-semibold mb-4">Tracking Information</h2>
            <div className="text-sm">
              <p className="text-gray-600">Carrier: {ship.carrier ?? 'N/A'}</p>
              <p className="font-mono text-gray-900 mt-1">{ship.tracking}</p>
              {ord.isLateShipment && (
                <p className="text-red-600 mt-2 text-xs flex items-center gap-1">
                  <AlertTriangle className="size-3.5" strokeWidth={2} /> Late shipment
                </p>
              )}
            </div>
          </div>
        )}

        {/* Cancel Info (if canceled) */}
        {ord.status === 'CANCELED' && ord.cancelReason && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h2 className="font-semibold mb-2 text-red-900">Order Canceled</h2>
            <p className="text-sm text-red-800">Reason: {ord.cancelReason}</p>
          </div>
        )}

        {orderReview && (
          <ReviewSection
            orderReview={orderReview}
            existingResponse={existingResponse}
            canRespondToReview={canRespondToReview}
            canEditResponse={canEditResponse}
            responseWindowDays={RESPONSE_WINDOW_DAYS}
          />
        )}
      </div>
    </div>
  );
}
