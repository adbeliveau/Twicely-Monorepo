// NAV_ENTRY: Review Moderation Detail | /mod/reviews/[id] | requires MODERATION or ADMIN
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getReviewForModeration } from '@/lib/queries/admin-moderation';
import { getReportsForTarget } from '@/lib/queries/content-reports';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ReviewModActions } from './review-mod-actions';

export const metadata: Metadata = { title: 'Review Detail | Twicely Hub' };

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-500 text-lg">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    APPROVED: 'bg-green-100 text-green-700',
    FLAGGED: 'bg-yellow-100 text-yellow-800',
    REMOVED: 'bg-red-100 text-red-700',
    PENDING: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default async function ReviewModerationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Review')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const [detail, reports] = await Promise.all([
    getReviewForModeration(id),
    getReportsForTarget('REVIEW', id),
  ]);
  if (!detail) notFound();

  const hasDsr = detail.dsrItemAsDescribed || detail.dsrShippingSpeed || detail.dsrCommunication || detail.dsrPackaging;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Review Detail"
        description={`Review ID: ${detail.id.slice(0, 12)}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column: review content */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-3">
              <StarDisplay rating={detail.rating} />
              <StatusBadge status={detail.status} />
              {detail.isVerifiedPurchase && (
                <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                  Verified Purchase
                </span>
              )}
            </div>

            {detail.title && (
              <h3 className="text-sm font-semibold text-gray-900">{detail.title}</h3>
            )}

            {detail.body && (
              <p className="text-sm text-gray-800 bg-gray-50 rounded p-3">{detail.body}</p>
            )}

            {hasDsr && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Detailed Seller Ratings</p>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  {detail.dsrItemAsDescribed && (
                    <div><dt className="text-gray-400">Item As Described</dt><dd className="font-medium">{detail.dsrItemAsDescribed}/5</dd></div>
                  )}
                  {detail.dsrShippingSpeed && (
                    <div><dt className="text-gray-400">Shipping Speed</dt><dd className="font-medium">{detail.dsrShippingSpeed}/5</dd></div>
                  )}
                  {detail.dsrCommunication && (
                    <div><dt className="text-gray-400">Communication</dt><dd className="font-medium">{detail.dsrCommunication}/5</dd></div>
                  )}
                  {detail.dsrPackaging && (
                    <div><dt className="text-gray-400">Packaging</dt><dd className="font-medium">{detail.dsrPackaging}/5</dd></div>
                  )}
                </dl>
              </div>
            )}

            {detail.photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {detail.photos.map((url, i) => (
                  <img key={i} src={url} alt="" className="h-16 w-16 rounded object-cover border border-gray-200" />
                ))}
              </div>
            )}

            {detail.flagReason && (
              <div className="text-xs text-red-700 bg-red-50 rounded p-2">
                <span className="font-medium">Flag reason:</span> {detail.flagReason}
              </div>
            )}

            <p className="text-xs text-gray-400">{detail.createdAt.toLocaleDateString()}</p>
          </div>
        </div>

        {/* Right column: context */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-primary">Context</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Buyer (reviewer)</dt>
                <dd>
                  <Link href={`/usr/${detail.reviewerUserId}`} className="text-blue-600 hover:underline">
                    {detail.reviewerName}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Seller</dt>
                <dd>
                  <Link href={`/usr/${detail.sellerId}`} className="text-blue-600 hover:underline">
                    {detail.sellerName}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Order</dt>
                <dd>
                  <Link href={`/tx/orders/${detail.orderId}`} className="text-blue-600 hover:underline font-mono text-xs">
                    {detail.orderId.slice(0, 12)}
                  </Link>
                </dd>
              </div>
            </dl>

            {detail.sellerResponse && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Seller Response</p>
                <p className="text-sm text-gray-800 bg-gray-50 rounded p-3">{detail.sellerResponse.body}</p>
                <p className="text-xs text-gray-400 mt-1">{detail.sellerResponse.createdAt.toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {ability.can('update', 'Review') && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-primary">Moderation Actions</h3>
              <ReviewModActions reviewId={detail.id} />
            </div>
          )}

          {/* Content reports */}
          {reports.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-2">
              <h3 className="text-sm font-semibold text-primary">Reports ({reports.length})</h3>
              <div className="space-y-1">
                {reports.map((r) => (
                  <div key={r.id} className="flex justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-600">{r.reason.replace(/_/g, ' ')}</span>
                    <span className="text-gray-400">{r.createdAt.toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
