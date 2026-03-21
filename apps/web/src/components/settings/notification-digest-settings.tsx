'use client';

import { Label } from '@twicely/ui/label';
import { Input } from '@twicely/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@twicely/ui/select';

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Phoenix',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
];

interface DigestSettingsProps {
  digestFrequency: 'daily' | 'weekly';
  digestTimeUtc: string;
  timezone: string;
  onFrequencyChange: (freq: 'daily' | 'weekly') => void;
  onTimeChange: (time: string) => void;
  onTimezoneChange: (tz: string) => void;
  disabled: boolean;
}

export function NotificationDigestSettings({
  digestFrequency, digestTimeUtc, timezone,
  onFrequencyChange, onTimeChange, onTimezoneChange, disabled,
}: DigestSettingsProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Digest Settings</h2>
        <p className="text-sm text-muted-foreground">
          Informational notifications (price drops, new matches, promotions) will be
          grouped into a single email sent at your chosen time.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Frequency</Label>
          <Select
            value={digestFrequency}
            onValueChange={(v) => onFrequencyChange(v as 'daily' | 'weekly')}
            disabled={disabled}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="digestTime">Digest Time (UTC)</Label>
          <Input
            id="digestTime"
            type="time"
            value={digestTimeUtc}
            onChange={(e) => onTimeChange(e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1">
          <Label>Timezone</Label>
          <Select value={timezone} onValueChange={onTimezoneChange} disabled={disabled}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
