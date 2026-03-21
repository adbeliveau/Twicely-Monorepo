'use client';

/**
 * Day-of Confirmation Component (G2.12)
 *
 * Shown to buyer and seller within the day-of confirmation window.
 * Buyer can send the "Are we still on?" request; seller can confirm.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A9
 */

import { useState, useTransition } from 'react';
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import {
  sendDayOfConfirmationAction,
  respondToDayOfConfirmationAction,
} from '@/lib/actions/local-day-of-confirmation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayOfConfirmationProps {
  localTransactionId: string;
  scheduledAt: Date;
  role: 'BUYER' | 'SELLER';
  dayOfConfirmationSentAt: Date | null;
  dayOfConfirmationRespondedAt: Date | null;
  dayOfConfirmationExpired: boolean;
  /** Window hours from platform_settings — passed as SSR prop */
  windowHours: number;
}

// ─── Window helpers ───────────────────────────────────────────────────────────

function isWithinConfirmationWindow(
  scheduledAt: Date,
  windowHours: number,
): boolean {
  const now = new Date();
  const windowStart = new Date(scheduledAt);
  windowStart.setHours(windowStart.getHours() - windowHours);
  return now >= windowStart && now < scheduledAt;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DayOfConfirmation({
  localTransactionId,
  scheduledAt,
  role,
  dayOfConfirmationSentAt,
  dayOfConfirmationRespondedAt,
  dayOfConfirmationExpired,
  windowHours,
}: DayOfConfirmationProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const scheduledAtDate = new Date(scheduledAt);
  const withinWindow = isWithinConfirmationWindow(scheduledAtDate, windowHours);

  // Do not render if outside the confirmation window (buyer view)
  if (role === 'BUYER' && !withinWindow && dayOfConfirmationSentAt === null) {
    return null;
  }

  // Do not render if no request was sent (seller view)
  if (role === 'SELLER' && dayOfConfirmationSentAt === null) {
    return null;
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendDayOfConfirmationAction({ localTransactionId });
      if (!result.success) setError(result.error ?? 'Failed to send confirmation request');
    });
  }

  function handleRespond() {
    setError(null);
    startTransition(async () => {
      const result = await respondToDayOfConfirmationAction({ localTransactionId });
      if (!result.success) setError(result.error ?? 'Failed to confirm');
    });
  }

  // ── Buyer view ──────────────────────────────────────────────────────────────

  if (role === 'BUYER') {
    // Confirmed by seller
    if (dayOfConfirmationRespondedAt !== null) {
      return (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">Seller confirmed they&apos;re coming</p>
        </div>
      );
    }

    // Expired — seller did not respond
    if (dayOfConfirmationExpired) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-medium text-amber-900">Seller did not confirm</p>
          </div>
          <p className="text-xs text-amber-700">
            A reliability mark has been applied. You can still check in at the meetup.
          </p>
        </div>
      );
    }

    // Sent, awaiting seller response
    if (dayOfConfirmationSentAt !== null) {
      return (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800">Waiting for seller to confirm...</p>
        </div>
      );
    }

    // Not yet sent, within window — show send button
    return (
      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-sm text-muted-foreground">
          Want to confirm the seller is still coming?
        </p>
        <Button
          onClick={handleSend}
          disabled={isPending}
          variant="outline"
          size="sm"
          className="w-full"
        >
          {isPending ? 'Sending...' : 'Ask seller to confirm'}
        </Button>
        {error !== null && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // ── Seller view ─────────────────────────────────────────────────────────────

  // Already confirmed
  if (dayOfConfirmationRespondedAt !== null) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
        <p className="text-sm text-green-800">You confirmed you&apos;re coming</p>
      </div>
    );
  }

  // Expired — seller did not respond in time
  if (dayOfConfirmationExpired) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-900">Confirmation window expired</p>
        </div>
        <p className="text-xs text-amber-700">
          You did not respond to the day-of confirmation. A reliability mark was applied.
        </p>
      </div>
    );
  }

  // Confirmation requested — show confirm button
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-sm font-medium">The buyer wants to confirm today&apos;s meetup.</p>
      <Button
        onClick={handleRespond}
        disabled={isPending}
        variant="default"
        size="sm"
        className="w-full"
      >
        {isPending ? 'Confirming...' : "Confirm I'm coming"}
      </Button>
      {error !== null && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
