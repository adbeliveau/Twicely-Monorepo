import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@twicely/auth';
import { getOrderDetail } from '@/lib/queries/orders';
import {
  getProtectionStatus,
  getClaimWindows,
} from '@twicely/commerce/buyer-protection';
import { formatPrice } from '@twicely/utils/format';
import { Shield, AlertTriangle } from 'lucide-react';
import { ProtectionClaimForm } from './dispute-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BuyerProtectionClaimPage({ params }: PageProps) {
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

  // Get protection status and claim windows from platform_settings
  const [protectionStatus, claimWindows] = await Promise.all([
    getProtectionStatus(orderId),
    getClaimWindows(),
  ]);

  // If already has a claim, redirect to it
  if (protectionStatus.hasActiveClaim && protectionStatus.claimId) {
    redirect(`/my/disputes/${protectionStatus.claimId}`);
  }

  // Check eligibility
  if (!protectionStatus.eligible) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/my/buying/orders/${orderId}`}
          className="text-sm text-primary hover:text-primary/80 mb-4 inline-block"
        >
          &larr; Back to order
        </Link>
        <div className="rounded-lg border bg-gray-50 p-6 text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Not Eligible for Protection</h2>
          <p className="text-gray-600">
            This order is not eligible for buyer protection. Orders must be paid through the platform
            and be in an eligible status.
          </p>
        </div>
      </div>
    );
  }

  // Check window
  if (!protectionStatus.windowOpen) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/my/buying/orders/${orderId}`}
          className="text-sm text-primary hover:text-primary/80 mb-4 inline-block"
        >
          &larr; Back to order
        </Link>
        <div className="rounded-lg border bg-red-50 p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Protection Window Closed</h2>
          <p className="text-red-700">
            The {claimWindows.standardDays}-day buyer protection window has expired for this order.
          </p>
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
        &larr; Back to order
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">Buyer Protection Claim</h1>
      </div>
      <p className="text-gray-600 mb-6">
        Order #{ord.orderNumber} &middot; {protectionStatus.daysRemaining} days remaining
      </p>

      {/* Protection info */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mb-6">
        <h3 className="font-medium text-primary mb-2">Twicely Buyer Protection</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>&bull; Standard claims: {claimWindows.standardDays} days from delivery</li>
          <li>&bull; Counterfeit claims: {claimWindows.counterfeitDays} days from delivery</li>
          <li>&bull; Refunds backed by our platform fund</li>
        </ul>
      </div>

      {/* Order summary */}
      <div className="rounded-lg border bg-gray-50 p-4 mb-6">
        <h3 className="font-medium mb-2">Order Details</h3>
        <div className="space-y-2 text-sm">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>{item.title} &times; {item.quantity}</span>
              <span className="font-medium">{formatPrice(item.unitPriceCents * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t pt-2 font-medium flex justify-between">
            <span>Order Total</span>
            <span>{formatPrice(ord.totalCents)}</span>
          </div>
        </div>
      </div>

      <ProtectionClaimForm
        orderId={orderId}
        buyerId={session.user.id}
      />
    </div>
  );
}
