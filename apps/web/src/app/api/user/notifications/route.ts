import { NextRequest, NextResponse } from 'next/server';
import { db } from '@twicely/db';
import { notification } from '@twicely/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authorize } from '@twicely/casl';

/**
 * GET /api/user/notifications?limit=10
 * Returns the latest IN_APP notifications for the authenticated marketplace user.
 * Used by the NotificationDropdown header component.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  let session;
  try {
    const result = await authorize();
    session = result.session;
    if (!session) throw new Error('No session');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 50);

  const rows = await db
    .select({
      id: notification.id,
      templateKey: notification.templateKey,
      subject: notification.subject,
      body: notification.body,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    })
    .from(notification)
    .where(
      and(
        eq(notification.userId, session.userId),
        eq(notification.channel, 'IN_APP')
      )
    )
    .orderBy(desc(notification.createdAt))
    .limit(limit);

  const notifications = rows.map((r) => ({
    id: r.id,
    templateKey: r.templateKey,
    title: r.subject ?? '',
    body: r.body,
    isRead: r.isRead,
    createdAt: r.createdAt.toISOString(),
  }));

  const unreadCount = rows.filter((r) => !r.isRead).length;

  return NextResponse.json({ success: true, notifications, unreadCount });
}
