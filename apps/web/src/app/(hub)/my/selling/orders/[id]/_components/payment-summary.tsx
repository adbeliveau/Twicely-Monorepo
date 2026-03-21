import { formatPrice } from '@twicely/utils/format';

interface PaymentSummaryProps {
  itemSubtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  tfAmountCents: number | null;
  stripeFeesCents: number | null;
}

export function PaymentSummary({
  itemSubtotalCents,
  shippingCents,
  taxCents,
  totalCents,
  tfAmountCents,
  stripeFeesCents,
}: PaymentSummaryProps) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="font-semibold mb-4">Payment Summary</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span>{formatPrice(itemSubtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Shipping</span>
          <span>
            {shippingCents === 0 ? 'Free' : formatPrice(shippingCents)}
          </span>
        </div>
        {taxCents > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Tax</span>
            <span>{formatPrice(taxCents)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t font-semibold text-base">
          <span>Total</span>
          <span>{formatPrice(totalCents)}</span>
        </div>
      </div>

      {/* v3.2 Payout UX Language: Fee breakdown per Canonical §3.3 */}
      {(tfAmountCents !== null || stripeFeesCents !== null) && (
        <div className="mt-4 pt-4 border-t space-y-2 text-sm">
          <h3 className="font-medium text-gray-900">Fee Breakdown</h3>
          {tfAmountCents !== null && (
            <div className="flex justify-between">
              <span className="text-gray-600">Twicely fees</span>
              <span className="text-red-600">-{formatPrice(tfAmountCents)}</span>
            </div>
          )}
          {stripeFeesCents !== null && (
            <div className="flex justify-between">
              <span className="text-gray-600">Payment processing fee</span>
              <span className="text-red-600">-{formatPrice(stripeFeesCents)}</span>
            </div>
          )}
          {tfAmountCents !== null && stripeFeesCents !== null && (
            <div className="flex justify-between pt-2 border-t font-medium">
              <span className="text-gray-900">Net earnings</span>
              <span className="text-green-600">
                {formatPrice(totalCents - tfAmountCents - stripeFeesCents)}
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Funds are processed and paid out through Stripe. Twicely displays payout status and transaction activity.
          </p>
        </div>
      )}
    </div>
  );
}
