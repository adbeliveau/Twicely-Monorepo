'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@twicely/ui/alert-dialog';
import { Textarea } from '@twicely/ui/textarea';
import { cancelLocalTransactionAction } from '@/lib/actions/local-cancel';

interface CancelMeetupButtonProps {
  localTransactionId: string;
  scheduledAt: Date | null;
}

function getReliabilityWarning(scheduledAt: Date | null): string {
  if (scheduledAt === null) {
    return 'No reliability impact.';
  }
  const hoursUntil = (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < 2) {
    return 'This late cancellation will result in 2 reliability marks.';
  }
  if (hoursUntil < 24) {
    return 'This will result in a reliability mark on your account.';
  }
  return 'No reliability impact.';
}

export function CancelMeetupButton({
  localTransactionId,
  scheduledAt,
}: CancelMeetupButtonProps) {
  const [isCanceled, setIsCanceled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  const warning = getReliabilityWarning(scheduledAt);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelLocalTransactionAction({
        localTransactionId,
        reason: reason.trim().length > 0 ? reason.trim() : undefined,
      });
      if (result.success) {
        setIsCanceled(true);
      } else {
        setError(result.error ?? 'Failed to cancel meetup');
      }
    });
  }

  if (isCanceled) {
    return (
      <Button variant="destructive" disabled className="w-full">
        Canceled
      </Button>
    );
  }

  return (
    <div className="space-y-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={isPending} className="w-full">
            {isPending ? 'Canceling…' : 'Cancel Meetup'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this meetup?</AlertDialogTitle>
            <AlertDialogDescription>{warning}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Meetup</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Meetup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
