'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { initiatePriceAdjustmentAction } from '@/lib/actions/local-price-adjustment';
import { formatCentsToDollars } from '@twicely/finance/format';

interface PriceAdjustmentFormProps {
  localTransactionId: string;
  originalPriceCents: number;
  maxDiscountPercent: number;
}

export function PriceAdjustmentForm({
  localTransactionId,
  originalPriceCents,
  maxDiscountPercent,
}: PriceAdjustmentFormProps) {
  const [dollarsInput, setDollarsInput] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const floorCents = Math.ceil(originalPriceCents * (1 - maxDiscountPercent / 100));

  function getDollarsAsInt(value: string): number {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const adjustedPriceCents = getDollarsAsInt(dollarsInput);

    if (adjustedPriceCents < 1) {
      setError('Enter a valid price greater than $0.00');
      return;
    }
    if (adjustedPriceCents >= originalPriceCents) {
      setError('Adjusted price must be lower than the original price');
      return;
    }
    if (adjustedPriceCents < floorCents) {
      setError(
        `Maximum discount is ${maxDiscountPercent}%. Minimum price: ${formatCentsToDollars(floorCents)}`,
      );
      return;
    }
    if (reason.trim().length === 0) {
      setError('Please provide a reason for the price adjustment');
      return;
    }

    startTransition(async () => {
      const result = await initiatePriceAdjustmentAction({
        localTransactionId,
        adjustedPriceCents,
        adjustmentReason: reason.trim(),
      });
      if (!result.success) {
        setError(result.error ?? 'Failed to submit price adjustment');
      }
    });
  }

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-amber-50 border-amber-200">
      <div>
        <p className="text-sm font-medium text-amber-900">Propose a Price Adjustment</p>
        <p className="text-xs text-amber-700 mt-1">
          Original price: {formatCentsToDollars(originalPriceCents)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="adjusted-price" className="text-sm">
            New price (max {maxDiscountPercent}% reduction)
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <input
              id="adjusted-price"
              type="number"
              min="0.01"
              step="0.01"
              value={dollarsInput}
              onChange={(e) => setDollarsInput(e.target.value)}
              className="w-full pl-7 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="0.00"
              disabled={isPending}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Minimum: {formatCentsToDollars(floorCents)}
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="adjustment-reason" className="text-sm">
            Reason for adjustment
          </Label>
          <Textarea
            id="adjustment-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Describe the flaw or issue discovered at the meetup"
            disabled={isPending}
            className="text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">
            {reason.length}/500
          </p>
        </div>

        <p className="text-xs text-amber-700 bg-amber-100 rounded p-2">
          The buyer must accept this price change. Twicely fees are calculated on the original price.
        </p>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          type="submit"
          disabled={isPending}
          variant="outline"
          size="sm"
          className="w-full"
        >
          {isPending ? 'Submitting…' : 'Send Price Adjustment to Buyer'}
        </Button>
      </form>
    </div>
  );
}
