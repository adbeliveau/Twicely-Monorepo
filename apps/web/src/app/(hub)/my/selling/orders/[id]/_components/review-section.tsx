import { Star } from 'lucide-react';
import { formatDate } from '@twicely/utils/format';
import { SellerResponseForm } from '@/components/pages/review/seller-response-form';

interface ReviewData {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: Date;
}

interface ResponseData {
  id: string;
  body: string;
  createdAt: Date;
}

interface ReviewSectionProps {
  orderReview: ReviewData;
  existingResponse: ResponseData | null;
  canRespondToReview: boolean;
  canEditResponse: boolean;
  responseWindowDays: number;
}

export function ReviewSection({
  orderReview,
  existingResponse,
  canRespondToReview,
  canEditResponse,
  responseWindowDays,
}: ReviewSectionProps) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="font-semibold mb-4">Buyer Review</h2>

      {/* Review Display */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  star <= orderReview.rating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-none text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500">
            {formatDate(orderReview.createdAt)}
          </span>
        </div>

        {orderReview.title && (
          <p className="font-semibold text-gray-900">{orderReview.title}</p>
        )}

        {orderReview.body && (
          <p className="text-gray-700 whitespace-pre-wrap">{orderReview.body}</p>
        )}
      </div>

      {/* Existing Response (Read-only if past edit window) */}
      {existingResponse && !canEditResponse && (
        <div className="ml-4 pl-4 border-l-2 border-gray-200 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Your Response</span>
            <span className="text-xs text-gray-500">
              {formatDate(existingResponse.createdAt)}
            </span>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{existingResponse.body}</p>
          <p className="text-xs text-gray-500 italic">
            Response is now permanent (24-hour edit window has passed)
          </p>
        </div>
      )}

      {/* Response Form (Create or Edit) */}
      {canRespondToReview && (
        <div className="pt-4 border-t">
          <SellerResponseForm reviewId={orderReview.id} />
        </div>
      )}

      {canEditResponse && existingResponse && (
        <div className="pt-4 border-t">
          <SellerResponseForm
            reviewId={orderReview.id}
            existingResponse={existingResponse}
          />
        </div>
      )}

      {/* Response window closed message */}
      {!canRespondToReview && !existingResponse && (
        <div className="pt-4 border-t">
          <p className="text-sm text-gray-500 italic">
            Response window closed ({responseWindowDays} days after review)
          </p>
        </div>
      )}
    </div>
  );
}
