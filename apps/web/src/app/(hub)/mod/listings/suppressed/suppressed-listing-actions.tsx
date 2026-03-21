'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reinstateListingAction, removeListingAction } from '@/lib/actions/admin-moderation';

interface Props { listingId: string; }

export function SuppressedListingActions({ listingId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const handleAction = (
    action: (input: unknown) => Promise<{ success?: boolean; error?: string }>
  ) => {
    if (!reason.trim()) { setMsg('Reason required'); return; }
    setMsg(null);
    startTransition(async () => {
      const res = await action({ listingId, reason: reason.trim() });
      if (res.error) { setMsg(res.error); } else { router.refresh(); }
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        className="border rounded px-2 py-1 text-xs w-28 focus:outline-none"
      />
      {msg && <span className="text-xs text-red-600">{msg}</span>}
      <button
        onClick={() => handleAction(reinstateListingAction)}
        disabled={pending}
        className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        Reinstate
      </button>
      <button
        onClick={() => handleAction(removeListingAction)}
        disabled={pending}
        className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}
