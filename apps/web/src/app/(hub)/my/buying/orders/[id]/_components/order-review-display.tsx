import { Star } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@twicely/utils/format';

interface ReviewData {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  photos: string[];
  dsrItemAsDescribed: number | null;
  dsrShippingSpeed: number | null;
  dsrCommunication: number | null;
  dsrPackaging: number | null;
  createdAt: Date;
  canEdit: boolean;
}

interface OrderReviewDisplayProps {
  orderId: string;
  review: ReviewData;
}

export function OrderReviewDisplay({ orderId, review }: OrderReviewDisplayProps) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-start justify-between mb-4">
        <h2 className="font-semibold">Your Review</h2>
        {review.canEdit && (
          <Link
            href={`/my/buying/orders/${orderId}/review`}
            className="text-sm text-primary hover:text-primary/80"
          >
            Edit review
          </Link>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
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
          <span className="text-sm text-gray-500">{formatDate(review.createdAt)}</span>
        </div>

        {review.title && (
          <p className="font-medium text-gray-900">{review.title}</p>
        )}

        {review.body && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.body}</p>
        )}

        {(review.dsrItemAsDescribed !== null ||
          review.dsrShippingSpeed !== null ||
          review.dsrCommunication !== null ||
          review.dsrPackaging !== null) && (
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 pt-2 border-t">
            {review.dsrItemAsDescribed !== null && (
              <span>Item as described: {review.dsrItemAsDescribed}/5</span>
            )}
            {review.dsrShippingSpeed !== null && (
              <span>Shipping speed: {review.dsrShippingSpeed}/5</span>
            )}
            {review.dsrCommunication !== null && (
              <span>Communication: {review.dsrCommunication}/5</span>
            )}
            {review.dsrPackaging !== null && (
              <span>Packaging: {review.dsrPackaging}/5</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
