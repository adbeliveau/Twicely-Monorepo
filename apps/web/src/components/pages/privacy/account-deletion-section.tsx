'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
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
import { beginAccountDeletion, cancelAccountDeletion } from '@/lib/actions/account-deletion';

interface Blocker {
  type: string;
  count: number;
  message: string;
}

interface Props {
  deletionRequestedAt: Date | null;
  blockers: Blocker[];
  gracePeriodDays: number;
}

export function AccountDeletionSection({
  deletionRequestedAt,
  blockers,
  gracePeriodDays,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [requested, setRequested] = useState(deletionRequestedAt !== null);
  const [isPending, startTransition] = useTransition();

  const deletionDate = deletionRequestedAt
    ? new Date(
        new Date(deletionRequestedAt).getTime() + gracePeriodDays * 24 * 60 * 60 * 1000
      )
    : null;

  const daysRemaining = deletionDate
    ? Math.max(
        0,
        Math.ceil((deletionDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : null;

  function handleDelete() {
    startTransition(async () => {
      const result = await beginAccountDeletion();
      if (result.success) {
        setRequested(true);
        setMessage(
          `Account deletion started. Your account will be permanently deleted in ${gracePeriodDays} days unless you cancel.`
        );
      } else {
        setMessage(result.error ?? 'Failed to start deletion.');
      }
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelAccountDeletion();
      if (result.success) {
        setRequested(false);
        setMessage('Account deletion cancelled. Your account is safe.');
      } else {
        setMessage(result.error ?? 'Failed to cancel deletion.');
      }
    });
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          Delete Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {blockers.length > 0 && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">
              You cannot delete your account while the following are open:
            </p>
            {blockers.map((blocker) => (
              <p key={blocker.type} className="text-sm text-amber-800">
                {blocker.message}
              </p>
            ))}
          </div>
        )}

        {!requested ? (
          <>
            <p className="text-sm text-muted-foreground">
              This will permanently delete your account after a {gracePeriodDays}-day
              cooling-off period. All your data will be anonymized.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={blockers.length > 0 || isPending}
                  type="button"
                >
                  Delete My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your account will be permanently deleted after {gracePeriodDays} days.
                    You can cancel this during the cooling-off period.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep my account</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              Account deletion is scheduled.
              {daysRemaining !== null && (
                <> Your account will be deleted in {daysRemaining} day(s)
                  {deletionDate && <> ({deletionDate.toLocaleDateString()})</>}.
                </>
              )}
            </p>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
              type="button"
            >
              Cancel Deletion
            </Button>
          </div>
        )}

        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
