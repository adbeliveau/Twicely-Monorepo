import { db } from '@twicely/db';
import { notification, notificationPreference, notificationSetting, user } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from '@twicely/email/send';
import { TEMPLATES, interpolate, type TemplateKey } from './templates';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { getValkeyClient } from '@twicely/db/cache';

interface UserPrefs {
  email: boolean;
  inApp: boolean;
  push: boolean;
  sms: boolean;
}

interface InternalSettings {
  digestFrequency: string | null;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
}

async function getUserPreferences(userId: string, templateKey: TemplateKey): Promise<UserPrefs> {
  const [pref] = await db
    .select({ email: notificationPreference.email, inApp: notificationPreference.inApp })
    .from(notificationPreference)
    .where(and(eq(notificationPreference.userId, userId), eq(notificationPreference.templateKey, templateKey)))
    .limit(1);

  if (pref) {
    return { email: pref.email, inApp: pref.inApp, push: false, sms: false };
  }

  // Use template defaults
  const template = TEMPLATES[templateKey];
  return {
    email: template.defaultChannels.includes('EMAIL'),
    inApp: template.defaultChannels.includes('IN_APP'),
    push: false,
    sms: false,
  };
}

async function getUserEmail(userId: string): Promise<string | null> {
  const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  return u?.email ?? null;
}

async function getNotificationSettingsInternal(userId: string): Promise<InternalSettings> {
  const [row] = await db
    .select({
      digestFrequency: notificationSetting.digestFrequency,
      quietHoursEnabled: notificationSetting.quietHoursEnabled,
      quietHoursStart: notificationSetting.quietHoursStart,
      quietHoursEnd: notificationSetting.quietHoursEnd,
      timezone: notificationSetting.timezone,
    })
    .from(notificationSetting)
    .where(eq(notificationSetting.userId, userId))
    .limit(1);

  if (row) {
    return {
      digestFrequency: row.digestFrequency,
      quietHoursEnabled: row.quietHoursEnabled,
      quietHoursStart: row.quietHoursStart ?? null,
      quietHoursEnd: row.quietHoursEnd ?? null,
      timezone: row.timezone,
    };
  }

  return {
    digestFrequency: null,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: 'America/New_York',
  };
}

/**
 * Check if the current time falls within the user's quiet hours.
 * Handles overnight ranges (e.g., 22:00-08:00).
 */
export function isQuietHours(settings: InternalSettings): boolean {
  if (!settings.quietHoursEnabled || !settings.quietHoursStart || !settings.quietHoursEnd) {
    return false;
  }

  // Get current time in user's timezone as HH:MM
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: settings.timezone,
  });
  const parts = formatter.formatToParts(now);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const currentMinutes = parseInt(hour, 10) * 60 + parseInt(minute, 10);

  const [startH, startM] = settings.quietHoursStart.split(':').map(Number);
  const [endH, endM] = settings.quietHoursEnd.split(':').map(Number);
  const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

  if (startMinutes <= endMinutes) {
    // Same-day range (e.g., 14:00–16:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range (e.g., 22:00–08:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Send a notification to a user.
 * Creates in-app notification and/or sends email based on user preferences.
 * Respects quiet hours (push/SMS skipped when in quiet window) and digest
 * routing (NORMAL/LOW priority emails queued for digest instead of immediate send).
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function notify(
  userId: string,
  templateKey: TemplateKey,
  data: Record<string, string>
): Promise<void> {
  const template = TEMPLATES[templateKey];
  if (!template) {
    logger.error(`[notify] Unknown template: ${templateKey}`);
    return;
  }

  const prefs = await getUserPreferences(userId, templateKey);
  const settings = await getNotificationSettingsInternal(userId);
  const subject = interpolate(template.subjectTemplate, data);
  const body = interpolate(template.bodyTemplate, data);

  // IN_APP — always immediate, never affected by quiet hours or digest
  if (prefs.inApp) {
    try {
      await db.insert(notification).values({
        userId,
        channel: 'IN_APP',
        priority: template.priority,
        templateKey,
        subject,
        body,
        dataJson: data,
      });
    } catch (err) {
      logger.error(`[notify] Failed to create IN_APP notification:`, { err });
    }
  }

  // EMAIL — digest routing for NORMAL/LOW priority
  if (prefs.email) {
    // Global email gate
    const emailEnabled = await getPlatformSetting<boolean>('comms.email.enabled', true);
    if (!emailEnabled) return;

    const isInformational = template.priority === 'NORMAL' || template.priority === 'LOW';
    // Global digest gate — if disabled, send immediately instead of queueing
    const digestEnabled = await getPlatformSetting<boolean>('comms.digest.enabled', true);
    if (isInformational && digestEnabled && settings.digestFrequency) {
      // Queue for digest: create row with sentAt=null
      try {
        await db.insert(notification).values({
          userId,
          channel: 'EMAIL',
          priority: template.priority,
          templateKey,
          subject,
          body,
          dataJson: data,
          sentAt: null,
        });
      } catch (err) {
        logger.error(`[notify] Failed to queue digest notification:`, { err });
      }
    } else {
      // Send immediately
      const email = await getUserEmail(userId);
      if (!email) {
        logger.warn(`[notify] No email for user ${userId}, skipping EMAIL`);
        return;
      }

      // Lazy-load the email component builder to avoid eager JSX imports
      const { getEmailComponent } = await import('./email-components');
      const emailComponent = getEmailComponent(templateKey, data);
      if (!emailComponent) {
        logger.error(`[notify] No email component for template: ${templateKey}`);
        try {
          await db.insert(notification).values({
            userId,
            channel: 'EMAIL',
            priority: template.priority,
            templateKey,
            subject,
            body,
            dataJson: data,
            sentAt: null,
            failedAt: new Date(),
            failureReason: 'No email component for template',
          });
        } catch (err) {
          logger.error('[notify] Failed to record EMAIL component-missing failure', { err });
        }
        return;
      }

      // Per-user daily email rate limit — check before, charge after success
      const dateInTz = new Intl.DateTimeFormat('en-CA', { timeZone: settings.timezone }).format(new Date());
      const rateLimitKey = `email-rate:${userId}:${dateInTz}`;
      try {
        const valkey = getValkeyClient();
        const maxPerDay = await getPlatformSetting<number>('comms.email.maxPerDayPerUser', 50);
        const currentCount = parseInt(await valkey.get(rateLimitKey) ?? '0', 10);
        if (currentCount >= maxPerDay) {
          logger.warn('[notify] Email rate limit exceeded', { userId, count: currentCount, maxPerDay });
          return;
        }
      } catch {
        // Valkey unavailable — fail open
      }

      const result = await sendEmail({ to: email, subject, react: emailComponent });

      // Charge rate limit only after successful send
      if (result.success) {
        try {
          const valkey = getValkeyClient();
          const count = await valkey.incr(rateLimitKey);
          if (count === 1) await valkey.expire(rateLimitKey, 86400);
        } catch {
          // Valkey unavailable — non-critical
        }
      }

      try {
        await db.insert(notification).values({
          userId,
          channel: 'EMAIL',
          priority: template.priority,
          templateKey,
          subject,
          body,
          dataJson: data,
          sentAt: result.success ? new Date() : null,
          failedAt: result.success ? null : new Date(),
          failureReason: result.error ?? null,
        });
      } catch (err) {
        logger.error(`[notify] Failed to record EMAIL notification:`, { err });
      }
    }
  }

  // PUSH — quiet hours check (push sending not implemented yet)
  if (prefs.push) {
    const isCritical = template.priority === 'CRITICAL';
    if (!isCritical && isQuietHours(settings)) {
      return;
    }
    // TODO: implement push sending when FCM/APNs infrastructure is ready
  }

  // SMS — quiet hours check (SMS sending not implemented yet)
  if (prefs.sms) {
    const isCritical = template.priority === 'CRITICAL';
    if (!isCritical && isQuietHours(settings)) {
      return;
    }
    // TODO: implement SMS sending when infrastructure is ready
  }
}
