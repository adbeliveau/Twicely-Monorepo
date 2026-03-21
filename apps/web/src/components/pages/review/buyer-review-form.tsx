'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitBuyerReview, updateBuyerReview } from '@/lib/actions/buyer-review';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { StarRating } from './star-rating';

interface BuyerReviewFormProps {
  orderId: string;
  mode: 'create' | 'edit';
  existingReview?: {
    id: string;
    ratingPayment: number;
    ratingCommunication: number;
    ratingReturnBehavior: number | null;
    note: string | null;
  };
}

export function BuyerReviewForm({ orderId, mode, existingReview }: BuyerReviewFormProps) {
  const router = useRouter();

  const [ratingPayment, setRatingPayment] = useState(existingReview?.ratingPayment ?? 0);
  const [ratingCommunication, setRatingCommunication] = useState(existingReview?.ratingCommunication ?? 0);
  const [ratingReturnBehavior, setRatingReturnBehavior] = useState(existingReview?.ratingReturnBehavior ?? 0);
  const [includeReturn, setIncludeReturn] = useState(
    existingReview?.ratingReturnBehavior !== null && existingReview?.ratingReturnBehavior !== undefined
  );
  const [note, setNote] = useState(existingReview?.note ?? '');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = ratingPayment > 0 && ratingCommunication > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const data = {
        ratingPayment,
        ratingCommunication,
        ratingReturnBehavior: includeReturn && ratingReturnBehavior > 0 ? ratingReturnBehavior : null,
        note: note.trim() || null,
      };

      const result = mode === 'create'
        ? await submitBuyerReview({ orderId, ...data })
        : await updateBuyerReview({ reviewId: existingReview!.id, ...data });

      if (!result.success) {
        setError(result.error ?? 'Failed to save review');
        setIsSubmitting(false);
        return;
      }

      // Success - redirect to order detail
      router.push(`/my/selling/orders/${orderId}`);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Payment Rating (required) */}
      <StarRating
        rating={ratingPayment}
        onRatingChange={setRatingPayment}
        label="Payment Promptness"
        required
      />

      {/* Communication Rating (required) */}
      <StarRating
        rating={ratingCommunication}
        onRatingChange={setRatingCommunication}
        label="Communication"
        required
      />

      {/* Return Behavior Toggle */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeReturn}
            onChange={(e) => setIncludeReturn(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
          />
          <span className="text-sm text-gray-700">This order involved a return</span>
        </label>

        {includeReturn && (
          <StarRating
            rating={ratingReturnBehavior}
            onRatingChange={setRatingReturnBehavior}
            label="Return Behavior"
          />
        )}
      </div>

      {/* Private Note */}
      <div>
        <Label htmlFor="note">Private Note (Optional)</Label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a private note about this buyer..."
          maxLength={1000}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          {note.length}/1000 characters
        </p>
        <p className="text-xs text-gray-500">This note is private and will not be shown to the buyer.</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Submit button */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isSubmitting || !isValid}
          className="flex-1"
        >
          {isSubmitting
            ? (mode === 'create' ? 'Submitting...' : 'Updating...')
            : (mode === 'create' ? 'Submit Review' : 'Update Review')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
