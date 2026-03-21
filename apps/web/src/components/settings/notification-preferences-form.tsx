'use client';

import { useState, useTransition } from 'react';
import { updatePreferences } from '@/lib/actions/notifications';
import { updateNotificationSettings } from '@/lib/actions/notification-settings';
import { NotificationDigestSettings } from './notification-digest-settings';
import { NotificationQuietHours } from './notification-quiet-hours';
import { NotificationSellerSettings } from './notification-seller-settings';
import { Switch } from '@twicely/ui/switch';
import { Label } from '@twicely/ui/label';
import type { NotificationPreferenceSummary } from '@/lib/queries/notifications';
import type { NotificationSettingsSummary } from '@/lib/queries/notification-settings';
import type { TemplateKey } from '@twicely/notifications/templates';

interface NotificationPreferencesFormProps {
  groupedPrefs: Record<string, NotificationPreferenceSummary[]>;
  notificationSettings: NotificationSettingsSummary;
  isSeller: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  offers: 'Offers',
  orders: 'Orders',
};

export function NotificationPreferencesForm({
  groupedPrefs, notificationSettings, isSeller,
}: NotificationPreferencesFormProps) {
  const [isPending, startTransition] = useTransition();
  const [prefs, setPrefs] = useState(groupedPrefs);
  const [settings, setSettings] = useState(notificationSettings);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleToggle = (category: string, templateKey: TemplateKey, channel: 'email' | 'inApp') => {
    setPrefs((prev) => {
      const categoryPrefs = prev[category];
      if (!categoryPrefs) return prev;
      return { ...prev, [category]: categoryPrefs.map((p) =>
        p.templateKey === templateKey ? { ...p, [channel]: !p[channel] } : p
      )};
    });
  };

  const handleSave = () => {
    setMessage('');
    setError('');

    const allPrefs = Object.values(prefs).flat().map((p) => ({
      templateKey: p.templateKey, email: p.email, inApp: p.inApp,
    }));

    startTransition(async () => {
      const [prefResult, settingsResult] = await Promise.all([
        updatePreferences(allPrefs),
        updateNotificationSettings(settings),
      ]);
      if (prefResult.success && settingsResult.success) {
        setMessage('Settings saved successfully');
      } else {
        setError(prefResult.error ?? settingsResult.error ?? 'Failed to save');
      }
    });
  };

  return (
    <div className="space-y-6">
      {message && <div className="bg-green-50 text-green-600 p-3 rounded text-sm">{message}</div>}
      {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}

      <NotificationDigestSettings
        digestFrequency={settings.digestFrequency}
        digestTimeUtc={settings.digestTimeUtc}
        timezone={settings.timezone}
        onFrequencyChange={(f) => setSettings((s) => ({ ...s, digestFrequency: f }))}
        onTimeChange={(t) => setSettings((s) => ({ ...s, digestTimeUtc: t }))}
        onTimezoneChange={(tz) => setSettings((s) => ({ ...s, timezone: tz }))}
        disabled={isPending}
      />

      <NotificationQuietHours
        enabled={settings.quietHoursEnabled}
        start={settings.quietHoursStart}
        end={settings.quietHoursEnd}
        onEnabledChange={(e) => setSettings((s) => ({ ...s, quietHoursEnabled: e }))}
        onStartChange={(t) => setSettings((s) => ({ ...s, quietHoursStart: t }))}
        onEndChange={(t) => setSettings((s) => ({ ...s, quietHoursEnd: t }))}
        disabled={isPending}
      />

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Marketing</h2>
          <p className="text-sm text-muted-foreground">
            Promotional offers, platform news, and feature announcements.
            You can unsubscribe at any time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="marketing"
            checked={settings.marketingOptIn}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, marketingOptIn: v }))}
            disabled={isPending}
          />
          <Label htmlFor="marketing">Receive marketing emails from Twicely</Label>
        </div>
      </div>

      {isSeller && (
        <NotificationSellerSettings
          dailySalesSummary={settings.dailySalesSummary}
          staleListingDays={settings.staleListingDays}
          trustScoreAlerts={settings.trustScoreAlerts}
          onDailySummaryChange={(v) => setSettings((s) => ({ ...s, dailySalesSummary: v }))}
          onStaleListingDaysChange={(v) => setSettings((s) => ({ ...s, staleListingDays: v }))}
          onTrustScoreAlertsChange={(v) => setSettings((s) => ({ ...s, trustScoreAlerts: v }))}
          disabled={isPending}
        />
      )}

      {Object.entries(prefs).map(([category, items]) => (
        <div key={category} className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">{CATEGORY_LABELS[category] ?? category}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_80px_80px] gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
              <span>Notification</span>
              <span className="text-center">Email</span>
              <span className="text-center">In-App</span>
            </div>
            {items.map((pref) => (
              <div key={pref.templateKey} className="grid grid-cols-[1fr_80px_80px] gap-4 items-center">
                <span className="text-sm">{pref.name}</span>
                <div className="flex justify-center">
                  <input
                    type="checkbox" checked={pref.email}
                    onChange={() => handleToggle(category, pref.templateKey, 'email')}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                    disabled={isPending}
                  />
                </div>
                <div className="flex justify-center">
                  <input
                    type="checkbox" checked={pref.inApp}
                    onChange={() => handleToggle(category, pref.templateKey, 'inApp')}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                    disabled={isPending}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSave} disabled={isPending}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
