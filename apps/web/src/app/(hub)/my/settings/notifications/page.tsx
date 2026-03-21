import { redirect } from 'next/navigation';
import { authorize } from '@twicely/casl/authorize';
import { getNotificationPreferences } from '@/lib/queries/notifications';
import { getNotificationSettings } from '@/lib/queries/notification-settings';
import { NotificationPreferencesForm } from '@/components/settings/notification-preferences-form';

export const metadata = {
  title: 'Notifications | Twicely',
};

export default async function NotificationSettingsPage() {
  const { session } = await authorize();
  if (!session) {
    redirect('/auth/login?callbackUrl=/my/settings/notifications');
  }

  const [preferences, settings] = await Promise.all([
    getNotificationPreferences(session.userId),
    getNotificationSettings(session.userId),
  ]);

  const groupedPrefs: Record<string, typeof preferences> = {};
  for (const pref of preferences) {
    const arr = groupedPrefs[pref.category] ?? (groupedPrefs[pref.category] = []);
    arr.push(pref);
  }

  const isSeller = session.isSeller;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Notification Settings</h1>
      <p className="text-muted-foreground mb-6">
        Choose how you want to be notified about activity on your account.
      </p>

      <NotificationPreferencesForm
        groupedPrefs={groupedPrefs}
        notificationSettings={settings}
        isSeller={isSeller}
      />
    </div>
  );
}
