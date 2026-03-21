'use client';

import { useState, useTransition } from 'react';
import { Switch } from '@twicely/ui/switch';
import { Input } from '@twicely/ui/input';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { updateSellerLocalSettings } from '@/lib/actions/seller-local-settings';

interface SellerLocalSettingsFormProps {
  /** Current value from sellerProfile.maxMeetupDistanceMiles (null = disabled) */
  currentDistanceMiles: number | null;
  defaultRadiusMiles: number;
  maxRadiusMiles: number;
}

/**
 * Form for seller to configure local pickup settings.
 * Toggle enables/disables; distance input sets max radius.
 */
export function SellerLocalSettingsForm({
  currentDistanceMiles,
  defaultRadiusMiles,
  maxRadiusMiles,
}: SellerLocalSettingsFormProps) {
  const [enabled, setEnabled] = useState(currentDistanceMiles !== null);
  const [distance, setDistance] = useState(
    currentDistanceMiles ?? defaultRadiusMiles
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    setEnabled(checked);
    setError(null);
    setSaved(false);
  }

  function handleDistanceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setDistance(val);
    }
    setError(null);
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (enabled) {
      if (distance < 1 || distance > maxRadiusMiles) {
        setError(`Distance must be between 1 and ${maxRadiusMiles} miles`);
        return;
      }
    }

    startTransition(async () => {
      const result = await updateSellerLocalSettings({
        maxMeetupDistanceMiles: enabled ? distance : null,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to save settings');
      } else {
        setSaved(true);
        setError(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Local Pickup Settings</CardTitle>
        <CardDescription>
          When enabled, buyers within your radius can choose local pickup instead of shipping.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="local-enabled" className="text-sm font-medium">
              Enable local pickup for my listings
            </Label>
            <Switch
              id="local-enabled"
              checked={enabled}
              onCheckedChange={handleToggle}
            />
          </div>

          {/* Distance input */}
          <div className="space-y-2">
            <Label
              htmlFor="max-distance"
              className={enabled ? 'text-sm font-medium' : 'text-sm font-medium text-muted-foreground'}
            >
              Maximum meetup distance (miles)
            </Label>
            <Input
              id="max-distance"
              type="number"
              min={1}
              max={maxRadiusMiles}
              value={distance}
              onChange={handleDistanceChange}
              disabled={!enabled}
              className="w-32"
              aria-describedby={error ? 'distance-error' : undefined}
            />
            <p className="text-xs text-muted-foreground">
              Platform default: {defaultRadiusMiles} miles. Maximum: {maxRadiusMiles} miles.
            </p>
          </div>

          {error && (
            <p id="distance-error" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {saved && !error && (
            <p className="text-sm text-green-600">Settings saved.</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
