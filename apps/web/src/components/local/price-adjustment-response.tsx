'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { respondToAdjustmentAction } from '@/lib/actions/local-price-adjustment';
import { formatCentsToDollars } from '@twicely/finance/format';

interface PriceAdjustmentResponseProps {
  localTransactionId: string;
  originalPriceCents: number;
  adjustedPriceCents: number;
  adjustmentReason: string;
}

export function PriceAdjustmentResponse({
  localTransactionId,
  originalPriceCents,
  adjustedPriceCents,
  adjustmentReason,
}: PriceAdjustmentResponseProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const savingsCents = originalPriceCents - adjustedPriceCents;

  function handleRespond(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await respondToAdjustmentAction({
        localTransactionId,
        accept,
      });
      if (!result.success) {
        setError(result.error ?? (accept ? 'Failed to accept' : 'Failed to decline'));
      }
    });
  }

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-blue-50 border-blue-200">
      <p className="text-sm font-medium text-blue-900">
        The seller has proposed a price adjustment
      </p>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground line-through">
            {formatCentsToDollars(originalPriceCents)}
          </span>
          <span className="text-sm font-semibold text-green-700">
            {formatCentsToDollars(adjustedPriceCents)}
          </span>
          <span className="text-xs text-green-600 bg-green-100 rounded px-1 py-0.5">
            Save {formatCentsToDollars(savingsCents)}
          </span>
        </div>

        <div className="bg-white rounded p-2 border border-blue-100">
          <p className="text-xs text-muted-foreground mb-1">Seller&apos;s reason:</p>
          <p className="text-sm text-gray-800">{adjustmentReason}</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => handleRespond(true)}
          disabled={isPending}
          size="sm"
          className="flex-1"
        >
          {isPending ? 'Processing…' : 'Accept'}
        </Button>
        <Button
          onClick={() => handleRespond(false)}
          disabled={isPending}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          {isPending ? 'Processing…' : 'Decline'}
        </Button>
      </div>
    </div>
  );
}
