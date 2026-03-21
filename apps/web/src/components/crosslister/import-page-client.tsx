'use client';

/**
 * Client-side wrapper for the import page.
 * Manages the import state machine: idle → in_progress → completed/failed.
 * Source: F1.3 install prompt §2.9 Page 3
 */

import { useState } from 'react';
import { ImportStartForm } from './import-start-form';
import { ImportProgress } from './import-progress';
import { ImportSummary } from './import-summary';
import type { CrosslisterAccount, ImportBatch } from '@twicely/crosslister/db-types';
import { Loader2 } from 'lucide-react';

type PageState = 'idle' | 'in_progress' | 'completed' | 'failed';

interface ImportPageClientProps {
  accounts: CrosslisterAccount[];
  activeBatchId: string | null;
  lastCompletedBatch: ImportBatch | null;
}

export function ImportPageClient({
  accounts,
  activeBatchId,
  lastCompletedBatch,
}: ImportPageClientProps) {
  const [batchId, setBatchId] = useState<string | null>(activeBatchId);
  const [completedBatch, setCompletedBatch] = useState<ImportBatch | null>(lastCompletedBatch);

  const pageState: PageState = (() => {
    if (batchId && !completedBatch) return 'in_progress';
    if (completedBatch?.status === 'FAILED') return 'failed';
    if (completedBatch) return 'completed';
    return 'idle';
  })();

  const handleBatchStarted = (id: string) => {
    setBatchId(id);
    setCompletedBatch(null);
  };

  const handleCompleted = (batch: ImportBatch) => {
    setCompletedBatch(batch);
    setBatchId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Listings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Import your existing listings from other platforms for free.
        </p>
      </div>

      {pageState === 'idle' && (
        <ImportStartForm accounts={accounts} onBatchStarted={handleBatchStarted} />
      )}

      {pageState === 'in_progress' && batchId && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <h2 className="font-semibold">Importing from eBay...</h2>
          </div>
          <ImportProgress batchId={batchId} onCompleted={handleCompleted} />
        </div>
      )}

      {(pageState === 'completed' || pageState === 'failed') && completedBatch && (
        <ImportSummary batch={completedBatch} />
      )}
    </div>
  );
}
