'use client';

/**
 * AutomationSettingsForm — four-section settings form for automation add-on.
 * Sections: auto-relist, smart price drops, offer-to-likers, Posh sharing.
 * Source: F6 install prompt §B.2.
 */

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { Switch } from '@twicely/ui/switch';
import { Label } from '@twicely/ui/label';
import { Button } from '@twicely/ui/button';
import { updateAutomationSettingsAction } from '@/lib/actions/automation-settings';
import { RiskAcknowledgmentDialog } from './risk-acknowledgment-dialog';
import type { AutomationSettingsWithAccounts } from '@/lib/queries/automation';

type Settings = NonNullable<AutomationSettingsWithAccounts['settings']>;

interface AutomationSettingsFormProps {
  settings: Settings | null;
  hasPoshmarkAccount: boolean;
  connectedChannels: string[];
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled: boolean;
  onChange: (val: number) => void;
}) {
  return (
    <div className="space-y-1.5 py-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-primary"
      />
    </div>
  );
}

export function AutomationSettingsForm({
  settings,
  hasPoshmarkAccount,
}: AutomationSettingsFormProps) {
  const defaults = {
    autoRelistEnabled: settings?.autoRelistEnabled ?? false,
    autoRelistDays: settings?.autoRelistDays ?? 30,
    priceDropEnabled: settings?.priceDropEnabled ?? false,
    priceDropPercent: settings?.priceDropPercent ?? 5,
    priceDropIntervalDays: settings?.priceDropIntervalDays ?? 14,
    priceDropFloorPercent: settings?.priceDropFloorPercent ?? 50,
    offerToLikersEnabled: settings?.offerToLikersEnabled ?? false,
    offerDiscountPercent: settings?.offerDiscountPercent ?? 10,
    offerMinDaysListed: settings?.offerMinDaysListed ?? 7,
    poshShareEnabled: settings?.poshShareEnabled ?? false,
    poshShareTimesPerDay: settings?.poshShareTimesPerDay ?? 3,
  };

  const [form, setForm] = useState(defaults);
  const [showPoshDialog, setShowPoshDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof typeof defaults>(key: K, value: (typeof defaults)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handlePoshToggle(val: boolean) {
    if (val && !form.poshShareEnabled) {
      // First enable: show risk dialog
      setShowPoshDialog(true);
    } else {
      update('poshShareEnabled', val);
    }
  }

  function handlePoshAccepted() {
    setShowPoshDialog(false);
    update('poshShareEnabled', true);
  }

  function handlePoshCanceled() {
    setShowPoshDialog(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateAutomationSettingsAction({
        autoRelistEnabled: form.autoRelistEnabled,
        autoRelistDays: form.autoRelistDays,
        priceDropEnabled: form.priceDropEnabled,
        priceDropPercent: form.priceDropPercent,
        priceDropIntervalDays: form.priceDropIntervalDays,
        priceDropFloorPercent: form.priceDropFloorPercent,
        offerToLikersEnabled: form.offerToLikersEnabled,
        offerDiscountPercent: form.offerDiscountPercent,
        offerMinDaysListed: form.offerMinDaysListed,
        poshShareEnabled: form.poshShareEnabled,
        poshShareTimesPerDay: form.poshShareTimesPerDay,
      });
      if (!result.success) {
        setError(result.error ?? 'Failed to save settings.');
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Auto-Relist */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Auto-Relist</CardTitle>
            <Switch
              checked={form.autoRelistEnabled}
              onCheckedChange={(v) => update('autoRelistEnabled', v)}
              aria-label="Enable auto-relist"
            />
          </div>
          <CardDescription>End and relist stale listings to refresh search ranking.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <SliderRow
            label="Relist listings older than"
            value={form.autoRelistDays}
            min={7}
            max={90}
            unit=" days"
            disabled={!form.autoRelistEnabled}
            onChange={(v) => update('autoRelistDays', v)}
          />
        </CardContent>
      </Card>

      {/* Smart Price Drops */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Smart Price Drops</CardTitle>
            <Switch
              checked={form.priceDropEnabled}
              onCheckedChange={(v) => update('priceDropEnabled', v)}
              aria-label="Enable smart price drops"
            />
          </div>
          <CardDescription>Scheduled price reductions to re-engage potential buyers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <SliderRow
            label="Drop price by"
            value={form.priceDropPercent}
            min={1}
            max={50}
            unit="%"
            disabled={!form.priceDropEnabled}
            onChange={(v) => update('priceDropPercent', v)}
          />
          <SliderRow
            label="Drop every"
            value={form.priceDropIntervalDays}
            min={1}
            max={90}
            unit=" days"
            disabled={!form.priceDropEnabled}
            onChange={(v) => update('priceDropIntervalDays', v)}
          />
          <SliderRow
            label="Never drop below"
            value={form.priceDropFloorPercent}
            min={10}
            max={90}
            unit="% of original"
            disabled={!form.priceDropEnabled}
            onChange={(v) => update('priceDropFloorPercent', v)}
          />
        </CardContent>
      </Card>

      {/* Offer to Likers */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Offer to Likers</CardTitle>
            <Switch
              checked={form.offerToLikersEnabled}
              onCheckedChange={(v) => update('offerToLikersEnabled', v)}
              aria-label="Enable offer to likers"
            />
          </div>
          <CardDescription>Send automatic discounted offers to interested buyers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <SliderRow
            label="Offer discount"
            value={form.offerDiscountPercent}
            min={1}
            max={50}
            unit="%"
            disabled={!form.offerToLikersEnabled}
            onChange={(v) => update('offerDiscountPercent', v)}
          />
          <SliderRow
            label="Only listings listed for at least"
            value={form.offerMinDaysListed}
            min={1}
            max={90}
            unit=" days"
            disabled={!form.offerToLikersEnabled}
            onChange={(v) => update('offerMinDaysListed', v)}
          />
        </CardContent>
      </Card>

      {/* Posh Sharing — only visible if Poshmark connected */}
      {hasPoshmarkAccount && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Posh Sharing</CardTitle>
              <Switch
                checked={form.poshShareEnabled}
                onCheckedChange={handlePoshToggle}
                aria-label="Enable Posh sharing"
              />
            </div>
            <CardDescription>Share your Poshmark closet listings throughout the day.</CardDescription>
          </CardHeader>
          <CardContent>
            <SliderRow
              label="Shares per day"
              value={form.poshShareTimesPerDay}
              min={1}
              max={10}
              disabled={!form.poshShareEnabled}
              onChange={(v) => update('poshShareTimesPerDay', v)}
            />
          </CardContent>
        </Card>
      )}

      {/* Save controls */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Settings'}
        </Button>
        {saved && <span className="text-sm text-green-600">Settings saved.</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      {/* Poshmark risk dialog */}
      <RiskAcknowledgmentDialog
        open={showPoshDialog}
        onAccept={handlePoshAccepted}
        onCancel={handlePoshCanceled}
      />

      {/* Hidden label for accessibility */}
      <Label className="sr-only">Automation settings</Label>
    </div>
  );
}
