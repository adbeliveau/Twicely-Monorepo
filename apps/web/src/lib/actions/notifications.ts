'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { notification, notificationPreference } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { TEMPLATES, type TemplateKey } from '@twicely/notifications/templates';
import { z } from 'zod';
import { zodId } from '@/lib/validation/schemas';

const markAsReadSchema = z.object({
  notificationId: zodId,
}).strict();

const updatePreferencesSchema = z.object({
  preferences: z.array(z.object({
    templateKey: z.string().min(1),
    email: z.boolean(),
    inApp: z.boolean(),
  }).strict()).min(1),
}).strict();

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: string): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('update', 'Notification')) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = markAsReadSchema.safeParse({ notificationId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [notif] = await db
    .select({ userId: notification.userId })
    .from(notification)
    .where(eq(notification.id, notificationId))
    .limit(1);

  if (!notif) return { success: false, error: 'Notification not found' };
  if (notif.userId !== session.userId) return { success: false, error: 'Unauthorized' };

  await db
    .update(notification)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notification.id, notificationId));

  revalidatePath('/my');
  return { success: true };
}

/**
 * Mark all IN_APP notifications as read for current user.
 */
export async function markAllAsRead(): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('update', 'Notification')) {
    return { success: false, error: 'Not authorized' };
  }

  await db
    .update(notification)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(notification.userId, session.userId),
        eq(notification.channel, 'IN_APP'),
        eq(notification.isRead, false)
      )
    );

  revalidatePath('/my');
  return { success: true };
}

interface PreferenceUpdate {
  templateKey: TemplateKey;
  email: boolean;
  inApp: boolean;
}

/**
 * Update notification preferences for current user.
 */
export async function updatePreferences(
  preferences: PreferenceUpdate[]
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('update', 'Notification')) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = updatePreferencesSchema.safeParse({ preferences });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = session.userId;

  for (const pref of preferences) {
    if (!TEMPLATES[pref.templateKey]) continue;

    const [existing] = await db
      .select({ id: notificationPreference.id })
      .from(notificationPreference)
      .where(
        and(
          eq(notificationPreference.userId, userId),
          eq(notificationPreference.templateKey, pref.templateKey)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(notificationPreference)
        .set({ email: pref.email, inApp: pref.inApp, updatedAt: new Date() })
        .where(eq(notificationPreference.id, existing.id));
    } else {
      await db.insert(notificationPreference).values({
        userId,
        templateKey: pref.templateKey,
        email: pref.email,
        inApp: pref.inApp,
      });
    }
  }

  revalidatePath('/my/settings/notifications');
  return { success: true };
}
