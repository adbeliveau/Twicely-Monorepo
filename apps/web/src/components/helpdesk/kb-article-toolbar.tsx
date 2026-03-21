'use client';

import { useTransition } from 'react';
import {
  publishKbArticle,
  archiveKbArticle,
  submitForReview,
} from '@/lib/actions/kb-articles';

interface KbArticleToolbarProps {
  articleId: string;
  status: string;
  categorySlug?: string;
  articleSlug?: string;
  isPendingSave: boolean;
  onError: (msg: string) => void;
  onSuccess: () => void;
}

export function KbArticleToolbar({
  articleId,
  status,
  categorySlug,
  articleSlug,
  isPendingSave,
  onError,
  onSuccess,
}: KbArticleToolbarProps) {
  const [isPending, startTransition] = useTransition();
  const isDisabled = isPendingSave || isPending;

  function handleSubmitForReview() {
    startTransition(async () => {
      const result = await submitForReview(articleId);
      if (result.success) {
        onSuccess();
      } else {
        onError(result.error ?? 'Failed to submit for review.');
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      const result = await publishKbArticle(articleId);
      if (result.success) {
        onSuccess();
      } else {
        onError(result.error ?? 'Failed to publish article.');
      }
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveKbArticle(articleId);
      if (result.success) {
        onSuccess();
      } else {
        onError(result.error ?? 'Failed to archive article.');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
      {/* Submit for review — visible when DRAFT */}
      {status === 'DRAFT' && (
        <button
          type="button"
          onClick={handleSubmitForReview}
          disabled={isDisabled}
          className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-100 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Submit for Review'}
        </button>
      )}

      {/* Publish — visible when DRAFT or REVIEW */}
      {(status === 'DRAFT' || status === 'REVIEW') && (
        <button
          type="button"
          onClick={handlePublish}
          disabled={isDisabled}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Publish'}
        </button>
      )}

      {/* Archive — visible when PUBLISHED */}
      {status === 'PUBLISHED' && (
        <button
          type="button"
          onClick={handleArchive}
          disabled={isDisabled}
          className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Archive'}
        </button>
      )}

      {/* Preview — open public view for published articles */}
      {status === 'PUBLISHED' && categorySlug && articleSlug && (
        <a
          href={`/h/${categorySlug}/${articleSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Preview
        </a>
      )}
    </div>
  );
}
