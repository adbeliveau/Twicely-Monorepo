'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { bulkApproveReviewsAction, bulkRemoveReviewsAction } from '@/lib/actions/admin-moderation';

export function ReviewsBulkActions() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const getSelectedIds = (): string[] => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>('.review-checkbox:checked');
    return Array.from(checkboxes).map((el) => el.dataset.reviewId ?? '').filter(Boolean);
  };

  const handleBulkApprove = () => {
    const ids = getSelectedIds();
    if (ids.length === 0) { setMsg('Select at least one review'); return; }
    startTransition(async () => {
      const result = await bulkApproveReviewsAction({ reviewIds: ids });
      if (result.error) { setMsg(result.error); } else { setMsg(null); router.refresh(); }
    });
  };

  const handleBulkRemove = () => {
    const ids = getSelectedIds();
    if (ids.length === 0) { setMsg('Select at least one review'); return; }
    if (!confirm(`Remove ${ids.length} review${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await bulkRemoveReviewsAction({ reviewIds: ids });
      if (result.error) { setMsg(result.error); } else { setMsg(null); router.refresh(); }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500">Bulk:</span>
      <button
        onClick={handleBulkApprove}
        disabled={pending}
        className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        Approve Selected
      </button>
      <button
        onClick={handleBulkRemove}
        disabled={pending}
        className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        Remove Selected
      </button>
      {msg && <span className="text-xs text-red-600">{msg}</span>}
    </div>
  );
}
