import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getBuyerReviews } from '@/lib/queries/buyer-reviews';
import { BuyerReviewCard } from '@/components/pages/review/buyer-review-card';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function MyReviewsPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  const params = await searchParams;
  const page = parseInt(params.page ?? '1', 10);

  const { reviews, pagination } = await getBuyerReviews(session.user.id, { page, pageSize: 20 });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Reviews</h1>
          <div className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
            {pagination.totalCount} {pagination.totalCount === 1 ? 'review' : 'reviews'}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <p className="text-gray-600 mb-2">You haven&apos;t written any reviews yet</p>
          <p className="text-sm text-gray-500">
            Reviews appear here after you complete a purchase and leave feedback.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <BuyerReviewCard key={review.id} review={review} />
          ))}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              {page > 1 && (
                <a
                  href={`?page=${page - 1}`}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Previous
                </a>
              )}

              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              {page < pagination.totalPages && (
                <a
                  href={`?page=${page + 1}`}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Next
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
