import { notFound } from 'next/navigation';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { dispute, order, user, returnRequest } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { ArrowLeft } from 'lucide-react';
import { DisputeActions } from './dispute-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminDisputeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { ability, session } = await staffAuthorize();
  if (!ability.can('read', 'Dispute')) {
    return <p className="text-red-600">Access denied</p>;
  }

  // Get dispute with related data
  const [disp] = await db
    .select({
      id: dispute.id,
      status: dispute.status,
      claimType: dispute.claimType,
      description: dispute.description,
      evidencePhotos: dispute.evidencePhotos,
      resolutionNote: dispute.resolutionNote,
      resolutionAmountCents: dispute.resolutionAmountCents,
      resolvedByStaffId: dispute.resolvedByStaffId,
      resolvedAt: dispute.resolvedAt,
      createdAt: dispute.createdAt,
      deadlineAt: dispute.deadlineAt,
      orderId: dispute.orderId,
      buyerId: dispute.buyerId,
      sellerId: dispute.sellerId,
      returnRequestId: dispute.returnRequestId,
      orderNumber: order.orderNumber,
      orderTotalCents: order.totalCents,
    })
    .from(dispute)
    .innerJoin(order, eq(dispute.orderId, order.id))
    .where(eq(dispute.id, id))
    .limit(1);

  if (!disp) {
    notFound();
  }

  // Get buyer and seller names
  const [buyer] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, disp.buyerId))
    .limit(1);

  const [seller] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, disp.sellerId))
    .limit(1);

  // Get return request if linked
  let returnReq = null;
  if (disp.returnRequestId) {
    const [ret] = await db
      .select({
        reason: returnRequest.reason,
        description: returnRequest.description,
        status: returnRequest.status,
      })
      .from(returnRequest)
      .where(eq(returnRequest.id, disp.returnRequestId))
      .limit(1);
    returnReq = ret;
  }

  const isOpen = ['OPEN', 'UNDER_REVIEW'].includes(disp.status);
  const isAssigned = disp.resolvedByStaffId === session.staffUserId;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/mod/disputes"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Disputes
      </Link>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-primary">
                Dispute #{disp.id.slice(0, 8)}
              </h1>
              <p className="text-sm text-gray-500">
                Order #{disp.orderNumber} - {disp.claimType}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              disp.status === 'OPEN' ? 'bg-yellow-100 text-yellow-800' :
              disp.status === 'UNDER_REVIEW' ? 'bg-blue-100 text-blue-800' :
              disp.status.startsWith('RESOLVED') ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {disp.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Parties */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Buyer</h3>
              <p className="font-medium">{buyer?.name ?? 'Unknown'}</p>
              <p className="text-sm text-gray-500">{buyer?.email}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Seller</h3>
              <p className="font-medium">{seller?.name ?? 'Unknown'}</p>
              <p className="text-sm text-gray-500">{seller?.email}</p>
            </div>
          </div>

          {/* Details */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Claim Details</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap">{disp.description ?? 'No description provided'}</p>
            </div>
          </div>

          {/* Return Request Info */}
          {returnReq && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Linked Return Request</h3>
              <div className="bg-gray-50 rounded-lg p-4 text-sm">
                <p><span className="font-medium">Reason:</span> {returnReq.reason}</p>
                <p><span className="font-medium">Status:</span> {returnReq.status}</p>
                {returnReq.description && (
                  <p className="mt-2">{returnReq.description}</p>
                )}
              </div>
            </div>
          )}

          {/* Evidence Photos */}
          {disp.evidencePhotos && disp.evidencePhotos.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Evidence Photos</h3>
              <div className="flex gap-2 flex-wrap">
                {disp.evidencePhotos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Evidence ${i + 1}`} className="h-24 w-24 object-cover rounded border" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Amounts */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Order Total</h3>
              <p className="text-lg font-bold">{formatPrice(disp.orderTotalCents)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Created</h3>
              <p className="text-sm">{formatDate(disp.createdAt)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Deadline</h3>
              <p className="text-sm">{disp.deadlineAt ? formatDate(disp.deadlineAt) : '—'}</p>
            </div>
          </div>

          {/* Resolution (if resolved) */}
          {disp.resolutionNote && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Resolution</h3>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm">{disp.resolutionNote}</p>
                {disp.resolutionAmountCents && (
                  <p className="mt-2 font-medium">
                    Refund Amount: {formatPrice(disp.resolutionAmountCents)}
                  </p>
                )}
                {disp.resolvedAt && (
                  <p className="text-xs text-gray-500 mt-2">
                    Resolved on {formatDate(disp.resolvedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {isOpen && (
            <DisputeActions
              disputeId={disp.id}
              status={disp.status}
              isAssigned={isAssigned}
              orderTotalCents={disp.orderTotalCents}
            />
          )}
        </div>
      </div>
    </div>
  );
}
