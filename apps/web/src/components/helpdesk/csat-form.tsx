'use client';

import { useState, useTransition } from 'react';
import { submitCsat } from '@/lib/actions/helpdesk-csat';
import { Star } from 'lucide-react';

interface CsatFormProps {
  caseId: string;
}

export function CsatForm({ caseId }: CsatFormProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return (
      <p className="text-sm font-medium text-green-700">
        Thank you for your feedback!
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;

    setError(null);
    startTransition(async () => {
      const result = await submitCsat({
        caseId,
        rating,
        comment: comment.trim() || undefined,
      });
      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error ?? 'Failed to submit rating.');
      }
    });
  }

  const displayRating = hovered ?? rating;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Star rating */}
      <div className="flex items-center gap-1" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            disabled={isPending}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            className="focus:outline-none disabled:cursor-not-allowed"
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                displayRating !== null && star <= displayRating
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        {rating !== null && (
          <span className="ml-2 text-sm text-gray-600">
            {rating === 1
              ? 'Very poor'
              : rating === 2
              ? 'Poor'
              : rating === 3
              ? 'Okay'
              : rating === 4
              ? 'Good'
              : 'Excellent'}
          </span>
        )}
      </div>

      {/* Optional comment */}
      {rating !== null && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Any additional comments? (optional)"
          rows={2}
          maxLength={500}
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 resize-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          aria-label="Optional comment"
        />
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {rating !== null && (
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Submitting…' : 'Submit Rating'}
        </button>
      )}
    </form>
  );
}
