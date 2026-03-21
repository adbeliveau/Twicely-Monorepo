'use client';

import { useState } from 'react';
import { submitEnforcementAppealAction } from '@/lib/actions/enforcement-appeals';

interface EnforcementAppealFormProps {
  enforcementAction: {
    id: string;
    actionType: string;
    reason: string;
    createdAt: Date;
    status: string;
    appealedAt: Date | null;
  };
  appealWindowDays: number;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function EnforcementAppealForm({ enforcementAction, appealWindowDays }: EnforcementAppealFormProps) {
  const [appealNote, setAppealNote] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(['']);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadline = new Date(enforcementAction.createdAt.getTime() + appealWindowDays * 24 * 60 * 60 * 1000);
  const isExpired = Date.now() > deadline.getTime();

  if (enforcementAction.appealedAt) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <div className="font-medium">Appeal submitted</div>
        <p className="mt-1">
          Your appeal was submitted on {formatDate(enforcementAction.appealedAt)} and will be reviewed within 48 hours.
        </p>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        The appeal window for this action has expired.
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <div className="font-medium">Appeal submitted</div>
        <p className="mt-1">Your appeal has been submitted and will be reviewed within 48 hours.</p>
      </div>
    );
  }

  function handleEvidenceChange(index: number, value: string) {
    setEvidenceUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  }

  function addEvidenceUrl() {
    if (evidenceUrls.length < 5) {
      setEvidenceUrls((prev) => [...prev, '']);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const urls = evidenceUrls.map((u) => u.trim()).filter(Boolean);
    const result = await submitEnforcementAppealAction({
      enforcementActionId: enforcementAction.id,
      appealNote,
      appealEvidenceUrls: urls.length > 0 ? urls : undefined,
    });

    setPending(false);
    if ('error' in result) {
      setError(result.error ?? 'An error occurred');
    } else {
      setSuccess(true);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-amber-900">Appeal this action</h3>
        <dl className="mt-2 space-y-1 text-sm text-amber-800">
          <div className="flex gap-2">
            <dt className="font-medium">Action:</dt>
            <dd>{enforcementAction.actionType.replace(/_/g, ' ')}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Reason:</dt>
            <dd>{enforcementAction.reason}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Issued:</dt>
            <dd>{formatDate(enforcementAction.createdAt)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Appeal deadline:</dt>
            <dd>{formatDate(deadline)}</dd>
          </div>
        </dl>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="appeal-note" className="block text-sm font-medium text-amber-900 mb-1">
            Appeal note <span className="text-amber-700 font-normal">(10–2000 characters)</span>
          </label>
          <textarea
            id="appeal-note"
            value={appealNote}
            onChange={(e) => setAppealNote(e.target.value)}
            minLength={10}
            maxLength={2000}
            required
            rows={4}
            className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Explain why you believe this enforcement action should be reversed..."
          />
        </div>

        <div>
          <p className="text-sm font-medium text-amber-900 mb-1">
            Evidence URLs <span className="text-amber-700 font-normal">(optional, up to 5)</span>
          </p>
          {evidenceUrls.map((url, idx) => (
            <input
              key={idx}
              type="url"
              value={url}
              onChange={(e) => handleEvidenceChange(idx, e.target.value)}
              placeholder="https://..."
              className="mb-1 w-full rounded border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          ))}
          {evidenceUrls.length < 5 && (
            <button
              type="button"
              onClick={addEvidenceUrl}
              className="text-xs text-amber-700 hover:text-amber-900 underline"
            >
              + Add another URL
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={pending || appealNote.length < 10}
          className="rounded bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {pending ? 'Submitting…' : 'Submit Appeal'}
        </button>
      </form>
    </div>
  );
}
