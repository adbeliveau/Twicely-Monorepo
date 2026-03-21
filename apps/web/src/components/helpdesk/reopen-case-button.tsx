'use client';

import { useState, useTransition } from 'react';
import { reopenCase } from '@/lib/actions/helpdesk-cases';
import { RotateCcw } from 'lucide-react';

interface ReopenCaseButtonProps {
  caseId: string;
  resolvedAt: Date | null;
}

export function ReopenCaseButton({ caseId, resolvedAt }: ReopenCaseButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Server-side window check is authoritative, but provide a client-side hint
  // The default window is 7 days; if beyond that, hide the button optimistically.
  if (resolvedAt) {
    const windowMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(resolvedAt).getTime() > windowMs) {
      return null;
    }
  }

  function handleReopen() {
    setError(null);
    startTransition(async () => {
      const result = await reopenCase(caseId);
      if (!result.success) {
        setError(result.error ?? 'Could not reopen this case.');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1 flex-shrink-0">
      <button
        type="button"
        onClick={handleReopen}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RotateCcw className="h-4 w-4" />
        {isPending ? 'Reopening…' : 'Reopen Case'}
      </button>
      {error && <p className="text-xs text-red-600 text-right">{error}</p>}
    </div>
  );
}
