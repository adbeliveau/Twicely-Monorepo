'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveReviewAction, removeReviewAction, flagReviewAction } from '@/lib/actions/admin-moderation-helpers';

interface Props { reviewId: string; }

export function ReviewModActions({ reviewId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAction = (
    action: (input: unknown) => Promise<{ success?: boolean; error?: string }>,
    requireReason = false
  ) => {
    if (requireReason && !reason.trim()) {
      setMessage({ type: 'error', text: 'Reason is required for removal' });
      return;
    }
    startTransition(async () => {
      const result = await action({ reviewId, reason: reason.trim() || undefined });
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'Action applied successfully' });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reason (required for removal)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-gray-200 p-2.5 text-sm min-h-[72px] focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Optional note for approve/flag; required for remove..."
        />
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleAction(approveReviewAction)}
          disabled={pending}
          className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => handleAction(removeReviewAction, true)}
          disabled={pending}
          className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Remove
        </button>
        <button
          onClick={() => handleAction(flagReviewAction)}
          disabled={pending}
          className="rounded bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          Flag
        </button>
      </div>
    </div>
  );
}
