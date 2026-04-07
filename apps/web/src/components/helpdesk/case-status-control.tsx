'use client';

import { useState, useTransition } from 'react';
import { updateCaseStatus } from '@/lib/actions/helpdesk-agent-cases';

interface CaseStatusControlProps {
  caseId: string;
  currentStatus: string;
}

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING_USER', label: 'Pending User' },
  { value: 'PENDING_INTERNAL', label: 'Pending Internal' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'RESOLVED', label: 'Resolved' },
] as const;

type StatusValue = (typeof STATUS_OPTIONS)[number]['value'];

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-brand-100 text-brand-700',
  OPEN: 'bg-green-100 text-green-800',
  PENDING_USER: 'bg-amber-100 text-amber-800',
  PENDING_INTERNAL: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-gray-100 text-gray-700',
  ESCALATED: 'bg-orange-100 text-orange-800',
  RESOLVED: 'bg-slate-100 text-slate-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

export function CaseStatusControl({ caseId, currentStatus }: CaseStatusControlProps) {
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isClosed = status === 'CLOSED';

  function handleChange(newStatus: string) {
    if (newStatus === status) return;
    setError(null);

    startTransition(async () => {
      const result = await updateCaseStatus({
        caseId,
        status: newStatus as StatusValue,
      });
      if (result.success) {
        setStatus(newStatus);
      } else {
        setError(result.error ?? 'Failed to update status.');
      }
    });
  }

  if (isClosed) {
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS['CLOSED']}`}>
        Closed
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
        aria-label="Case status"
      >
        {status === 'NEW' && (
          <option value="NEW">New</option>
        )}
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
