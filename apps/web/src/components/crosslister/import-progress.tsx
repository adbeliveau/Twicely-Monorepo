'use client';

/**
 * Import progress bar + live counts.
 * Polls via getImportBatchStatus every 3 seconds (Centrifugo fallback).
 * Source: F1.3 install prompt §2.9 Page 3
 */

import { useEffect, useState } from 'react';
import { getImportBatchStatus } from '@/lib/actions/crosslister-import';
import type { ImportBatch } from '@twicely/crosslister/db-types';
import { Loader2 } from 'lucide-react';

interface ImportProgressProps {
  batchId: string;
  onCompleted: (batch: ImportBatch) => void;
}

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Preparing...',
  FETCHING: 'Fetching listings from eBay...',
  DEDUPLICATING: 'Checking for duplicates...',
  TRANSFORMING: 'Normalizing listings...',
  IMPORTING: 'Creating listings...',
  COMPLETED: 'Complete',
  PARTIALLY_COMPLETED: 'Partially complete',
  FAILED: 'Failed',
};

export function ImportProgress({ batchId, onCompleted }: ImportProgressProps) {
  const [batch, setBatch] = useState<ImportBatch | null>(null);

  useEffect(() => {
    let active = true;

    async function poll(): Promise<void> {
      const result = await getImportBatchStatus({ batchId });
      if (!active) return;

      if (result.success && result.data) {
        setBatch(result.data);

        const done = ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'].includes(result.data.status);
        if (done) {
          onCompleted(result.data);
          return;
        }

        // Poll again in 3 seconds
        setTimeout(() => { void poll(); }, 3000);
      }
    }

    void poll();
    return () => { active = false; };
  }, [batchId, onCompleted]);

  if (!batch) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Starting import...</span>
      </div>
    );
  }

  const total = batch.totalItems > 0 ? batch.totalItems : 1;
  const processed = batch.processedItems;
  const pct = Math.min(100, Math.round((processed / total) * 100));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium">
          {STATUS_LABELS[batch.status] ?? batch.status}
        </span>
      </div>

      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {processed} / {batch.totalItems} processed ({pct}%)
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Created', value: batch.createdItems, color: 'text-green-600' },
          { label: 'Linked', value: batch.deduplicatedItems, color: 'text-blue-600' },
          { label: 'Failed', value: batch.failedItems, color: 'text-red-600' },
          { label: 'Skipped', value: batch.skippedItems, color: 'text-muted-foreground' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border bg-card p-3 text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
