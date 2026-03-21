import { Star, TrendingUp, Award } from 'lucide-react';
import type { SellerDSRAverages } from '@/lib/queries/reviews';

interface SellerRatingSummaryProps {
  averageRating: number | null;
  displayStars: number | null;
  totalReviews: number;
  currentBand: string;
  trustBadge: string | null;
  trustBadgeSecondary: string | null;
  showStars: boolean;
  dsrAverages?: SellerDSRAverages | null;
}

/**
 * Full seller rating summary for listing detail and store pages.
 *
 * Shows:
 * - Overall star rating (large display)
 * - Total review count
 * - DSR breakdown (4 bars)
 * - Performance badge if POWER_SELLER or TOP_RATED
 */
export function SellerRatingSummary({
  averageRating,
  displayStars,
  totalReviews,
  currentBand,
  trustBadge,
  trustBadgeSecondary,
  showStars,
  dsrAverages,
}: SellerRatingSummaryProps) {
  // Don't show if no reviews or stars disabled
  if (totalReviews === 0 || !showStars) {
    return (
      <div className="rounded-lg border bg-gray-50 p-4">
        <p className="text-sm text-gray-600">No reviews yet</p>
      </div>
    );
  }

  // Show "New Seller" for < 3 reviews (no detailed breakdown)
  if (totalReviews < 3) {
    return (
      <div className="rounded-lg border bg-primary/10 p-4">
        <div className="flex items-center gap-2 text-primary">
          <TrendingUp className="h-5 w-5" />
          <span className="font-semibold">New Seller</span>
        </div>
        <p className="mt-1 text-sm text-primary/80">
          {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'} so far
        </p>
      </div>
    );
  }

  const rating = displayStars ?? averageRating ?? 0;
  const ratingDisplay = rating.toFixed(1);

  return (
    <div className="rounded-lg border bg-white p-6 space-y-4">
      {/* Overall Rating */}
      <div className="flex items-center gap-4">
        <div className="text-4xl font-bold text-gray-900">{ratingDisplay}</div>
        <div className="flex-1">
          <div className="flex gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${
                  star <= Math.round(rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-none text-gray-300'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600">
            Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
          </p>
        </div>
      </div>

      {/* Performance Badge */}
      {(currentBand === 'POWER_SELLER' || currentBand === 'TOP_RATED') && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2">
          <Award className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-900">
            {currentBand === 'POWER_SELLER' ? 'Power Seller' : 'Top Rated Seller'}
          </span>
        </div>
      )}

      {/* Trust Badges */}
      {trustBadge && (
        <div className="text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-primary font-medium">
            {trustBadge}
          </span>
          {trustBadgeSecondary && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-700 text-xs">
              {trustBadgeSecondary}
            </span>
          )}
        </div>
      )}

      {/* DSR Breakdown */}
      {dsrAverages && (
        <div className="space-y-3 pt-2 border-t">
          <p className="text-sm font-medium text-gray-700">Detailed Ratings</p>
          <DSRBar label="Item as Described" average={dsrAverages.avgItemAsDescribed} />
          <DSRBar label="Shipping Speed" average={dsrAverages.avgShippingSpeed} />
          <DSRBar label="Communication" average={dsrAverages.avgCommunication} />
          <DSRBar label="Packaging" average={dsrAverages.avgPackaging} />
        </div>
      )}
    </div>
  );
}

function DSRBar({ label, average }: { label: string; average: number | null }) {
  if (average === null) {
    return null;
  }

  const percentage = (average / 5) * 100;

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{average.toFixed(1)}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
