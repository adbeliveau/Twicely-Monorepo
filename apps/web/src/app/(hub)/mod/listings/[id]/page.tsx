// NAV_ENTRY: Listing Moderation Detail | /mod/listings/[id] | requires MODERATION or ADMIN
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getListingForModeration } from '@/lib/queries/admin-moderation';
import { getReportsForTarget } from '@/lib/queries/content-reports';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ListingModActions } from './listing-mod-actions';

export const metadata: Metadata = { title: 'Listing Detail | Twicely Hub' };

function formatCents(cents: number | null): string {
  if (!cents) return '—';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function StateBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>
  );
}

const stateColors: Record<string, string> = {
  CLEAR: 'bg-green-100 text-green-700',
  FLAGGED: 'bg-yellow-100 text-yellow-800',
  SUPPRESSED: 'bg-orange-100 text-orange-700',
  REMOVED: 'bg-red-100 text-red-700',
};

export default async function ListingModerationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Listing')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const [detail, reports] = await Promise.all([
    getListingForModeration(id),
    getReportsForTarget('LISTING', id),
  ]);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={detail.title ?? 'Untitled listing'}
        description={`Listing ID: ${detail.id.slice(0, 12)}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column: listing info */}
        <div className="space-y-4">
          {detail.images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {detail.images.slice(0, 4).map((img) => (
                <img
                  key={img.position}
                  src={img.url}
                  alt=""
                  className="h-20 w-20 rounded object-cover border border-gray-200"
                />
              ))}
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-primary">Listing Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd><StateBadge label={detail.status} color="bg-gray-100 text-gray-700" /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Enforcement state</dt>
                <dd>
                  <StateBadge
                    label={detail.enforcementState}
                    color={stateColors[detail.enforcementState] ?? 'bg-gray-100 text-gray-700'}
                  />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Price</dt>
                <dd className="font-medium">{formatCents(detail.priceCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Condition</dt>
                <dd className="text-gray-700">{detail.condition ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Category</dt>
                <dd className="text-gray-700">{detail.categoryName ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-700">{detail.createdAt.toLocaleDateString()}</dd>
              </div>
              {detail.activatedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Activated</dt>
                  <dd className="text-gray-700">{detail.activatedAt.toLocaleDateString()}</dd>
                </div>
              )}
            </dl>
            {detail.description && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-800 bg-gray-50 rounded p-3 line-clamp-4">
                  {detail.description}
                </p>
              </div>
            )}
            {detail.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {detail.tags.map((tag) => (
                  <span key={tag} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: seller context + actions */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-primary">Seller Context</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Seller</dt>
                <dd>
                  <Link href={`/usr/${detail.ownerUserId}`} className="text-blue-600 hover:underline">
                    {detail.sellerName}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Performance band</dt>
                <dd className="text-gray-700">{detail.performanceBand}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Average rating</dt>
                <dd className="text-gray-700">
                  {detail.averageRating ? `${detail.averageRating.toFixed(1)} / 5` : '—'}
                  {` (${detail.totalReviews} reviews)`}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Active enforcement actions</dt>
                <dd className="font-medium text-gray-900">{detail.activeEnforcementCount}</dd>
              </div>
            </dl>
          </div>

          {ability.can('update', 'Listing') && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-primary">Moderation Actions</h3>
              <ListingModActions listingId={detail.id} ownerUserId={detail.ownerUserId} />
            </div>
          )}
        </div>
      </div>

      {/* Report history */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h3 className="text-sm font-semibold text-primary">
          Report History ({reports.length})
        </h3>
        {reports.length === 0 ? (
          <p className="text-sm text-gray-400">No reports for this listing</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr>
                  <th className="pb-2 font-medium text-gray-500">Reporter</th>
                  <th className="pb-2 font-medium text-gray-500">Reason</th>
                  <th className="pb-2 font-medium text-gray-500">Date</th>
                  <th className="pb-2 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-mono text-xs text-gray-500">{r.reporterUserId.slice(0, 10)}</td>
                    <td className="py-2 text-gray-700">{r.reason.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-gray-500">{r.createdAt.toLocaleDateString()}</td>
                    <td className="py-2 text-gray-600">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
