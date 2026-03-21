'use client';

import { Label } from '@twicely/ui/label';
import { Input } from '@twicely/ui/input';
import { Switch } from '@twicely/ui/switch';

interface SellerSettingsProps {
  dailySalesSummary: boolean;
  staleListingDays: number | null;
  trustScoreAlerts: boolean;
  onDailySummaryChange: (val: boolean) => void;
  onStaleListingDaysChange: (val: number | null) => void;
  onTrustScoreAlertsChange: (val: boolean) => void;
  disabled: boolean;
}

export function NotificationSellerSettings({
  dailySalesSummary, staleListingDays, trustScoreAlerts,
  onDailySummaryChange, onStaleListingDaysChange, onTrustScoreAlertsChange,
  disabled,
}: SellerSettingsProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Seller Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Additional notification controls for your selling activity.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            id="dailySales"
            checked={dailySalesSummary}
            onCheckedChange={onDailySummaryChange}
            disabled={disabled}
          />
          <Label htmlFor="dailySales">Daily sales summary email</Label>
        </div>

        <div className="space-y-1">
          <Label htmlFor="staleDays">
            Alert me about listings with no sales after
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="staleDays"
              type="number"
              min={1}
              max={365}
              className="w-24"
              value={staleListingDays ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onStaleListingDaysChange(val ? Number(val) : null);
              }}
              placeholder="Off"
              disabled={disabled}
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="trustScore"
            checked={trustScoreAlerts}
            onCheckedChange={onTrustScoreAlertsChange}
            disabled={disabled}
          />
          <Label htmlFor="trustScore">Notify me when my seller score changes</Label>
        </div>
      </div>
    </div>
  );
}
