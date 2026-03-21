'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { updateAffiliateCommissionRate } from '@/lib/actions/affiliate-commission-admin';

interface Props {
  affiliateId: string;
  currentRateBps: number;
  tier: string;
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

export function AffiliateCommissionRateEditor({ affiliateId, currentRateBps, tier }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(currentRateBps));
  const [error, setError] = useState<string | null>(null);
  const [displayRateBps, setDisplayRateBps] = useState(currentRateBps);
  const [success, setSuccess] = useState(false);

  const minBps = tier === 'INFLUENCER' ? 2000 : 100;
  const maxBps = tier === 'INFLUENCER' ? 3000 : 5000;

  function handleEdit() {
    setInputValue(String(displayRateBps));
    setError(null);
    setSuccess(false);
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setError(null);
  }

  function handleSave() {
    setError(null);
    const bps = parseInt(inputValue, 10);
    if (isNaN(bps) || bps < minBps || bps > maxBps) {
      setError(`Rate must be between ${minBps} and ${maxBps} bps (${formatBps(minBps)} – ${formatBps(maxBps)})`);
      return;
    }

    startTransition(async () => {
      const result = await updateAffiliateCommissionRate({ affiliateId, commissionRateBps: bps });
      if (result.success) {
        setDisplayRateBps(bps);
        setIsEditing(false);
        setSuccess(true);
      } else {
        setError(result.error ?? 'Failed to update commission rate');
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {!isEditing ? (
        <>
          <span className="text-sm font-medium">{formatBps(displayRateBps)}</span>
          {success && (
            <span className="text-xs text-green-600">Updated</span>
          )}
          <Button variant="outline" size="sm" onClick={handleEdit}>
            Edit Rate
          </Button>
        </>
      ) : (
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="rateInput" className="text-xs">
              Commission rate (bps) — {minBps}–{maxBps}
            </Label>
            <Input
              id="rateInput"
              type="number"
              min={minBps}
              max={maxBps}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="mt-1 w-28"
              disabled={isPending}
            />
            {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
