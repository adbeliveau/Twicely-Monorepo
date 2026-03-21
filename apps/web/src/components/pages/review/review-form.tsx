'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitReview, updateReview } from '@/lib/actions/reviews';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { Input } from '@twicely/ui/input';
import { StarRating } from './star-rating';

interface ReviewFormProps {
  orderId: string;
  mode: 'create' | 'edit';
  existingReview?: {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    photos: string[];
    dsrItemAsDescribed: number | null;
    dsrShippingSpeed: number | null;
    dsrCommunication: number | null;
    dsrPackaging: number | null;
  };
}

export function ReviewForm({ orderId, mode, existingReview }: ReviewFormProps) {
  const router = useRouter();

  // Overall rating (required)
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [title, setTitle] = useState(existingReview?.title ?? '');
  const [body, setBody] = useState(existingReview?.body ?? '');

  // DSR ratings (optional)
  const [dsrItemAsDescribed, setDsrItemAsDescribed] = useState(existingReview?.dsrItemAsDescribed ?? 0);
  const [dsrShippingSpeed, setDsrShippingSpeed] = useState(existingReview?.dsrShippingSpeed ?? 0);
  const [dsrCommunication, setDsrCommunication] = useState(existingReview?.dsrCommunication ?? 0);
  const [dsrPackaging, setDsrPackaging] = useState(existingReview?.dsrPackaging ?? 0);

  // Photos (placeholder for now, R2 in Phase E)
  const [photos] = useState<string[]>(existingReview?.photos ?? []);

  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    setIsSubmitting(true);

    try {
      const data = {
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        photos,
        dsrItemAsDescribed: dsrItemAsDescribed > 0 ? dsrItemAsDescribed : null,
        dsrShippingSpeed: dsrShippingSpeed > 0 ? dsrShippingSpeed : null,
        dsrCommunication: dsrCommunication > 0 ? dsrCommunication : null,
        dsrPackaging: dsrPackaging > 0 ? dsrPackaging : null,
      };

      const result = mode === 'create'
        ? await submitReview(orderId, data)
        : await updateReview(existingReview!.id, data);

      if (!result.success) {
        if (result.errors) {
          setErrors(result.errors);
        } else {
          setError(result.error ?? 'Failed to save review');
        }
        setIsSubmitting(false);
        return;
      }

      // Success - redirect to order detail
      router.push(`/my/buying/orders/${orderId}`);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Overall Rating (required) */}
      <div>
        <StarRating
          rating={rating}
          onRatingChange={setRating}
          label="Overall Rating"
          required
          error={errors.rating}
        />
      </div>

      {/* Review Title */}
      <div>
        <Label htmlFor="title">Review Title (Optional)</Label>
        <Input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience in a few words"
          maxLength={200}
          className="mt-1"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
      </div>

      {/* Review Body */}
      <div>
        <Label htmlFor="body">Your Review (Optional)</Label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share details about your experience with this item..."
          maxLength={5000}
          rows={6}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          {body.length}/5000 characters
        </p>
        {errors.body && <p className="mt-1 text-sm text-red-600">{errors.body}</p>}
      </div>

      {/* Detailed Seller Ratings (DSR) - Optional */}
      <div className="rounded-lg border bg-gray-50 p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Detailed Seller Ratings (Optional)
          </h3>
          <p className="text-sm text-gray-600">
            Help other buyers by rating specific aspects of your experience.
          </p>
        </div>

        <StarRating
          rating={dsrItemAsDescribed}
          onRatingChange={setDsrItemAsDescribed}
          label="Item as Described"
          error={errors.dsrItemAsDescribed}
        />

        <StarRating
          rating={dsrShippingSpeed}
          onRatingChange={setDsrShippingSpeed}
          label="Shipping Speed"
          error={errors.dsrShippingSpeed}
        />

        <StarRating
          rating={dsrCommunication}
          onRatingChange={setDsrCommunication}
          label="Communication"
          error={errors.dsrCommunication}
        />

        <StarRating
          rating={dsrPackaging}
          onRatingChange={setDsrPackaging}
          label="Packaging Quality"
          error={errors.dsrPackaging}
        />
      </div>

      {/* Photos placeholder (R2 in Phase E) */}
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">
          Photo uploads coming in Phase E (R2 storage)
        </p>
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
          disabled={isSubmitting || rating === 0}
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
