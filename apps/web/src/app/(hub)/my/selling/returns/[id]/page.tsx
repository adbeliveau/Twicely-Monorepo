import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@twicely/auth';
import { db } from '@twicely/db';
import { returnRequest, orderItem, listingImage, user, order } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getReturnWithOrder } from '@/lib/queries/returns';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { Package, Clock, AlertTriangle } from 'lucide-react';
import { SellerReturnResponseForm } from './response-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const REASON_LABELS: Record<string, string> = {
  INAD: 'Item not as described',
  DAMAGED: 'Item arrived damaged',
  WRONG_ITEM: 'Wrong item received',
  COUNTERFEIT: 'Item is counterfeit',
  REMORSE: 'Changed my mind',
  INR: 'Item not received',
};

export default async function SellerReturnDetailPage({ params }: PageProps) {
  const { id: returnId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Get return with order details via query function
  const ret = await getReturnWithOrder(returnId);

  if (!ret) {
    notFound();
  }

  // Verify user is the seller
  if (ret.sellerId !== session.user.id) {
    notFound();
  }

  // Fetch supplementary display fields not in getReturnWithOrder
  const [supplement] = await db
    .select({
      buyerName: user.name,
      sellerResponseNote: returnRequest.sellerResponseNote,
      sellerRespondedAt: returnRequest.sellerRespondedAt,
      orderTotalCents: order.totalCents,
    })
    .from(returnRequest)
    .innerJoin(order, eq(returnRequest.orderId, order.id))
    .innerJoin(user, eq(returnRequest.buyerId, user.id))
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  // Fetch items with listingId for image lookup
  const items = await db
    .select({
      id: orderItem.id,
      title: orderItem.title,
      quantity: orderItem.quantity,
      unitPriceCents: orderItem.unitPriceCents,
      listingId: orderItem.listingId,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, ret.orderId));

  // Get primary images for items
  const listingIds = items.map((i) => i.listingId);
  const images = listingIds.length > 0
    ? await db
        .select({ listingId: listingImage.listingId, url: listingImage.url })
        .from(listingImage)
        .where(and(inArray(listingImage.listingId, listingIds), eq(listingImage.isPrimary, true)))
    : [];

  const imageMap = new Map(images.map((img) => [img.listingId, img.url]));

  const photos = (ret.evidencePhotos as string[]) ?? [];
  const canRespond = ret.status === 'PENDING_SELLER';
  const isOverdue = ret.sellerResponseDueAt && new Date(ret.sellerResponseDueAt) < new Date();
  const nowMs = new Date().getTime();
  const hoursRemaining = ret.sellerResponseDueAt
    ? Math.max(0, Math.floor((new Date(ret.sellerResponseDueAt).getTime() - nowMs) / (1000 * 60 * 60)))
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/my/selling/returns"
        className="text-sm text-primary hover:text-primary/80 mb-4 inline-block"
      >
        ← Back to returns
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Return Request</h1>
          <p className="text-sm text-gray-500 mt-1">
            Order #{ret.orderNumber} · {formatDate(ret.createdAt)}
          </p>
        </div>
        {canRespond && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
            <Clock className="h-4 w-4" />
            {isOverdue ? 'Overdue' : `${hoursRemaining}h remaining`}
          </span>
        )}
      </div>

      {/* Warning for overdue */}
      {isOverdue && canRespond && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800">Response overdue</h3>
              <p className="text-sm text-red-700 mt-1">
                This return request may be auto-approved if not responded to soon.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Buyer info */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-4">Buyer Request</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500">From:</span>
              <span className="ml-2 font-medium">{supplement?.buyerName}</span>
            </div>
            <div>
              <span className="text-gray-500">Reason:</span>
              <span className="ml-2 font-medium">{REASON_LABELS[ret.reason] ?? ret.reason}</span>
            </div>
            <div>
              <span className="text-gray-500">Description:</span>
              <p className="mt-1 text-gray-700 bg-gray-50 p-3 rounded">{ret.description}</p>
            </div>
            {photos.length > 0 && (
              <div>
                <span className="text-gray-500">Evidence photos:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {photos.map((photo, i) => (
                    <a
                      key={i}
                      href={photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-20 w-20 rounded border overflow-hidden bg-gray-100 hover:opacity-80 transition-opacity"
                    >
                      <img src={photo} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order items */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-4">Items Being Returned</h2>
          <div className="divide-y">
            {items.map((item) => {
              const imageUrl = imageMap.get(item.listingId);

              return (
                <div key={item.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={item.title ?? 'Item'}
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
              );
            })}
          </div>
          <div className="border-t mt-4 pt-4 flex justify-between font-semibold">
            <span>Order Total</span>
            <span>{formatPrice(supplement?.orderTotalCents ?? 0)}</span>
          </div>
        </div>

        {/* Response form or existing response */}
        {canRespond ? (
          <SellerReturnResponseForm
            returnId={returnId}
            reason={ret.reason}
          />
        ) : supplement?.sellerResponseNote ? (
          <div className="rounded-lg border bg-white p-6">
            <h2 className="font-semibold mb-4">Your Response</h2>
            <p className="text-sm text-gray-700">{supplement.sellerResponseNote}</p>
            {supplement.sellerRespondedAt && (
              <p className="text-xs text-gray-500 mt-2">
                Responded {formatDate(supplement.sellerRespondedAt)}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
