'use client';

/**
 * QueueStatusCard — shows a summary of the seller's active publish queue.
 * Source: F3.1 install prompt §3.10; Feature Lock-in Section 46
 *
 * Displays: queued count, in-progress count, failed count (last 24h).
 * If all counts are 0, shows "No active jobs" in muted text.
 */

import type { QueueStatusSummary } from '@/lib/queries/crosslister';

interface QueueStatusCardProps {
  status: QueueStatusSummary;
}

export function QueueStatusCard({ status }: QueueStatusCardProps) {
  const { queued, inProgress, failed } = status;
  const hasActivity = queued > 0 || inProgress > 0 || failed > 0;

  if (!hasActivity) {
    return (
      <div className="text-sm text-muted-foreground">
        No active jobs
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="font-medium text-foreground">Queue Status</span>

      {inProgress > 0 && (
        <span className="text-blue-600 dark:text-blue-400">
          {inProgress} publishing
        </span>
      )}

      {queued > 0 && (
        <span className="text-foreground">
          {queued} queued
        </span>
      )}

      {failed > 0 && (
        <span className="text-destructive">
          {failed} failed (last 24h)
        </span>
      )}
    </div>
  );
}
