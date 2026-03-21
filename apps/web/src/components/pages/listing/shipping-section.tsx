'use client';

import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Checkbox } from '@twicely/ui/checkbox';
import type { ListingFormErrors } from '@/types/listing-form';

interface ShippingSectionProps {
  freeShipping: boolean;
  shippingCents: number;
  weightOz: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  onFreeShippingChange: (checked: boolean) => void;
  onShippingCentsChange: (value: number) => void;
  onWeightChange: (value: number | null) => void;
  onLengthChange: (value: number | null) => void;
  onWidthChange: (value: number | null) => void;
  onHeightChange: (value: number | null) => void;
  errors: ListingFormErrors;
  disabled?: boolean;
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

export function ShippingSection({
  freeShipping,
  shippingCents,
  weightOz,
  lengthIn,
  widthIn,
  heightIn,
  onFreeShippingChange,
  onShippingCentsChange,
  onWeightChange,
  onLengthChange,
  onWidthChange,
  onHeightChange,
  errors,
  disabled,
}: ShippingSectionProps) {
  return (
    <div className="space-y-6">
      {/* Free Shipping */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="freeShipping"
          checked={freeShipping}
          onCheckedChange={(checked) => onFreeShippingChange(checked === true)}
          disabled={disabled}
        />
        <Label htmlFor="freeShipping" className="font-normal">
          Free Shipping
        </Label>
      </div>

      {/* Shipping Price (shown when not free) */}
      {!freeShipping && (
        <div className="space-y-2">
          <Label htmlFor="shippingPrice">Shipping Price ($)</Label>
          <Input
            id="shippingPrice"
            type="number"
            min="0"
            step="0.01"
            value={shippingCents ? (shippingCents / 100).toFixed(2) : ''}
            onChange={(e) => {
              const dollars = parseFloat(e.target.value);
              onShippingCentsChange(isNaN(dollars) ? 0 : Math.round(dollars * 100));
            }}
            placeholder="0.00"
            disabled={disabled}
            className={errors.shippingCents ? 'border-destructive' : ''}
          />
          {errors.shippingCents && <p className="text-sm text-destructive">{errors.shippingCents}</p>}
        </div>
      )}

      {/* Weight */}
      <div className="space-y-2">
        <Label htmlFor="weight">Weight (oz)</Label>
        <Input
          id="weight"
          type="number"
          min="0"
          step="0.1"
          value={weightOz ?? ''}
          onChange={(e) => onWeightChange(parseNumber(e.target.value))}
          placeholder="0"
          disabled={disabled}
          className={errors.weight ? 'border-destructive' : ''}
        />
        {errors.weight && <p className="text-sm text-destructive">{errors.weight}</p>}
      </div>

      {/* Dimensions */}
      <div className="space-y-2">
        <Label>Dimensions (inches)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            step="0.1"
            value={lengthIn ?? ''}
            onChange={(e) => onLengthChange(parseNumber(e.target.value))}
            placeholder="L"
            disabled={disabled}
            className={errors.dimensions ? 'border-destructive' : ''}
          />
          <span className="text-muted-foreground">×</span>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={widthIn ?? ''}
            onChange={(e) => onWidthChange(parseNumber(e.target.value))}
            placeholder="W"
            disabled={disabled}
            className={errors.dimensions ? 'border-destructive' : ''}
          />
          <span className="text-muted-foreground">×</span>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={heightIn ?? ''}
            onChange={(e) => onHeightChange(parseNumber(e.target.value))}
            placeholder="H"
            disabled={disabled}
            className={errors.dimensions ? 'border-destructive' : ''}
          />
        </div>
        {errors.dimensions && <p className="text-sm text-destructive">{errors.dimensions}</p>}
      </div>
    </div>
  );
}
