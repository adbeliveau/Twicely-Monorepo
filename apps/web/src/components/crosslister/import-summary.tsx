'use client';

/**
 * Completed import summary card.
 * Source: F1.3 install prompt §2.9 Page 3
 */

import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { ImportBatch } from '@twicely/crosslister/db-types';

interface ImportSummaryProps {
  batch: ImportBatch;
}

export function ImportSummary({ batch }: ImportSummaryProps) {
  const failed = batch.failedItems > 0;
  const isPartial = batch.status === 'PARTIALLY_COMPLETED';

  return (
    <div className="rounded-lg border bg-card p-6 space-y-5">
      <div className="flex items-center gap-3">
        {failed ? (
          <AlertCircle className="h-7 w-7 text-amber-500 shrink-0" />
        ) : (
          <CheckCircle className="h-7 w-7 text-green-500 shrink-0" />
        )}
        <div>
          <h3 className="font-semibold text-lg">
            {isPartial ? 'Import partially complete' : 'Import complete!'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Your eBay listings have been imported to Twicely.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'New listings', value: batch.createdItems, color: 'text-green-600' },
          { label: 'Linked existing', value: batch.deduplicatedItems, color: 'text-blue-600' },
          { label: 'Issues', value: batch.failedItems, color: batch.failedItems > 0 ? 'text-red-600' : 'text-muted-foreground' },
          { label: 'Skipped', value: batch.skippedItems, color: 'text-muted-foreground' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border p-3 text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button asChild>
          <Link href="/my/selling/listings">View your listings</Link>
        </Button>
        {failed && (
          <Button asChild variant="outline">
            <Link href={`/my/selling/crosslist/import/issues`}>
              Review {batch.failedItems} issue{batch.failedItems !== 1 ? 's' : ''}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
