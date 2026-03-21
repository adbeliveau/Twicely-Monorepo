'use client';

// Client component: Approve/Suppress/Remove/Flag buttons for listing moderation

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearListingFlagAction,
  suppressListingAction,
  removeListingAction,
  flagListingAction,
} from '@/lib/actions/admin-moderation';

interface ListingModActionsProps {
  listingId: string;
  ownerUserId: string;
}

export function ListingModActions({ listingId, ownerUserId }: ListingModActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAction = (
    action: (input: unknown) => Promise<{ success?: boolean; error?: string }>
  ) => {
    if (!reason.trim()) {
      setMessage({ type: 'error', text: 'Reason is required' });
      return;
    }
    startTransition(async () => {
      const result = await action({ listingId, reason: reason.trim() });
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
          Reason (required for all actions)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-gray-200 p-2.5 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Describe the reason for this moderation action..."
        />
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleAction(clearListingFlagAction)}
          disabled={pending}
          className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Approve (Clear Flag)
        </button>
        <button
          onClick={() => handleAction(suppressListingAction)}
          disabled={pending}
          className="rounded bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
        >
          Suppress
        </button>
        <button
          onClick={() => handleAction(removeListingAction)}
          disabled={pending}
          className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Remove
        </button>
        <button
          onClick={() => handleAction(flagListingAction)}
          disabled={pending}
          className="rounded bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          Flag
        </button>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <a
          href={`/mod/enforcement/new?userId=${ownerUserId}&listingId=${listingId}`}
          className="text-xs text-blue-600 hover:underline"
        >
          Issue Enforcement Action →
        </a>
      </div>
    </div>
  );
}
