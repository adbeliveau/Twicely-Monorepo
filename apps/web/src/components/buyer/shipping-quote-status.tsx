'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { formatPrice } from '@twicely/utils/format';
import { respondToShippingQuote } from '@/lib/actions/shipping-quote';
import type { ShippingQuoteData } from '@/lib/queries/shipping-quote';

interface ShippingQuoteStatusProps {
  quote: ShippingQuoteData;
  orderId: string;
}

export function ShippingQuoteStatus({ quote, orderId }: ShippingQuoteStatusProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPendingSeller = quote.status === 'PENDING_SELLER';
  const isPendingBuyer = quote.status === 'PENDING_BUYER';
  const isPenaltyApplied = quote.status === 'PENALTY_APPLIED';
  const isAccepted = quote.status === 'ACCEPTED';
  const isDisputed = quote.status === 'DISPUTED';

  async function handleAction(action: 'ACCEPT' | 'DISPUTE') {
    setError(null);
    setSubmitting(true);

    const result = await respondToShippingQuote({
      quoteId: quote.id,
      action,
    });

    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'Action failed. Please try again.');
    }
  }

  const penaltyPrice =
    quote.finalShippingCents ??
    Math.round(
      quote.maxShippingCents * (1 - (quote.penaltyDiscountPercent ?? 25) / 100)
    );

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="font-semibold mb-4">Combined Shipping</h2>

      {isPendingSeller && (
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
          <div className="text-sm text-gray-700">
            <p>Waiting for the seller to provide a combined shipping quote.</p>
            <p className="mt-1">
              If the seller does not respond by{' '}
              <span className="font-medium">
                {quote.sellerDeadline.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              , you will automatically receive a{' '}
              {quote.penaltyDiscountPercent ?? 25}% discount on shipping.
            </p>
            <p className="mt-1 text-gray-500">
              Maximum shipping: {formatPrice(quote.maxShippingCents)}
            </p>
          </div>
        </div>
      )}

      {isPendingBuyer && quote.quotedShippingCents !== null && (
        <div className="space-y-4">
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            <p>
              The seller quoted{' '}
              <span className="font-medium">
                {formatPrice(quote.quotedShippingCents)}
              </span>{' '}
              for combined shipping (saves you{' '}
              {formatPrice(quote.maxShippingCents - quote.quotedShippingCents)}).
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button
              onClick={() => handleAction('ACCEPT')}
              disabled={submitting}
            >
              Accept Quote
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction('DISPUTE')}
              disabled={submitting}
            >
              Dispute Quote
            </Button>
          </div>
        </div>
      )}

      {isPenaltyApplied && (
        <div className="space-y-3">
          <div className="rounded-md bg-orange-50 border border-orange-200 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">
                The seller missed the deadline. You received a{' '}
                {quote.penaltyDiscountPercent ?? 25}% shipping discount.
              </p>
              <p>
                Original: {formatPrice(quote.maxShippingCents)} &rarr; You pay:{' '}
                {formatPrice(penaltyPrice)}
              </p>
              {quote.quotedShippingCents !== null && (
                <p className="mt-1">
                  The seller also quoted{' '}
                  {formatPrice(quote.quotedShippingCents)}. You pay the lower
                  price: {formatPrice(Math.min(quote.quotedShippingCents, penaltyPrice))}.
                </p>
              )}
              {quote.quotedShippingCents === null && (
                <p className="mt-1">
                  Savings: {formatPrice(quote.maxShippingCents - penaltyPrice)}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500">This discount has been automatically applied.</p>
        </div>
      )}

      {isAccepted && quote.finalShippingCents !== null && (
        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm text-green-800">
            <p>
              Combined shipping:{' '}
              <span className="font-medium">
                {formatPrice(quote.finalShippingCents)}
              </span>
              {quote.savingsCents !== null && quote.savingsCents > 0 && (
                <> (saved {formatPrice(quote.savingsCents)})</>
              )}
            </p>
          </div>
        </div>
      )}

      {isDisputed && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Your dispute has been noted. Please contact support for resolution.
          </p>
          <Link
            href={`/my/buying/orders/${orderId}/dispute`}
            className="inline-block"
          >
            <Button variant="outline" size="sm">
              Contact Support
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
