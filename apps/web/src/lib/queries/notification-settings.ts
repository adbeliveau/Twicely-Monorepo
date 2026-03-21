import { db } from '@twicely/db';
import { notificationSetting, user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from './platform-settings';

export interface NotificationSettingsSummary {
  digestFrequency: 'daily' | 'weekly';
  digestTimeUtc: string;
  timezone: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  marketingOptIn: boolean;
  // Seller-only fields
  dailySalesSummary: boolean;
  staleListingDays: number | null;
  trustScoreAlerts: boolean;
}

/**
 * Get notification settings for a user.
 * If no row exists, returns defaults read from platform settings.
 * Also includes marketingOptIn from the user table.
 */
export async function getNotificationSettings(
  userId: string
): Promise<NotificationSettingsSummary> {
  const [settingRow] = await db
    .select({
      digestFrequency: notificationSetting.digestFrequency,
      digestTimeUtc: notificationSetting.digestTimeUtc,
      timezone: notificationSetting.timezone,
      quietHoursEnabled: notificationSetting.quietHoursEnabled,
      quietHoursStart: notificationSetting.quietHoursStart,
      quietHoursEnd: notificationSetting.quietHoursEnd,
      dailySalesSummary: notificationSetting.dailySalesSummary,
      staleListingDays: notificationSetting.staleListingDays,
      trustScoreAlerts: notificationSetting.trustScoreAlerts,
    })
    .from(notificationSetting)
    .where(eq(notificationSetting.userId, userId))
    .limit(1);

  const [userRow] = await db
    .select({ marketingOptIn: user.marketingOptIn })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const marketingOptIn = userRow?.marketingOptIn ?? false;

  if (settingRow) {
    return {
      digestFrequency: (settingRow.digestFrequency as 'daily' | 'weekly'),
      digestTimeUtc: settingRow.digestTimeUtc,
      timezone: settingRow.timezone,
      quietHoursEnabled: settingRow.quietHoursEnabled,
      quietHoursStart: settingRow.quietHoursStart ?? null,
      quietHoursEnd: settingRow.quietHoursEnd ?? null,
      marketingOptIn,
      dailySalesSummary: settingRow.dailySalesSummary,
      staleListingDays: settingRow.staleListingDays ?? null,
      trustScoreAlerts: settingRow.trustScoreAlerts,
    };
  }

  // No row — return platform-setting defaults
  const defaultFrequency = await getPlatformSetting<string>('comms.digest.frequency', 'daily');
  const defaultTimeUtc = await getPlatformSetting<string>('comms.digest.timeUtc', '14:00');

  return {
    digestFrequency: (defaultFrequency as 'daily' | 'weekly'),
    digestTimeUtc: defaultTimeUtc,
    timezone: 'America/New_York',
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    marketingOptIn,
    dailySalesSummary: false,
    staleListingDays: null,
    trustScoreAlerts: false,
  };
}
