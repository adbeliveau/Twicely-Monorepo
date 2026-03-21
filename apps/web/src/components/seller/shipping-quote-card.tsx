'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { formatPrice } from '@twicely/utils/format';
import { submitShippingQuote } from '@/lib/actions/shipping-quote';
import type { ShippingQuoteData } from '@/lib/queries/shipping-quote';

interface ShippingQuoteCardProps {
  quote: ShippingQuoteData;
}

export function ShippingQuoteCard({ quote }: ShippingQuoteCardProps) {
  const [quoteCents, setQuoteCents] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOverdue = new Date() > quote.sellerDeadline;
  const isPendingSeller = quote.status === 'PENDING_SELLER';
  const isPenaltyApplied = quote.status === 'PENALTY_APPLIED';
  const isPendingBuyer = quote.status === 'PENDING_BUYER';
  const isAccepted = quote.status === 'ACCEPTED';

  if (!isPendingSeller && !isPenaltyApplied && !isPendingBuyer && !isAccepted) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dollars = parseFloat(quoteCents);
    if (isNaN(dollars) || dollars < 0) {
      setError('Please enter a valid shipping amount.');
      return;
    }

    const cents = Math.round(dollars * 100);
    setSubmitting(true);

    const result = await submitShippingQuote({
      quoteId: quote.id,
      quotedShippingCents: cents,
    });

    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'Failed to submit quote. Please try again.');
    }
  }

  const penaltyPrice =
    quote.finalShippingCents ??
    Math.round(
      quote.maxShippingCents * (1 - (quote.penaltyDiscountPercent ?? 25) / 100)
    );

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="font-semibold mb-4">Combined Shipping Quote Required</h2>

      <p className="text-sm text-gray-600 mb-4">
        This order has multiple items. The buyer is waiting for your combined
        shipping quote.
      </p>

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-gray-600">Maximum shipping (individual rates):</span>
          <span className="font-medium">{formatPrice(quote.maxShippingCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Deadline:</span>
          <span
            className={
              isOverdue ? 'font-medium text-red-600' : 'font-medium'
            }
          >
            {isOverdue
              ? 'Past due'
              : quote.sellerDeadline.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
          </span>
        </div>
      </div>

      {isPenaltyApplied && (
        <div className="rounded-md bg-orange-50 border border-orange-200 p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
          <div className="text-sm text-orange-800">
            <p className="font-medium">You missed the deadline.</p>
            <p>
              The buyer received a {quote.penaltyDiscountPercent ?? 25}% shipping
              discount. Current price: {formatPrice(penaltyPrice)}.
            </p>
            <p className="mt-1">
              You can still submit a lower quote. The buyer will pay the lower of
              your quote or {formatPrice(penaltyPrice)}.
            </p>
          </div>
        </div>
      )}

      {isPendingBuyer && quote.quotedShippingCents !== null && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 flex items-start gap-2">
          <Clock className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <p>
              You quoted:{' '}
              <span className="font-medium">
                {formatPrice(quote.quotedShippingCents)}
              </span>{' '}
              (saves buyer{' '}
              {formatPrice(quote.maxShippingCents - quote.quotedShippingCents)})
            </p>
            <p className="mt-1">Waiting for buyer response...</p>
          </div>
        </div>
      )}

      {isAccepted && quote.finalShippingCents !== null && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm text-green-800">
            <p>
              Buyer accepted your quote of{' '}
              <span className="font-medium">
                {formatPrice(quote.finalShippingCents)}
              </span>
              .{' '}
              {quote.savingsCents !== null && quote.savingsCents > 0 && (
                <>Savings: {formatPrice(quote.savingsCents)}</>
              )}
            </p>
          </div>
        </div>
      )}

      {(isPendingSeller || isPenaltyApplied) && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="quote-amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Your combined shipping quote ($)
            </label>
            <Input
              id="quote-amount"
              type="number"
              step="0.01"
              min="0"
              max={(quote.maxShippingCents / 100).toFixed(2)}
              value={quoteCents}
              onChange={(e) => setQuoteCents(e.target.value)}
              placeholder="0.00"
              className="w-40"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Quote'}
          </Button>
        </form>
      )}
    </div>
  );
}
