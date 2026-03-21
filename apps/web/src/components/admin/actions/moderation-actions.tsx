'use client';

import { useTransition, useState } from 'react';
import { removeListingAction, clearListingFlagAction } from '@/lib/actions/admin-moderation';
import { removeReviewAction, approveReviewAction } from '@/lib/actions/admin-moderation';

interface ListingActionsProps { listingId: string; }

export function ListingActions({ listingId }: ListingActionsProps) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  if (done) return <span className="text-xs text-gray-500">{done}</span>;

  return (
    <div className="flex gap-1">
      <button
        onClick={() => startTransition(async () => {
          const res = await removeListingAction({ listingId });
          setDone(res.error ?? 'Removed');
        })}
        disabled={pending}
        className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        Remove
      </button>
      <button
        onClick={() => startTransition(async () => {
          const res = await clearListingFlagAction({ listingId });
          setDone(res.error ?? 'Cleared');
        })}
        disabled={pending}
        className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  );
}

interface ReviewActionsProps { reviewId: string; }

export function ReviewActions({ reviewId }: ReviewActionsProps) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  if (done) return <span className="text-xs text-gray-500">{done}</span>;

  return (
    <div className="flex gap-1">
      <button
        onClick={() => startTransition(async () => {
          const res = await removeReviewAction({ reviewId });
          setDone(res.error ?? 'Removed');
        })}
        disabled={pending}
        className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        Remove
      </button>
      <button
        onClick={() => startTransition(async () => {
          const res = await approveReviewAction({ reviewId });
          setDone(res.error ?? 'Approved');
        })}
        disabled={pending}
        className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
      >
        Approve
      </button>
    </div>
  );
}
