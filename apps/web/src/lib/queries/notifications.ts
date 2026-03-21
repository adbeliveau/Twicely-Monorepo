import { db } from '@twicely/db';
import { notification, notificationPreference } from '@twicely/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { TEMPLATES, type TemplateKey } from '@twicely/notifications/templates';

export interface NotificationSummary {
  id: string;
  templateKey: string;
  subject: string | null;
  body: string;
  isRead: boolean;
  createdAt: Date;
  dataJson: Record<string, unknown>;
}

export interface NotificationPreferenceSummary {
  templateKey: TemplateKey;
  name: string;
  category: string;
  email: boolean;
  inApp: boolean;
}

/**
 * Get count of unread IN_APP notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({ id: notification.id })
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        eq(notification.channel, 'IN_APP'),
        eq(notification.isRead, false)
      )
    );
  return result.length;
}

/**
 * Get recent IN_APP notifications for a user (last 10).
 */
export async function getRecentNotifications(
  userId: string,
  limit = 10
): Promise<NotificationSummary[]> {
  const rows = await db
    .select({
      id: notification.id,
      templateKey: notification.templateKey,
      subject: notification.subject,
      body: notification.body,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      dataJson: notification.dataJson,
    })
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        eq(notification.channel, 'IN_APP')
      )
    )
    .orderBy(desc(notification.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    dataJson: (r.dataJson ?? {}) as Record<string, unknown>,
  }));
}

/**
 * Get notification preferences for a user.
 * Returns preferences for all template keys, using defaults where user has no override.
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferenceSummary[]> {
  const userPrefs = await db
    .select({
      templateKey: notificationPreference.templateKey,
      email: notificationPreference.email,
      inApp: notificationPreference.inApp,
    })
    .from(notificationPreference)
    .where(eq(notificationPreference.userId, userId));

  const prefsMap = new Map(userPrefs.map((p) => [p.templateKey, p]));

  const result: NotificationPreferenceSummary[] = [];
  for (const [key, template] of Object.entries(TEMPLATES)) {
    const userPref = prefsMap.get(key);
    result.push({
      templateKey: key as TemplateKey,
      name: template.name,
      category: template.category,
      email: userPref?.email ?? template.defaultChannels.includes('EMAIL'),
      inApp: userPref?.inApp ?? template.defaultChannels.includes('IN_APP'),
    });
  }

  return result;
}
