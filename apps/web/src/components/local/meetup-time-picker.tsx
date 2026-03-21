'use client';

/**
 * MeetupTimePicker (G2.9)
 *
 * Date/time proposal and acceptance widget for local meetups.
 * Uses native <input type="datetime-local"> — no date-picker library.
 *
 * // TODO(SafeTrade): Gate behind SafeTrade when A0 is implemented.
 */

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { proposeMeetupTimeAction, acceptMeetupTimeAction } from '@/lib/actions/local-scheduling';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetupTimePickerProps {
  localTransactionId: string;
  /** Currently proposed time, null if no proposal yet */
  proposedAt: Date | null;
  /** Who proposed the current time (userId) */
  proposedByUserId: string | null;
  /** Whether the time is confirmed (both parties agreed) */
  isConfirmed: boolean;
  /** Current user's role in this transaction */
  role: 'BUYER' | 'SELLER';
  /** Current user's userId */
  currentUserId: string;
  /** Name of the other party (for display) */
  otherPartyName: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a Date for display in the UI */
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

/** Format a Date for the datetime-local input's min/max attributes (YYYY-MM-DDTHH:mm) */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MeetupTimePicker({
  localTransactionId,
  proposedAt,
  proposedByUserId,
  isConfirmed,
  currentUserId,
  otherPartyName,
}: MeetupTimePickerProps) {
  const [selectedValue, setSelectedValue] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Compute min/max for the datetime-local input
  const now = new Date();
  const minDate = new Date(now);
  minDate.setHours(minDate.getHours() + 1);

  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + 30);

  const minValue = toDatetimeLocalValue(minDate);
  const maxValue = toDatetimeLocalValue(maxDate);

  function handlePropose() {
    if (!selectedValue) {
      setError('Please select a date and time');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await proposeMeetupTimeAction({
        localTransactionId,
        proposedAt: new Date(selectedValue).toISOString(),
      });
      if (result.success) {
        setShowPicker(false);
        setSelectedValue('');
      } else {
        setError(result.error ?? 'Failed to propose time');
      }
    });
  }

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptMeetupTimeAction({ localTransactionId });
      if (!result.success) {
        setError(result.error ?? 'Failed to accept time');
      }
    });
  }

  // ─── State 4: Confirmed ─────────────────────────────────────────────────────
  if (isConfirmed && proposedAt !== null) {
    return (
      <div className="rounded-md border bg-green-50 border-green-200 p-3 space-y-1">
        <p className="text-sm font-medium text-green-900">
          Meetup confirmed for {formatDateTime(proposedAt)}
        </p>
      </div>
    );
  }

  // ─── Picker widget (shared for propose and counter-propose) ─────────────────
  function renderPicker(label: string) {
    return (
      <div className="space-y-2 mt-2">
        <input
          type="datetime-local"
          value={selectedValue}
          min={minValue}
          max={maxValue}
          step="1800"
          onChange={(e) => setSelectedValue(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Select meetup date and time"
        />
        <div className="flex gap-2">
          <Button
            onClick={handlePropose}
            disabled={isPending || !selectedValue}
            size="sm"
          >
            {isPending ? 'Submitting…' : label}
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
    );
  }

  // ─── State 1: No proposal yet ───────────────────────────────────────────────
  if (proposedAt === null) {
    return (
      <div className="rounded-md border p-3 space-y-2">
        <p className="text-sm font-medium">Schedule Your Meetup</p>
        <p className="text-xs text-muted-foreground">
          Propose a date and time. {otherPartyName} will need to accept.
        </p>
        {!showPicker && (
          <Button
            size="sm"
            onClick={() => setShowPicker(true)}
            disabled={isPending}
          >
            Propose Time
          </Button>
        )}
        {showPicker && renderPicker('Propose Time')}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  const iProposed = proposedByUserId === currentUserId;

  // ─── State 2: I proposed — waiting for other party ─────────────────────────
  if (iProposed) {
    return (
      <div className="rounded-md border p-3 space-y-2">
        <p className="text-sm">
          You proposed <span className="font-medium">{formatDateTime(proposedAt)}</span>.
          Waiting for {otherPartyName} to accept.
        </p>
        {!showPicker && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPicker(true)}
            disabled={isPending}
          >
            Change Time
          </Button>
        )}
        {showPicker && renderPicker('Submit New Time')}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // ─── State 3: Other party proposed — I can accept or counter ───────────────
  return (
    <div className="rounded-md border p-3 space-y-2">
      <p className="text-sm">
        <span className="font-medium">{otherPartyName}</span> proposed{' '}
        <span className="font-medium">{formatDateTime(proposedAt)}</span>.
      </p>
      {!showPicker && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleAccept}
            disabled={isPending}
          >
            {isPending ? 'Accepting…' : 'Accept'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPicker(true)}
            disabled={isPending}
          >
            Suggest Different Time
          </Button>
        </div>
      )}
      {showPicker && renderPicker('Suggest Different Time')}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
