import Image from 'next/image';
import { Star, CheckCircle } from 'lucide-react';
import type { ReviewData } from '@/lib/queries/reviews';

interface ReviewCardProps {
  review: ReviewData;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="border-b border-gray-100 py-5 last:border-b-0">
      {/* Header: Avatar, Name, Rating, Date */}
      <div className="flex items-start gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
          {review.reviewerAvatarUrl ? (
            <Image
              src={review.reviewerAvatarUrl}
              alt={review.reviewerDisplayName}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-gray-500">
              {review.reviewerDisplayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{review.reviewerDisplayName}</span>
            {review.isVerifiedPurchase && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                <CheckCircle className="h-3 w-3" />
                Verified Purchase
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StarRating rating={review.rating} />
            <span className="text-xs text-gray-500">{formatDate(review.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Title + Body */}
      {review.title && (
        <h4 className="mt-3 font-medium text-gray-900">{review.title}</h4>
      )}
      {review.body && (
        <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{review.body}</p>
      )}

      {/* Photos */}
      {review.photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.photos.map((photo, idx) => (
            <div key={idx} className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
              <Image src={photo} alt={`Review photo ${idx + 1}`} fill className="object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Seller Response */}
      {review.response && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3">
          <div className="text-xs font-medium text-gray-600 mb-1">
            Seller Response · {formatDate(review.response.createdAt)}
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.response.body}</p>
        </div>
      )}
    </div>
  );
}
