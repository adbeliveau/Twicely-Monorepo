'use client';

import { Label } from '@twicely/ui/label';
import { Input } from '@twicely/ui/input';
import { Switch } from '@twicely/ui/switch';

interface QuietHoursProps {
  enabled: boolean;
  start: string | null;
  end: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onStartChange: (time: string) => void;
  onEndChange: (time: string) => void;
  disabled: boolean;
}

export function NotificationQuietHours({
  enabled, start, end,
  onEnabledChange, onStartChange, onEndChange, disabled,
}: QuietHoursProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Quiet Hours</h2>
        <p className="text-sm text-muted-foreground">
          During quiet hours, push notifications and SMS will be paused.
          Critical alerts (security, orders) always come through.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="quietHoursEnabled"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
        />
        <Label htmlFor="quietHoursEnabled">Enable quiet hours</Label>
      </div>

      {enabled && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="quietStart">Start Time</Label>
            <Input
              id="quietStart"
              type="time"
              value={start ?? '22:00'}
              onChange={(e) => onStartChange(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="quietEnd">End Time</Label>
            <Input
              id="quietEnd"
              type="time"
              value={end ?? '08:00'}
              onChange={(e) => onEndChange(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}
