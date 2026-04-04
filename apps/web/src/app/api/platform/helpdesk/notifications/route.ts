import { NextRequest, NextResponse } from 'next/server';
import { db } from '@twicely/db';
import { notification } from '@twicely/db/schema';
import { eq, and, desc, like } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';

/**
 * GET /api/platform/helpdesk/notifications?limit=10
 * Returns the latest helpdesk-related IN_APP notifications for the authenticated staff user.
 * Used by the StaffNotificationDropdown header component.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  let session;
  try {
    const result = await staffAuthorize();
    session = result.session;
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
      dataJson: notification.dataJson,
    })
    .from(notification)
    .where(
      and(
        eq(notification.userId, session.staffUserId),
        eq(notification.channel, 'IN_APP'),
        like(notification.templateKey, 'HELPDESK_%')
      )
    )
    .orderBy(desc(notification.createdAt))
    .limit(limit);

  const notifications = rows.map((r) => {
    const data = (r.dataJson ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      type: r.templateKey.replace('HELPDESK_', '').toLowerCase(),
      title: r.subject ?? '',
      body: r.body,
      read: r.isRead,
      createdAt: r.createdAt.toISOString(),
      caseId: (data.caseId as string) ?? null,
    };
  });

  const unreadCount = rows.filter((r) => !r.isRead).length;

  return NextResponse.json({ success: true, notifications, unreadCount });
}
