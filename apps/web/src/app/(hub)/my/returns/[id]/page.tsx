import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@twicely/auth';
import { getReturnDetails } from '@/lib/queries/returns';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { Button } from '@twicely/ui/button';
import { Package, AlertTriangle, CheckCircle, XCircle, Clock, Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_CONFIG = {
  PENDING_SELLER: {
    label: 'Awaiting Seller Response',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
    description: 'The seller has 3 business days to respond to your return request.',
  },
  APPROVED: {
    label: 'Approved - Ship Item',
    color: 'bg-blue-100 text-blue-800',
    icon: Truck,
    description: 'Your return has been approved. Please ship the item back to the seller.',
  },
  DECLINED: {
    label: 'Declined',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
    description: 'The seller declined your return request. You can escalate to a dispute.',
  },
  SHIPPED: {
    label: 'Return Shipped',
    color: 'bg-purple-100 text-purple-800',
    icon: Truck,
    description: 'Your return is on its way back to the seller.',
  },
  DELIVERED: {
    label: 'Return Delivered',
    color: 'bg-indigo-100 text-indigo-800',
    icon: Package,
    description: 'The seller has received your return. Refund will be processed soon.',
  },
  REFUND_ISSUED: {
    label: 'Refunded',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    description: 'Your refund has been processed.',
  },
  CLOSED: {
    label: 'Closed',
    color: 'bg-gray-100 text-gray-800',
    icon: XCircle,
    description: 'This return request has been closed.',
  },
  ESCALATED: {
    label: 'Escalated to Dispute',
    color: 'bg-orange-100 text-orange-800',
    icon: AlertTriangle,
    description: 'This case has been escalated for review by our team.',
  },
} as const;

const REASON_LABELS: Record<string, string> = {
  INAD: 'Item not as described',
  DAMAGED: 'Item arrived damaged',
  WRONG_ITEM: 'Wrong item received',
  COUNTERFEIT: 'Item is counterfeit',
  REMORSE: 'Changed my mind',
  INR: 'Item not received',
};

export default async function ReturnDetailPage({ params }: PageProps) {
  const { id: returnId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  const returnData = await getReturnDetails(returnId);

  if (!returnData) {
    notFound();
  }

  // Verify user is the buyer
  if (returnData.buyerId !== session.user.id) {
    notFound();
  }

  const status = STATUS_CONFIG[returnData.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.CLOSED;
  const StatusIcon = status.icon;
  const canEscalate = returnData.status === 'DECLINED' && !returnData.disputeId;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/my/buying/orders"
        className="text-sm text-primary hover:text-primary/80 mb-4 inline-block"
      >
        ← Back to orders
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Return Request</h1>
          <p className="text-sm text-gray-500 mt-1">
            Order #{returnData.orderNumber} · Opened {formatDate(returnData.createdAt)}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${status.color}`}>
          <StatusIcon className="h-4 w-4" />
          {status.label}
        </span>
      </div>

      {/* Status message */}
      <div className="rounded-lg border bg-gray-50 p-4 mb-6">
        <p className="text-gray-700">{status.description}</p>
      </div>

      {/* Escalate button if declined */}
      {canEscalate && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 mb-6">
          <h3 className="font-medium text-orange-800 mb-2">Not satisfied with the outcome?</h3>
          <p className="text-sm text-orange-700 mb-3">
            If you believe the seller&apos;s decision was unfair, you can escalate this to our team for review.
          </p>
          <Link href="/h/contact">
            <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Contact Support to Escalate
            </Button>
          </Link>
        </div>
      )}

      <div className="space-y-6">
        {/* Return reason */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-4">Return Details</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500">Reason:</span>
              <span className="ml-2 font-medium">{REASON_LABELS[returnData.reason] ?? returnData.reason}</span>
            </div>
            <div>
              <span className="text-gray-500">Description:</span>
              <p className="mt-1 text-gray-700">{returnData.description}</p>
            </div>
            {returnData.photos && returnData.photos.length > 0 && (
              <div>
                <span className="text-gray-500">Evidence photos:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {returnData.photos.map((photo: string, i: number) => (
                    <div key={i} className="h-16 w-16 rounded border overflow-hidden bg-gray-100">
                      <img src={photo} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Seller response */}
        {returnData.sellerResponse && (
          <div className="rounded-lg border bg-white p-6">
            <h2 className="font-semibold mb-4">Seller Response</h2>
            <p className="text-sm text-gray-700">{returnData.sellerResponse}</p>
            {returnData.respondedAt && (
              <p className="text-xs text-gray-500 mt-2">
                Responded {formatDate(returnData.respondedAt)}
              </p>
            )}
          </div>
        )}

        {/* Refund details (if refunded) */}
        {returnData.status === 'REFUND_ISSUED' && returnData.refundAmountCents && (
          <div className="rounded-lg border bg-green-50 p-6">
            <h2 className="font-semibold mb-4 text-green-800">Refund Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Refund amount</span>
                <span className="font-semibold text-green-800">
                  {formatPrice(returnData.refundAmountCents)}
                </span>
              </div>
              {returnData.restockingFeeCents && returnData.restockingFeeCents > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Restocking fee deducted</span>
                  <span>-{formatPrice(returnData.restockingFeeCents)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order items */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-4">Order Items</h2>
          <div className="divide-y">
            {returnData.items.map((item) => (
              <div key={item.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{item.title}</p>
                  <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                </div>
                <div className="text-right text-sm font-medium">
                  {formatPrice(item.unitPriceCents * item.quantity)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline (simplified) */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-4">Timeline</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-gray-400" />
              <span className="text-gray-600">Return requested</span>
              <span className="text-gray-400 ml-auto">{formatDate(returnData.createdAt)}</span>
            </div>
            {returnData.respondedAt && (
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-gray-400" />
                <span className="text-gray-600">
                  Seller {returnData.status === 'DECLINED' ? 'declined' : 'responded'}
                </span>
                <span className="text-gray-400 ml-auto">{formatDate(returnData.respondedAt)}</span>
              </div>
            )}
            {returnData.refundedAt && (
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-gray-600">Refund issued</span>
                <span className="text-gray-400 ml-auto">{formatDate(returnData.refundedAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
