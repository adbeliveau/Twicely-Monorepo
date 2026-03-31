'use server';

/**
 * Staff Notification Actions
 * Fetch, mark-read, mark-all-read, and clear notifications for staff users.
 * Staff notifications use the same `notification` table with IN_APP channel,
 * targeting staff user IDs via helpdesk.agent.* and enforcement.appeal_submitted templates.
 */

import { db } from '@twicely/db';
import { notification } from '@twicely/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';

const markReadSchema = z.object({
  notificationId: zodId,
}).strict();

export interface StaffNotificationItem {
  id: string;
  templateKey: string;
  subject: string | null;
  body: string;
  isRead: boolean;
  createdAt: string;
  dataJson: Record<string, unknown>;
}

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Fetch the latest 20 IN_APP notifications for the current staff user.
 */
export async function getStaffNotifications(): Promise<{
  notifications: StaffNotificationItem[];
  unreadCount: number;
  error?: string;
}> {
  let session;
  try {
    const result = await staffAuthorize();
    session = result.session;
  } catch {
    return { notifications: [], unreadCount: 0, error: 'Unauthorized' };
  }

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
        eq(notification.userId, session.staffUserId),
        eq(notification.channel, 'IN_APP')
      )
    )
    .orderBy(desc(notification.createdAt))
    .limit(20);

  const unreadRows = rows.filter((r) => !r.isRead);

  return {
    notifications: rows.map((r) => ({
      id: r.id,
      templateKey: r.templateKey,
      subject: r.subject,
      body: r.body,
      isRead: r.isRead,
      createdAt: r.createdAt.toISOString(),
      dataJson: (r.dataJson ?? {}) as Record<string, unknown>,
    })),
    unreadCount: unreadRows.length,
  };
}

/**
 * Mark a single notification as read.
 */
export async function markStaffNotificationRead(
  notificationId: string
): Promise<ActionResult> {
  let session;
  try {
    const result = await staffAuthorize();
    session = result.session;
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = markReadSchema.safeParse({ notificationId });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const [notif] = await db
    .select({ userId: notification.userId })
    .from(notification)
    .where(eq(notification.id, notificationId))
    .limit(1);

  if (!notif) return { success: false, error: 'Not found' };
  if (notif.userId !== session.staffUserId) {
    return { success: false, error: 'Unauthorized' };
  }

  await db
    .update(notification)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notification.id, notificationId));

  return { success: true };
}

/**
 * Mark all unread IN_APP notifications as read for the current staff user.
 */
export async function markAllStaffNotificationsRead(): Promise<ActionResult> {
  let session;
  try {
    const result = await staffAuthorize();
    session = result.session;
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  await db
    .update(notification)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(notification.userId, session.staffUserId),
        eq(notification.channel, 'IN_APP'),
        eq(notification.isRead, false)
      )
    );

  return { success: true };
}

/**
 * Clear (delete) all read IN_APP notifications for the current staff user.
 * Unread notifications are preserved.
 */
export async function clearStaffNotifications(): Promise<ActionResult> {
  let session;
  try {
    const result = await staffAuthorize();
    session = result.session;
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  await db
    .delete(notification)
    .where(
      and(
        eq(notification.userId, session.staffUserId),
        eq(notification.channel, 'IN_APP'),
        eq(notification.isRead, true)
      )
    );

  return { success: true };
}
