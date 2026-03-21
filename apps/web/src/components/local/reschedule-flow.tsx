'use client';

/**
 * RescheduleFlow (G2.10)
 *
 * Handles the reschedule UI after initial meetup scheduling is confirmed.
 * Rendered inside LocalMeetupCard when status is eligible for reschedule.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A7
 */

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { proposeRescheduleAction, respondToRescheduleAction } from '@/lib/actions/local-reschedule';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RescheduleFlowProps {
  localTransactionId: string;
  /** Currently confirmed meetup time */
  scheduledAt: Date;
  /** Proposed reschedule time (null if no pending proposal) */
  rescheduleProposedAt: Date | null;
  /** Who proposed the reschedule (userId, null if no pending proposal) */
  proposedByUserId: string | null;
  /** Current user's userId */
  currentUserId: string;
  /** Display name of the other party */
  otherPartyName: string;
  /** Current reschedule count */
  rescheduleCount: number;
  /** Max free reschedules before reliability marks */
  rescheduleMaxCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RescheduleFlow({
  localTransactionId,
  scheduledAt,
  rescheduleProposedAt,
  proposedByUserId,
  currentUserId,
  otherPartyName,
  rescheduleCount,
  rescheduleMaxCount,
}: RescheduleFlowProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedValue, setSelectedValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const now = new Date();
  const minDate = new Date(now);
  minDate.setHours(minDate.getHours() + 1);
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + 30);
  const minValue = toDatetimeLocalValue(minDate);
  const maxValue = toDatetimeLocalValue(maxDate);

  function handlePropose() {
    if (!selectedValue) { setError('Please select a date and time'); return; }
    setError(null);
    startTransition(async () => {
      const result = await proposeRescheduleAction({
        localTransactionId,
        proposedAt: new Date(selectedValue).toISOString(),
      });
      if (result.success) {
        setShowPicker(false);
        setSelectedValue('');
      } else {
        setError(result.error ?? 'Failed to propose reschedule');
      }
    });
  }

  function handleRespond(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await respondToRescheduleAction({ localTransactionId, accept });
      if (!result.success) {
        setError(result.error ?? 'Failed to respond to reschedule');
      }
    });
  }

  const iHaveProposed = proposedByUserId === currentUserId;
  const otherPartyProposed = rescheduleProposedAt !== null && !iHaveProposed;

  // ─── State: other party has a pending reschedule proposal ─────────────────
  if (otherPartyProposed && rescheduleProposedAt !== null) {
    return (
      <div className="rounded-md border p-3 space-y-2">
        <p className="text-sm">
          <span className="font-medium">{otherPartyName}</span> wants to reschedule to{' '}
          <span className="font-medium">{formatDateTime(rescheduleProposedAt)}</span>.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleRespond(true)} disabled={isPending}>
            {isPending ? 'Accepting…' : 'Accept'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleRespond(false)} disabled={isPending}>
            {isPending ? 'Declining…' : 'Decline'}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // ─── State: I proposed a reschedule — waiting for other party ────────────
  if (iHaveProposed && rescheduleProposedAt !== null) {
    return (
      <div className="rounded-md border p-3 space-y-2">
        <p className="text-sm">
          You proposed rescheduling to{' '}
          <span className="font-medium">{formatDateTime(rescheduleProposedAt)}</span>.{' '}
          Waiting for {otherPartyName} to respond.
        </p>
      </div>
    );
  }

  // ─── State: no pending reschedule — show Reschedule Meetup button ─────────
  return (
    <div className="rounded-md border p-3 space-y-2">
      {rescheduleCount >= rescheduleMaxCount && (
        <p className="text-xs text-amber-700">
          Note: Additional reschedules may affect your reliability score.
        </p>
      )}
      {!showPicker && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPicker(true)}
          disabled={isPending}
        >
          Reschedule Meetup
        </Button>
      )}
      {showPicker && (
        <div className="space-y-2 mt-2">
          <p className="text-sm font-medium">Propose a new time</p>
          <input
            type="datetime-local"
            value={selectedValue}
            min={minValue}
            max={maxValue}
            step="1800"
            onChange={(e) => setSelectedValue(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-label="Select new meetup date and time"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePropose} disabled={isPending || !selectedValue}>
              {isPending ? 'Submitting…' : 'Propose New Time'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowPicker(false); setSelectedValue(''); setError(null); }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!showPicker && (
        <p className="text-xs text-muted-foreground">
          Currently scheduled for {formatDateTime(scheduledAt)}.
        </p>
      )}
    </div>
  );
}
