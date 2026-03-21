'use client';

import { useState } from 'react';
import { reviewEnforcementAppealAction } from '@/lib/actions/enforcement-appeals';

interface AppealReviewFormProps {
  enforcementActionId: string;
}

type Decision = 'APPROVED' | 'DENIED';

export function AppealReviewForm({ enforcementActionId }: AppealReviewFormProps) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ decision: Decision } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className={`rounded p-3 text-sm font-medium ${
        done.decision === 'APPROVED'
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-gray-50 border border-gray-200 text-gray-700'
      }`}>
        {done.decision === 'APPROVED'
          ? 'Appeal approved — enforcement action has been lifted.'
          : 'Appeal denied — enforcement action remains in effect.'}
      </div>
    );
  }

  function handleSelect(d: Decision) {
    setDecision(d);
    setConfirming(false);
    setError(null);
  }

  async function handleConfirm() {
    if (!decision || reviewNote.trim().length < 1) return;
    setError(null);
    setPending(true);

    const result = await reviewEnforcementAppealAction({
      enforcementActionId,
      decision,
      reviewNote: reviewNote.trim(),
    });

    setPending(false);
    if ('error' in result) {
      setError(result.error ?? 'An error occurred');
    } else {
      setDone({ decision });
    }
  }

  const confirmMessage =
    decision === 'APPROVED'
      ? 'This will lift the enforcement action and reverse all side effects.'
      : 'The enforcement action will remain in effect.';

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handleSelect('APPROVED')}
          className={`flex-1 rounded border px-4 py-2 text-sm font-medium transition-colors ${
            decision === 'APPROVED'
              ? 'border-green-600 bg-green-600 text-white'
              : 'border-green-300 text-green-700 hover:bg-green-50'
          }`}
        >
          Approve Appeal
        </button>
        <button
          type="button"
          onClick={() => handleSelect('DENIED')}
          className={`flex-1 rounded border px-4 py-2 text-sm font-medium transition-colors ${
            decision === 'DENIED'
              ? 'border-red-600 bg-red-600 text-white'
              : 'border-red-300 text-red-700 hover:bg-red-50'
          }`}
        >
          Deny Appeal
        </button>
      </div>

      {decision && (
        <div className="space-y-3">
          <div>
            <label htmlFor="review-note" className="block text-sm font-medium text-gray-700 mb-1">
              Review note <span className="text-gray-500 font-normal">(required)</span>
            </label>
            <textarea
              id="review-note"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              maxLength={2000}
              required
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Provide reasoning for your decision..."
            />
          </div>

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={reviewNote.trim().length < 1}
              className={`w-full rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                decision === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {decision === 'APPROVED' ? 'Approve Appeal' : 'Deny Appeal'}
            </button>
          ) : (
            <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-3">
              <p className="text-sm text-gray-700 font-medium">Are you sure?</p>
              <p className="text-sm text-gray-600">{confirmMessage}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={pending}
                  className={`flex-1 rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                    decision === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {pending ? 'Processing…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
    </div>
  );
}
