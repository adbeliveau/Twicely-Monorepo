'use client';

import { Label } from '@twicely/ui/label';
import { Checkbox } from '@twicely/ui/checkbox';
import { PriceInput } from './price-input';
import type { ListingFormErrors } from '@/types/listing-form';

interface OffersSectionProps {
  allowOffers: boolean;
  autoAcceptOfferCents: number | null;
  autoDeclineOfferCents: number | null;
  onAllowOffersChange: (checked: boolean) => void;
  onAutoAcceptChange: (cents: number | null) => void;
  onAutoDeclineChange: (cents: number | null) => void;
  errors: ListingFormErrors;
  disabled?: boolean;
}

export function OffersSection({
  allowOffers,
  autoAcceptOfferCents,
  autoDeclineOfferCents,
  onAllowOffersChange,
  onAutoAcceptChange,
  onAutoDeclineChange,
  errors,
  disabled,
}: OffersSectionProps) {
  return (
    <div className="space-y-6">
      {/* Allow Offers */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="allowOffers"
          checked={allowOffers}
          onCheckedChange={(checked) => onAllowOffersChange(checked === true)}
          disabled={disabled}
        />
        <Label htmlFor="allowOffers" className="font-normal">
          Allow Offers
        </Label>
      </div>

      {/* Auto-accept and auto-decline (only shown if allowOffers is true) */}
      {allowOffers && (
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Auto-accept */}
          <div className="space-y-2">
            <Label>Auto-accept above</Label>
            <PriceInput
              value={autoAcceptOfferCents ?? 0}
              onChange={(cents) => onAutoAcceptChange(cents > 0 ? cents : null)}
              placeholder="0.00"
              disabled={disabled}
              error={errors.autoAcceptOffer}
            />
            <p className="text-xs text-muted-foreground">
              Automatically accept offers above this amount
            </p>
          </div>

          {/* Auto-decline */}
          <div className="space-y-2">
            <Label>Auto-decline below</Label>
            <PriceInput
              value={autoDeclineOfferCents ?? 0}
              onChange={(cents) => onAutoDeclineChange(cents > 0 ? cents : null)}
              placeholder="0.00"
              disabled={disabled}
              error={errors.autoDeclineOffer}
            />
            <p className="text-xs text-muted-foreground">
              Automatically decline offers below this amount
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
