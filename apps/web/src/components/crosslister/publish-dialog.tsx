'use client';

/**
 * PublishDialog — batch publish confirmation modal with progress and results.
 * Source: F3 install prompt §3.8
 */

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@twicely/ui/dialog';
import { Button } from '@twicely/ui/button';
import { Badge } from '@twicely/ui/badge';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { publishListings } from '@/lib/actions/crosslister-publish';
import { CHANNEL_REGISTRY } from '@twicely/crosslister/channel-registry';
import type { PublishAllowance } from '@twicely/crosslister/services/publish-meter';
import type { ExternalChannel } from '@twicely/crosslister/types';

interface PublishDialogProps {
  listingIds: string[];
  channels: ExternalChannel[];
  allowance: PublishAllowance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished: () => void;
}

interface EnqueueError {
  listingId: string;
  channel: string;
  error: string;
}

export function PublishDialog({
  listingIds,
  channels,
  allowance,
  open,
  onOpenChange,
  onPublished,
}: PublishDialogProps) {
  const totalNeeded = listingIds.length * channels.length;
  const hasEnough = allowance.remaining >= totalNeeded;

  const [enqueuedCount, setEnqueuedCount] = useState<number | null>(null);
  const [enqueueErrors, setEnqueueErrors] = useState<EnqueueError[] | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    setGlobalError(null);
    startTransition(async () => {
      const result = await publishListings({ listingIds, channels });
      if (!result.success) {
        setGlobalError(result.error ?? 'Publish failed');
        return;
      }
      const summary = result.data!;
      setEnqueuedCount(summary.queued);
      setEnqueueErrors(summary.errors.length > 0 ? summary.errors : null);
      if (summary.queued > 0) onPublished();
    });
  }

  function handleClose() {
    setEnqueuedCount(null);
    setEnqueueErrors(null);
    setGlobalError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish to platforms</DialogTitle>
          <DialogDescription>
            {listingIds.length} listing{listingIds.length !== 1 ? 's' : ''} to {channels.length} platform{channels.length !== 1 ? 's' : ''} ({totalNeeded} total publish{totalNeeded !== 1 ? 'es' : ''})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="text-sm text-muted-foreground">
            Allowance: <span className="font-medium text-foreground">{allowance.remaining}</span> remaining / {allowance.monthlyLimit} this month
          </div>

          {!hasEnough && enqueuedCount === null && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
              Insufficient publish credits. {allowance.remaining} remaining, {totalNeeded} needed.
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {channels.map((ch) => {
              const meta = CHANNEL_REGISTRY.get(ch);
              return (
                <Badge key={ch} variant="secondary">{meta?.displayName ?? ch}</Badge>
              );
            })}
          </div>

          {globalError && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
              {globalError}
            </div>
          )}

          {isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Queuing jobs...
            </div>
          )}

          {enqueuedCount !== null && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span>
                  Queued {enqueuedCount} job{enqueuedCount !== 1 ? 's' : ''} for publishing. You can track progress on the crosslister dashboard.
                </span>
              </div>
              {enqueueErrors && enqueueErrors.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {enqueueErrors.map((e, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      <span className="truncate flex-1">{e.channel}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]">{e.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {enqueuedCount === null ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handlePublish} disabled={isPending || !hasEnough}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Queue for publishing
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
