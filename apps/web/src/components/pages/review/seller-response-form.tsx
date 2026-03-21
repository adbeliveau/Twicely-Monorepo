'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { submitSellerResponse, updateSellerResponse } from '@/lib/actions/seller-response';

interface SellerResponseFormProps {
  reviewId: string;
  existingResponse?: {
    id: string;
    body: string;
    createdAt: Date;
  };
  onSuccess?: () => void;
}

const MAX_LENGTH = 2000;
const EDIT_WINDOW_HOURS = 24;

/**
 * Form for seller to respond to a review.
 *
 * Two modes:
 * - Create: No existing response (submit new)
 * - Edit: Existing response within 24-hour window (update)
 */
export function SellerResponseForm({
  reviewId,
  existingResponse,
  onSuccess,
}: SellerResponseFormProps) {
  const [body, setBody] = useState(existingResponse?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isEditing = !!existingResponse;
  const remainingChars = MAX_LENGTH - body.length;

  // Calculate hours remaining for edit window
  let hoursRemaining = 0;
  if (isEditing && existingResponse) {
    const deadline = new Date(existingResponse.createdAt);
    deadline.setHours(deadline.getHours() + EDIT_WINDOW_HOURS);
    const now = new Date();
    hoursRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!body.trim()) {
      setError('Response cannot be empty');
      return;
    }

    if (body.length > MAX_LENGTH) {
      setError(`Response cannot exceed ${MAX_LENGTH} characters`);
      return;
    }

    startTransition(async () => {
      const result = isEditing && existingResponse
        ? await updateSellerResponse(existingResponse.id, body)
        : await submitSellerResponse(reviewId, body);

      if (result.success) {
        onSuccess?.();
      } else {
        setError(result.error ?? 'Failed to save response');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="response-body" className="block text-sm font-medium text-gray-700 mb-2">
          {isEditing ? 'Edit Your Response' : 'Respond to This Review'}
        </label>
        {isEditing && hoursRemaining > 0 && (
          <p className="text-xs text-amber-600 mb-2">
            You have {hoursRemaining} {hoursRemaining === 1 ? 'hour' : 'hours'} left to edit this response
          </p>
        )}
        <textarea
          id="response-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isPending}
          rows={4}
          maxLength={MAX_LENGTH}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          placeholder="Write your response to the buyer..."
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className={remainingChars < 100 ? 'text-amber-600' : 'text-gray-500'}>
            {remainingChars} characters remaining
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || body.length === 0}>
          {isPending ? 'Saving...' : isEditing ? 'Update Response' : 'Post Response'}
        </Button>
        {isEditing && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setBody(existingResponse?.body ?? '')}
            disabled={isPending}
          >
            Reset
          </Button>
        )}
      </div>

      {!isEditing && (
        <p className="text-xs text-gray-500">
          Once posted, you can edit your response for 24 hours. After that, it becomes permanent.
        </p>
      )}
    </form>
  );
}
