'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Label } from '@twicely/ui/label';
import { Switch } from '@twicely/ui/switch';
import { Input } from '@twicely/ui/input';
import { Button } from '@twicely/ui/button';
import { updateAffiliateOptIn, updateAffiliateCommissionRate } from '@/lib/actions/affiliate-seller-settings';

interface SellerAffiliateSettingsProps {
  initialOptIn: boolean;
  initialCommissionBps: number | null;
  platformDefaultBps: number;
  minBps: number;
  maxBps: number;
}

export function SellerAffiliateSettings({
  initialOptIn,
  initialCommissionBps,
  platformDefaultBps,
  minBps,
  maxBps,
}: SellerAffiliateSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [optIn, setOptIn] = useState(initialOptIn);
  const [rateInput, setRateInput] = useState(
    initialCommissionBps !== null ? String(initialCommissionBps / 100) : '',
  );

  const defaultPercent = (platformDefaultBps / 100).toFixed(1);
  const minPercent = (minBps / 100).toFixed(0);
  const maxPercent = (maxBps / 100).toFixed(0);

  function handleOptInChange(checked: boolean) {
    setOptIn(checked);
    startTransition(async () => {
      const result = await updateAffiliateOptIn({ optIn: checked });
      if (!result.success) {
        setOptIn(!checked);
        toast.error('Error', { description: result.error });
      } else {
        toast.success(checked ? 'Affiliate commissions enabled' : 'Affiliate commissions disabled');
      }
    });
  }

  function handleRateSave() {
    const numericStr = rateInput.trim();
    let commissionBps: number | null = null;

    if (numericStr !== '') {
      const percent = parseFloat(numericStr);
      if (isNaN(percent)) {
        toast.error('Invalid rate', { description: 'Enter a number between 2 and 10' });
        return;
      }
      commissionBps = Math.round(percent * 100);
    }

    startTransition(async () => {
      const result = await updateAffiliateCommissionRate({ commissionBps });
      if (!result.success) {
        toast.error('Error', { description: result.error });
      } else {
        toast.success('Commission rate saved');
      }
    });
  }

  return (
    <div className="space-y-6 rounded-lg border p-4">
      <div>
        <h2 className="text-base font-semibold">Affiliate Commission Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Affiliates with large audiences can promote your listings. You pay a commission only
          when a sale happens through their link.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="affiliate-opt-in" className="cursor-pointer">
          Allow affiliates to earn commission on my listings
        </Label>
        <Switch
          id="affiliate-opt-in"
          checked={optIn}
          onCheckedChange={handleOptInChange}
          disabled={isPending}
        />
      </div>

      {optIn && (
        <div className="space-y-2">
          <Label htmlFor="commission-rate">
            Custom commission rate (%)
          </Label>
          <p className="text-xs text-muted-foreground">
            Leave blank to use the platform default ({defaultPercent}%).
            Sellers can set between {minPercent}% and {maxPercent}%.
          </p>
          <div className="flex gap-2">
            <Input
              id="commission-rate"
              type="number"
              min={Number(minPercent)}
              max={Number(maxPercent)}
              step="0.1"
              placeholder={`Default: ${defaultPercent}%`}
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              className="w-36"
              disabled={isPending}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRateSave}
              disabled={isPending}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
