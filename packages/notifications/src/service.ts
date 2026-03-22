/**
 * Notification Service
 *
 * Core notification dispatch: resolves template, checks user preferences,
 * inserts IN_APP notification rows, and sends email when enabled.
 */

import { db } from '@twicely/db';
import { notification, notificationPreference, notificationSetting } from '@twicely/db/schema';
import { user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@twicely/email/send';
import { createElement } from 'react';
import { TEMPLATES, interpolate, type TemplateKey } from './templates';
import type { NotificationChannel } from './templates-types';

export { interpolate } from './templates';

/**
 * Get user notification preferences for a given template key.
 */
async function getUserPreferences(
  userId: string,
  _templateKey: TemplateKey,
): Promise<{ email: boolean; inApp: boolean } | null> {
  const [pref] = await db
    .select()
    .from(notificationPreference)
    .where(eq(notificationPreference.userId, userId))
    .limit(1);

  return pref ? { email: pref.email, inApp: pref.inApp } : null;
}

/**
 * Get user-level notification settings (digest, quiet hours, etc.).
 */
async function getNotificationSettingsInternal(userId: string) {
  const [settings] = await db
    .select()
    .from(notificationSetting)
    .where(eq(notificationSetting.userId, userId))
    .limit(1);

  return settings ?? null;
}

/**
 * Get user email address for sending notifications.
 */
async function getUserEmail(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return row?.email ?? null;
}

/**
 * Insert a notification row into the database.
 */
async function insertNotification(params: {
  userId: string;
  channel: NotificationChannel;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  templateKey: string;
  subject: string;
  body: string;
  dataJson: Record<string, unknown>;
  failureReason?: string;
}) {
  const values: typeof notification.$inferInsert = {
    userId: params.userId,
    channel: params.channel,
    priority: params.priority,
    templateKey: params.templateKey,
    subject: params.subject,
    body: params.body,
    dataJson: params.dataJson,
    sentAt: params.failureReason ? undefined : new Date(),
    failedAt: params.failureReason ? new Date() : undefined,
    failureReason: params.failureReason ?? undefined,
  };
  await db.insert(notification).values(values);
}

/**
 * Send a notification to a user.
 *
 * Resolves the template, checks user preferences (falling back to
 * template defaultChannels), inserts IN_APP rows, and sends email
 * when the EMAIL channel is enabled.
 */
export async function notify(
  userId: string,
  templateKey: TemplateKey,
  data: Record<string, unknown> = {},
): Promise<void> {
  const template = TEMPLATES[templateKey];
  if (!template) return;

  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    stringData[k] = String(v ?? '');
  }
  const subject = interpolate(template.subjectTemplate, stringData);
  const body = interpolate(template.bodyTemplate, stringData);

  // Resolve channels: user prefs override template defaults
  const prefs = await getUserPreferences(userId, templateKey);
  await getNotificationSettingsInternal(userId);

  let channels: NotificationChannel[];
  if (prefs) {
    channels = [];
    if (prefs.inApp) channels.push('IN_APP');
    if (prefs.email) channels.push('EMAIL');
  } else {
    channels = [...template.defaultChannels];
  }

  for (const channel of channels) {
    if (channel === 'IN_APP') {
      await insertNotification({
        userId,
        channel: 'IN_APP',
        priority: template.priority,
        templateKey: template.key,
        subject,
        body,
        dataJson: data as Record<string, unknown>,
      });
    }

    if (channel === 'EMAIL') {
      const email = await getUserEmail(userId);
      if (!email) continue;

      const result = await sendEmail({
        to: email,
        subject,
        react: createElement('div', null, body),
      });
      const failureReason = result.success ? undefined : (result as { error?: string }).error;

      await insertNotification({
        userId,
        channel: 'EMAIL',
        priority: template.priority,
        templateKey: template.key,
        subject,
        body,
        dataJson: data as Record<string, unknown>,
        failureReason: failureReason ?? undefined,
      });
    }
  }
}
