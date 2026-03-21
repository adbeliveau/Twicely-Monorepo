import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@twicely/auth';
import { db } from '@twicely/db';
import { dispute, order, orderItem, user, listingImage } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { Package, Shield } from 'lucide-react';
import { STATUS_CONFIG, CLAIM_TYPE_LABELS } from './_constants/dispute-config';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DisputeDetailPage({ params }: PageProps) {
  const { id: disputeId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Get dispute details
  const [disp] = await db
    .select({
      id: dispute.id,
      orderId: dispute.orderId,
      buyerId: dispute.buyerId,
      sellerId: dispute.sellerId,
      claimType: dispute.claimType,
      status: dispute.status,
      description: dispute.description,
      evidencePhotos: dispute.evidencePhotos,
      sellerResponseNote: dispute.sellerResponseNote,
      sellerEvidencePhotos: dispute.sellerEvidencePhotos,
      resolutionNote: dispute.resolutionNote,
      resolutionAmountCents: dispute.resolutionAmountCents,
      createdAt: dispute.createdAt,
      resolvedAt: dispute.resolvedAt,
      deadlineAt: dispute.deadlineAt,
      orderNumber: order.orderNumber,
      orderTotalCents: order.totalCents,
    })
    .from(dispute)
    .innerJoin(order, eq(dispute.orderId, order.id))
    .where(eq(dispute.id, disputeId))
    .limit(1);

  if (!disp) {
    notFound();
  }

  // Verify user is involved (buyer or seller)
  const isBuyer = disp.buyerId === session.user.id;
  const isSeller = disp.sellerId === session.user.id;

  if (!isBuyer && !isSeller) {
    notFound();
  }

  // Get other party's name
  const [otherParty] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, isBuyer ? disp.sellerId : disp.buyerId))
    .limit(1);

  // Get order items
  const items = await db
    .select({
      id: orderItem.id,
      title: orderItem.title,
      quantity: orderItem.quantity,
      unitPriceCents: orderItem.unitPriceCents,
      listingId: orderItem.listingId,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, disp.orderId));

  // Get primary images for items
  const listingIds = items.map((i) => i.listingId);
  const images = listingIds.length > 0
    ? await db
        .select({ listingId: listingImage.listingId, url: listingImage.url })
        .from(listingImage)
        .where(and(inArray(listingImage.listingId, listingIds), eq(listingImage.isPrimary, true)))
    : [];

  const imageMap = new Map(images.map((img) => [img.listingId, img.url]));

  const statusEntry = STATUS_CONFIG[disp.status] ?? STATUS_CONFIG['CLOSED'];
  if (!statusEntry) notFound();
  const status = statusEntry;
  const StatusIcon = status.icon;
  const photos = (disp.evidencePhotos as string[]) ?? [];
  const sellerPhotos = (disp.sellerEvidencePhotos as string[]) ?? [];
  const isResolved = ['RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED'].includes(disp.status);

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
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">
              {isBuyer ? 'Protection Claim' : 'Dispute Case'}
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Order #{disp.orderNumber} · Opened {formatDate(disp.createdAt)}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${status.color}`}>
          <StatusIcon className="h-4 w-4" />
          {status.label}
        </span>
      </div>

      {/* Status message */}
      <div className={`rounded-lg border p-4 mb-6 ${isResolved ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'}`}>
        <p className={isResolved ? 'text-gray-700' : 'text-blue-700'}>{status.description}</p>
        {disp.deadlineAt && !isResolved && (
          <p className="text-sm text-gray-500 mt-2">
            Decision expected by {formatDate(disp.deadlineAt)}
          </p>
        )}
      </div>

      <div className="space-y-6">
        {/* Claim details */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-4">Claim Details</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500">Claim type:</span>
              <span className="ml-2 font-medium">
                {CLAIM_TYPE_LABELS[disp.claimType] ?? disp.claimType}
              </span>
            </div>
            <div>
              <span className="text-gray-500">{isBuyer ? 'Against' : 'Filed by'}:</span>
              <span className="ml-2 font-medium">{otherParty?.name ?? 'Unknown'}</span>
            </div>
            <div>
              <span className="text-gray-500">Description:</span>
              <p className="mt-1 text-gray-700 bg-gray-50 p-3 rounded">{disp.description}</p>
            </div>
            {photos.length > 0 && (
              <div>
                <span className="text-gray-500">Buyer evidence:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {photos.map((photo, i) => (
                    <a
                      key={i}
                      href={photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-16 w-16 rounded border overflow-hidden bg-gray-100"
                    >
                      <img src={photo} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Seller response (if any) */}
        {disp.sellerResponseNote && (
          <div className="rounded-lg border bg-white p-6">
            <h2 className="font-semibold mb-4">Seller Response</h2>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{disp.sellerResponseNote}</p>
            {sellerPhotos.length > 0 && (
              <div className="mt-3">
                <span className="text-sm text-gray-500">Seller evidence:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {sellerPhotos.map((photo, i) => (
                    <a
                      key={i}
                      href={photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-16 w-16 rounded border overflow-hidden bg-gray-100"
                    >
                      <img src={photo} alt={`Seller evidence ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resolution (if resolved) */}
        {isResolved && disp.resolutionNote && (
          <div className={`rounded-lg border p-6 ${disp.status === 'RESOLVED_BUYER' ? 'bg-green-50' : 'bg-gray-50'}`}>
            <h2 className="font-semibold mb-4">Resolution</h2>
            <p className="text-sm text-gray-700">{disp.resolutionNote}</p>
            {disp.resolutionAmountCents && disp.resolutionAmountCents > 0 && (
              <p className="text-sm font-medium text-green-700 mt-3">
                Refund amount: {formatPrice(disp.resolutionAmountCents)}
              </p>
            )}
            {disp.resolvedAt && (
              <p className="text-xs text-gray-500 mt-2">
                Resolved {formatDate(disp.resolvedAt)}
              </p>
            )}
          </div>
        )}

        {/* Order items */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-4">Order Items</h2>
          <div className="divide-y">
            {items.map((item) => {
              const imageUrl = imageMap.get(item.listingId);

              return (
                <div key={item.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
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
              );
            })}
          </div>
          <div className="border-t mt-4 pt-4 flex justify-between font-semibold">
            <span>Order Total</span>
            <span>{formatPrice(disp.orderTotalCents)}</span>
          </div>
        </div>

        {/* Help text */}
        <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
          <p>
            Need help with this case? Contact our support team at{' '}
            <a href="mailto:support@twicely.co" className="text-primary hover:underline">
              support@twicely.co
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
