'use client';

/**
 * D2.4: Boost Controls Component
 * UI for activating, deactivating, and updating boost rate on a listing.
 */

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { formatPrice } from '@twicely/utils/format';
import { activateBoost, deactivateBoost, updateBoostRate } from '@/lib/actions/boosting';
import { calculateBoostFee } from '@twicely/commerce/boosting';
import { Loader2, Rocket, X } from 'lucide-react';

interface BoostControlsProps {
  listingId: string;
  currentBoostPercent: number | null;
  isActive: boolean;
  /** Minimum boost rate percentage (from platform_settings) */
  minRate: number;
  /** Maximum boost rate percentage (from platform_settings) */
  maxRate: number;
}

export function BoostControls({
  listingId,
  currentBoostPercent,
  isActive,
  minRate,
  maxRate,
}: BoostControlsProps) {
  const [rate, setRate] = useState<number>(currentBoostPercent ?? minRate);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  const isBoosted = isActive && currentBoostPercent !== null;

  // Example fee calculation for $100 sale
  const exampleFeeCents = calculateBoostFee(10000, rate);

  function handleRateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setRate(Math.min(maxRate, Math.max(minRate, val)));
    }
  }

  async function handleActivate() {
    setError(null);
    startTransition(async () => {
      const result = await activateBoost({ listingId, boostPercent: rate });
      if (!result.success) {
        setError(result.error ?? 'Failed to activate boost');
      }
    });
  }

  async function handleDeactivate() {
    setError(null);
    startTransition(async () => {
      const result = await deactivateBoost({ listingId });
      if (!result.success) {
        setError(result.error ?? 'Failed to deactivate boost');
      }
    });
  }

  async function handleUpdateRate() {
    setError(null);
    startTransition(async () => {
      const result = await updateBoostRate({ listingId, boostPercent: rate });
      if (!result.success) {
        setError(result.error ?? 'Failed to update boost rate');
      } else {
        setShowUpdateForm(false);
      }
    });
  }

  if (isBoosted && !showUpdateForm) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-600">Boosted at {currentBoostPercent}%</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowUpdateForm(true)} disabled={isPending}>
            Update Rate
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeactivate} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
            Stop Boosting
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4" />
        <span className="font-medium">{isBoosted ? 'Update Boost Rate' : 'Boost this listing'}</span>
      </div>

      <div className="space-y-2">
        <label className="flex items-center justify-between text-sm">
          <span>Boost rate ({minRate}-{maxRate}%)</span>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={minRate}
              max={maxRate}
              step={1}
              value={rate}
              onChange={handleRateChange}
              disabled={isPending}
              className="w-16 h-8 text-center"
            />
            <span>%</span>
          </div>
        </label>
        <p className="text-xs text-muted-foreground">
          At {rate}% boost, you&apos;ll pay {formatPrice(exampleFeeCents)} on a $100 sale
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        {isBoosted ? (
          <>
            <Button onClick={handleUpdateRate} disabled={isPending || rate === currentBoostPercent} size="sm">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Rate
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowUpdateForm(false)} disabled={isPending}>
              Cancel
            </Button>
          </>
        ) : (
          <Button onClick={handleActivate} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Rocket className="mr-2 h-4 w-4" />
            Activate Boost
          </Button>
        )}
      </div>
    </div>
  );
}
