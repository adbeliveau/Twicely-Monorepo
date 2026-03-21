'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { notificationSetting, user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { updateNotificationSettingsSchema } from '@/lib/validations/notification-settings';
import type { UpdateNotificationSettingsInput } from '@/lib/validations/notification-settings';

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Upsert user-level notification settings (digest, quiet hours, marketing opt-in,
 * and seller-specific controls).
 * Seller-only fields are silently ignored when the caller is not a seller.
 */
export async function updateNotificationSettings(
  input: UpdateNotificationSettingsInput
): Promise<ActionResult> {
  const parsed = updateNotificationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('update', 'Notification')) {
    return { success: false, error: 'Not authorized' };
  }

  const data = parsed.data;
  const userId = session.userId;

  const [existing] = await db
    .select({ id: notificationSetting.id })
    .from(notificationSetting)
    .where(eq(notificationSetting.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(notificationSetting)
      .set({
        digestFrequency: data.digestFrequency,
        digestTimeUtc: data.digestTimeUtc,
        timezone: data.timezone,
        quietHoursEnabled: data.quietHoursEnabled,
        quietHoursStart: data.quietHoursStart,
        quietHoursEnd: data.quietHoursEnd,
        ...(session.isSeller
          ? {
              dailySalesSummary: data.dailySalesSummary ?? false,
              staleListingDays: data.staleListingDays ?? null,
              trustScoreAlerts: data.trustScoreAlerts ?? false,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(notificationSetting.id, existing.id));
  } else {
    await db.insert(notificationSetting).values({
      userId,
      digestFrequency: data.digestFrequency,
      digestTimeUtc: data.digestTimeUtc,
      timezone: data.timezone,
      quietHoursEnabled: data.quietHoursEnabled,
      quietHoursStart: data.quietHoursStart,
      quietHoursEnd: data.quietHoursEnd,
      ...(session.isSeller
        ? {
            dailySalesSummary: data.dailySalesSummary ?? false,
            staleListingDays: data.staleListingDays ?? null,
            trustScoreAlerts: data.trustScoreAlerts ?? false,
          }
        : {}),
    });
  }

  await db
    .update(user)
    .set({ marketingOptIn: data.marketingOptIn, updatedAt: new Date() })
    .where(eq(user.id, userId));

  revalidatePath('/my/settings/notifications');
  return { success: true };
}
