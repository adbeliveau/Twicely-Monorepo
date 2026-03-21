import { cache } from 'react';
import { Star } from 'lucide-react';
import { getStorefrontBySlug } from '@/lib/queries/storefront';
import { getSellerReviews, getSellerDSRAverages } from '@/lib/queries/reviews';
import { ReviewCard } from '@/components/storefront/review-card';
import { DSRBars } from '@/components/storefront/dsr-bars';
import { PagePagination } from '@/components/shared/page-pagination';

const getCachedStorefront = cache(getStorefrontBySlug);

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function StorefrontReviewsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);

  const data = await getCachedStorefront(slug);
  if (!data) return null; // layout handles notFound

  const [reviews, dsrAverages] = await Promise.all([
    getSellerReviews(data.seller.userId, { page, pageSize: 10 }),
    getSellerDSRAverages(data.seller.userId),
  ]);

  const { averageRating, totalReviews } = data.stats;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Left: Summary + DSR Bars */}
      <div className="lg:col-span-1">
        <div className="sticky top-6 space-y-6">
          {/* Overall Rating */}
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Overall Rating</h3>
            {averageRating !== null ? (
              <div className="flex items-center gap-3">
                <div className="text-4xl font-bold text-gray-900">
                  {averageRating.toFixed(1)}
                </div>
                <div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const filled = i < Math.round(averageRating);
                      return (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${
                            filled ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No reviews yet</p>
            )}
          </div>

          {/* DSR Breakdown */}
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Detailed Seller Ratings</h3>
            <DSRBars
              avgItemAsDescribed={dsrAverages.avgItemAsDescribed}
              avgShippingSpeed={dsrAverages.avgShippingSpeed}
              avgCommunication={dsrAverages.avgCommunication}
              avgPackaging={dsrAverages.avgPackaging}
            />
          </div>
        </div>
      </div>

      {/* Right: Review List */}
      <div className="lg:col-span-2">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Reviews ({reviews.totalCount})
        </h2>

        {reviews.reviews.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-500">No reviews yet. Be the first to review after making a purchase!</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {reviews.reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>

            {reviews.totalPages > 1 && (
              <div className="mt-6">
                <PagePagination currentPage={reviews.page} totalPages={reviews.totalPages} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
