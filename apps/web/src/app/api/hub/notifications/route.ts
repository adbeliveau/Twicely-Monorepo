import { NextResponse } from 'next/server';
import { db } from '@twicely/db';
import { notification } from '@twicely/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';

/**
 * GET /api/hub/notifications
 * Returns the latest 20 IN_APP notifications for the authenticated staff user.
 * Used by the notification dropdown for polling.
 */
export async function GET(): Promise<NextResponse> {
  let session;
  try {
    const result = await staffAuthorize();
    session = result.session;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const notifications = rows.map((r) => ({
    id: r.id,
    templateKey: r.templateKey,
    subject: r.subject,
    body: r.body,
    isRead: r.isRead,
    createdAt: r.createdAt.toISOString(),
    dataJson: (r.dataJson ?? {}) as Record<string, unknown>,
  }));

  const unreadCount = rows.filter((r) => !r.isRead).length;

  return NextResponse.json({ success: true, notifications, unreadCount });
}
