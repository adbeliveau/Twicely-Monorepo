'use client';

import { RadioGroup, RadioGroupItem } from '@twicely/ui/radio-group';
import { Label } from '@twicely/ui/label';
import { Checkbox } from '@twicely/ui/checkbox';
import { Package, MapPin, AlertTriangle } from 'lucide-react';
import { formatPrice } from '@twicely/utils/format';
import { HANDLING_FLAG_LABELS } from '@/lib/local/handling-flags';
import type { LocalHandlingFlag } from '@/lib/local/handling-flags';

type FulfillmentType = 'SHIP_ONLY' | 'LOCAL_ONLY' | 'SHIP_AND_LOCAL';
type FulfillmentChoice = 'shipping' | 'local_pickup';

interface FulfillmentSelectorProps {
  /** The listing's fulfillment type */
  fulfillmentType: FulfillmentType;
  /** Current selection */
  selected: FulfillmentChoice;
  /** Callback when selection changes */
  onSelect: (choice: FulfillmentChoice) => void;
  /** Shipping cost in cents (for display) */
  shippingCents: number;
  /** Item subtotal in cents (for local fee calculation display) */
  itemSubtotalCents: number;
  /** Local fee rate in basis points (default: 500 = 5%) — passed from server */
  localFeeRateBps?: number;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Handling flags set on the listing (optional) */
  localHandlingFlags?: string[];
  /** Whether buyer has acknowledged the handling flags */
  handlingFlagsAcknowledged?: boolean;
  /** Callback when buyer acknowledges handling flags */
  onHandlingFlagsAcknowledge?: (acknowledged: boolean) => void;
}

/**
 * Fulfillment type selector for checkout (B3.4 + A15).
 *
 * Shown when listing supports both shipping and local pickup (SHIP_AND_LOCAL).
 * For SHIP_ONLY or LOCAL_ONLY listings, no selector is shown.
 *
 * Local pickup:
 * - No shipping fee
 * - 5% flat transaction fee (shown as "local fee")
 * - Buyer protection via QR escrow
 * - If seller set handling flags, buyer must acknowledge before proceeding
 */
export function FulfillmentSelector({
  fulfillmentType,
  selected,
  onSelect,
  shippingCents,
  itemSubtotalCents,
  localFeeRateBps = 500,
  disabled = false,
  localHandlingFlags = [],
  handlingFlagsAcknowledged = false,
  onHandlingFlagsAcknowledge,
}: FulfillmentSelectorProps) {
  // Only show selector for SHIP_AND_LOCAL listings
  if (fulfillmentType !== 'SHIP_AND_LOCAL') {
    return null;
  }

  // Calculate local fee from server-provided rate (no minimum for local)
  const localFeeCents = Math.round(itemSubtotalCents * localFeeRateBps / 10000);

  const showFlagsWarning = selected === 'local_pickup' && localHandlingFlags.length > 0;

  return (
    <div className="rounded-lg border bg-white p-4 space-y-4">
      <h3 className="font-medium">Delivery Method</h3>
      <RadioGroup
        value={selected}
        onValueChange={(v) => onSelect(v as FulfillmentChoice)}
        disabled={disabled}
        className="space-y-3"
      >
        <div
          className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
            selected === 'shipping'
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => !disabled && onSelect('shipping')}
        >
          <RadioGroupItem value="shipping" id="shipping" className="mt-1" />
          <div className="flex-1">
            <Label htmlFor="shipping" className="flex items-center gap-2 cursor-pointer">
              <Package className="h-4 w-4" />
              <span className="font-medium">Ship to me</span>
              <span className="ml-auto text-sm">
                {shippingCents === 0 ? (
                  <span className="text-green-600 font-medium">Free</span>
                ) : (
                  formatPrice(shippingCents)
                )}
              </span>
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Standard shipping to your address
            </p>
          </div>
        </div>

        <div
          className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
            selected === 'local_pickup'
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => !disabled && onSelect('local_pickup')}
        >
          <RadioGroupItem value="local_pickup" id="local_pickup" className="mt-1" />
          <div className="flex-1">
            <Label htmlFor="local_pickup" className="flex items-center gap-2 cursor-pointer">
              <MapPin className="h-4 w-4" />
              <span className="font-medium">Local pickup</span>
              <span className="ml-auto text-sm">
                <span className="text-green-600 font-medium">No shipping</span>
              </span>
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Meet the seller locally. {formatPrice(localFeeCents)} local fee applies.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Protected by Twicely Buyer Protection
            </p>
          </div>
        </div>
      </RadioGroup>

      {showFlagsWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
          <p className="text-sm font-medium text-amber-900">Pickup Requirements</p>
          <ul className="space-y-1">
            {localHandlingFlags.map((flag) => (
              <li key={flag} className="text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {HANDLING_FLAG_LABELS[flag as LocalHandlingFlag] ?? flag}
              </li>
            ))}
          </ul>
          {onHandlingFlagsAcknowledge && (
            <div className="flex items-start space-x-2">
              <Checkbox
                id="flags-acknowledge"
                checked={handlingFlagsAcknowledged}
                onCheckedChange={(checked) => onHandlingFlagsAcknowledge(checked === true)}
                disabled={disabled}
              />
              <Label
                htmlFor="flags-acknowledge"
                className="text-sm font-normal leading-snug cursor-pointer text-amber-900"
              >
                I understand and can meet these requirements
              </Label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
