'use client';

import { useState, useTransition } from 'react';
import { submitArticleFeedback } from '@/lib/actions/kb-feedback';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface ArticleFeedbackFormProps {
  articleId: string;
}

export function ArticleFeedbackForm({ articleId }: ArticleFeedbackFormProps) {
  const [chosen, setChosen] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return (
      <p className="text-sm text-green-600">Thank you for your feedback!</p>
    );
  }

  function handleVote(helpful: boolean) {
    setChosen(helpful);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (chosen === null) return;

    startTransition(async () => {
      const result = await submitArticleFeedback({
        articleId,
        helpful: chosen,
        comment: comment.trim() || undefined,
      });
      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error ?? 'Failed to submit feedback.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => handleVote(true)}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            chosen === true
              ? 'border-green-600 bg-green-50 text-green-700'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
          aria-pressed={chosen === true}
        >
          <ThumbsUp className="h-4 w-4" />
          Yes
        </button>
        <button
          type="button"
          onClick={() => handleVote(false)}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            chosen === false
              ? 'border-red-500 bg-red-50 text-red-600'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
          aria-pressed={chosen === false}
        >
          <ThumbsDown className="h-4 w-4" />
          No
        </button>
      </div>

      {chosen !== null && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={chosen ? 'What did you find helpful? (optional)' : 'What could be improved? (optional)'}
            rows={2}
            maxLength={500}
            disabled={isPending}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {isPending ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </>
      )}
    </form>
  );
}
