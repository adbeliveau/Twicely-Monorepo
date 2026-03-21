import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getModeratedReviews } from '@/lib/queries/admin-moderation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ReviewsBulkActions } from './reviews-bulk-actions';

export const metadata: Metadata = { title: 'Moderated Reviews | Twicely Hub' };

type StatusFilter = 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REMOVED';

export default async function ModeratedReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    rating?: string;
    status?: string;
    q?: string;
    reported?: string;
  }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('update', 'Review')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const ratingParam = params.rating ? parseInt(params.rating, 10) : null;
  const rating = ratingParam !== null && ratingParam >= 1 && ratingParam <= 5 ? ratingParam : null;
  const reportedOnly = params.reported !== 'false'; // default ON
  const keyword = params.q?.trim() ?? null;
  const statusFilter = reportedOnly ? ('FLAGGED' as StatusFilter) : null;

  const { reviews, total } = await getModeratedReviews(rating, statusFilter, keyword, page, 50);

  const baseHref = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { reported: String(reportedOnly), rating: rating ? String(rating) : undefined, q: keyword ?? undefined, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined) sp.set(k, v);
    }
    return `/mod/reviews?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Moderated Reviews" description={`${total} review${total === 1 ? '' : 's'}`} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Reported-only toggle */}
        <div className="flex items-center gap-2">
          <Link
            href={baseHref({ reported: String(!reportedOnly) })}
            className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full transition-colors ${reportedOnly ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${reportedOnly ? 'translate-x-4' : 'translate-x-0'}`} />
          </Link>
          <span className="text-sm text-gray-600">Flagged only</span>
        </div>

        {/* Rating filter */}
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-500 mr-1">Rating:</span>
          <Link href={baseHref({ rating: undefined })} className={`px-2 py-1 rounded text-xs ${!rating ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All
          </Link>
          {[1, 2, 3, 4, 5].map((r) => (
            <Link key={r} href={baseHref({ rating: String(r) })} className={`px-2 py-1 rounded text-xs ${rating === r ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {r}★
            </Link>
          ))}
        </div>

        {/* Keyword search */}
        <form method="GET" action="/mod/reviews" className="flex gap-2">
          <input type="hidden" name="reported" value={String(reportedOnly)} />
          {rating && <input type="hidden" name="rating" value={rating} />}
          <input
            type="text"
            name="q"
            defaultValue={keyword ?? ''}
            placeholder="Search review text..."
            className="rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
          />
          <button type="submit" className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90">
            Search
          </button>
          {keyword && (
            <Link href={baseHref({ q: undefined })} className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Bulk actions */}
      <ReviewsBulkActions />

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3 font-medium text-primary/70">Rating</th>
              <th className="px-4 py-3 font-medium text-primary/70">Review</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Date</th>
              <th className="px-4 py-3 font-medium text-primary/70">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {reviews.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input type="checkbox" data-review-id={r.id} className="review-checkbox rounded border-gray-300" />
                </td>
                <td className="px-4 py-3">
                  <span className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-[260px] truncate">{r.comment ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{r.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Link href={`/mod/reviews/${r.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No reviews found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
