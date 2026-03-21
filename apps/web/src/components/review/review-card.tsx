import { Star, BadgeCheck } from 'lucide-react';
import { formatDate } from '@twicely/utils/format';
import type { ReviewData } from '@/lib/queries/reviews';

interface ReviewCardProps {
  review: ReviewData;
}

/**
 * Single review display card.
 *
 * Shows:
 * - Reviewer name (first name + last initial)
 * - Star rating (read-only)
 * - Verified purchase badge
 * - Review title + body
 * - DSR mini-display (if provided)
 * - Photo thumbnails (if any)
 * - Date
 * - Seller response (if exists) - indented below
 */
export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="rounded-lg border bg-white p-6 space-y-4">
      {/* Header: Reviewer + Rating + Date */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
            {review.reviewerDisplayName[0]?.toUpperCase() ?? 'A'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">
                {review.reviewerDisplayName}
              </span>
              {review.isVerifiedPurchase && (
                <BadgeCheck className="h-4 w-4 text-green-600" aria-label="Verified Purchase" />
              )}
            </div>
            <p className="text-xs text-gray-500">{formatDate(review.createdAt)}</p>
          </div>
        </div>

        {/* Star Rating */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-4 w-4 ${
                star <= review.rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-none text-gray-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Review Title */}
      {review.title && (
        <h3 className="font-semibold text-gray-900">{review.title}</h3>
      )}

      {/* Review Body */}
      {review.body && (
        <p className="text-gray-700 whitespace-pre-wrap">{review.body}</p>
      )}

      {/* DSR Mini-Display */}
      {(review.dsrItemAsDescribed || review.dsrShippingSpeed || review.dsrCommunication || review.dsrPackaging) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {review.dsrItemAsDescribed && (
            <DSRMini label="Item" rating={review.dsrItemAsDescribed} />
          )}
          {review.dsrShippingSpeed && (
            <DSRMini label="Shipping" rating={review.dsrShippingSpeed} />
          )}
          {review.dsrCommunication && (
            <DSRMini label="Communication" rating={review.dsrCommunication} />
          )}
          {review.dsrPackaging && (
            <DSRMini label="Packaging" rating={review.dsrPackaging} />
          )}
        </div>
      )}

      {/* Photo Thumbnails */}
      {review.photos.length > 0 && (
        <div className="flex gap-2">
          {review.photos.slice(0, 4).map((photoUrl, idx) => (
            <div
              key={idx}
              className="h-20 w-20 rounded-md bg-gray-100 border overflow-hidden"
            >
              <img
                src={photoUrl}
                alt={`Review photo ${idx + 1}`}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Seller Response */}
      {review.response && (
        <div className="ml-4 pl-4 border-l-2 border-gray-200 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Seller Response</span>
            <span className="text-xs text-gray-500">
              {formatDate(review.response.createdAt)}
            </span>
          </div>
          <p className="text-sm text-gray-700">{review.response.body}</p>
        </div>
      )}

      {/* Helpful Placeholder (Phase E) */}
      <div className="pt-2 border-t">
        <p className="text-xs text-gray-400">Was this helpful? (Coming soon)</p>
      </div>
    </div>
  );
}

function DSRMini({ label, rating }: { label: string; rating: number }) {
  return (
    <div className="flex items-center gap-1 text-gray-600">
      <span>{label}:</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
