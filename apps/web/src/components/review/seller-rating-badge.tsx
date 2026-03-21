import { Star } from 'lucide-react';

interface SellerRatingBadgeProps {
  averageRating: number | null;
  totalReviews: number;
  showStars: boolean;
}

/**
 * Compact seller rating badge for listing cards and search results.
 *
 * Display rules:
 * - If showStars is false or no reviews: show nothing
 * - If < 3 reviews: show "New Seller" badge
 * - Otherwise: show star icon + rating + review count
 */
export function SellerRatingBadge({
  averageRating,
  totalReviews,
  showStars,
}: SellerRatingBadgeProps) {
  // Don't show if stars are disabled or no reviews
  if (!showStars || totalReviews === 0) {
    return null;
  }

  // Show "New Seller" for < 3 reviews
  if (totalReviews < 3) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-gray-600">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium">
          New Seller
        </span>
      </div>
    );
  }

  // Show rating badge
  const displayRating = averageRating?.toFixed(1) ?? '0.0';

  return (
    <div className="inline-flex items-center gap-1 text-sm">
      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      <span className="font-medium text-gray-900">{displayRating}</span>
      <span className="text-gray-500">({totalReviews})</span>
    </div>
  );
}
