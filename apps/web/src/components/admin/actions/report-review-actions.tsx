'use client';

import { useTransition, useState } from 'react';
import { reviewContentReportAction } from '@/lib/actions/enforcement';

interface ReportReviewActionsProps {
  reportId: string;
  currentStatus: string;
}

export function ReportReviewActions({ reportId, currentStatus }: ReportReviewActionsProps) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  if (currentStatus === 'CONFIRMED' || currentStatus === 'DISMISSED') {
    return (
      <span className="text-xs text-gray-500">
        Report is {currentStatus.toLowerCase()}
      </span>
    );
  }

  if (done) return <span className="text-xs text-gray-500">{done}</span>;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Review notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Internal notes for staff review..."
          className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => startTransition(async () => {
            const res = await reviewContentReportAction({
              reportId,
              status: 'CONFIRMED',
              reviewNotes: notes || undefined,
            });
            setDone(res.error ? `Error: ${res.error}` : 'Confirmed');
          })}
          disabled={pending}
          className="rounded bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
        >
          Confirm Report
        </button>
        <button
          onClick={() => startTransition(async () => {
            const res = await reviewContentReportAction({
              reportId,
              status: 'DISMISSED',
              reviewNotes: notes || undefined,
            });
            setDone(res.error ? `Error: ${res.error}` : 'Dismissed');
          })}
          disabled={pending}
          className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          Dismiss Report
        </button>
      </div>
    </div>
  );
}
