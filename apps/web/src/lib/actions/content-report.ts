'use server';

/**
 * Content Report Action (G4)
 * Any authenticated user can report a listing, review, message, or user.
 */

import { db } from '@twicely/db';
import { contentReport, auditEvent, listing, review, message, user } from '@twicely/db/schema';
import { eq, and, gte, count } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { contentReportSchema } from '@/lib/validations/enforcement';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getUserReportHistory } from '@/lib/queries/content-reports';
import { staffAuthorize } from '@twicely/casl/staff-authorize';

export async function submitContentReportAction(input: unknown) {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!ability.can('create', 'ContentReport')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = contentReportSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { targetType, targetId, reason, description } = parsed.data;
  const reporterUserId = session.userId;

  // Rate limit: max N reports per user per 24 hours (from platform settings)
  const maxReportsPerDay = await getPlatformSetting<number>('moderation.report.maxPerUserPerDay', 10);
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [countResult] = await db
    .select({ count: count() })
    .from(contentReport)
    .where(
      and(
        eq(contentReport.reporterUserId, reporterUserId),
        gte(contentReport.createdAt, windowStart)
      )
    );
  if ((countResult?.count ?? 0) >= maxReportsPerDay) {
    return { success: false, error: `Rate limit exceeded: max ${maxReportsPerDay} reports per 24 hours` };
  }

  // Validate target exists and prevent self-reporting
  if (targetType === 'LISTING') {
    const [row] = await db
      .select({ ownerUserId: listing.ownerUserId })
      .from(listing)
      .where(eq(listing.id, targetId))
      .limit(1);
    if (!row) return { success: false, error: 'Target not found' };
    if (row.ownerUserId === reporterUserId) {
      return { success: false, error: 'Cannot report your own content' };
    }
  } else if (targetType === 'REVIEW') {
    const [row] = await db
      .select({ reviewerUserId: review.reviewerUserId })
      .from(review)
      .where(eq(review.id, targetId))
      .limit(1);
    if (!row) return { success: false, error: 'Target not found' };
    if (row.reviewerUserId === reporterUserId) {
      return { success: false, error: 'Cannot report your own content' };
    }
  } else if (targetType === 'MESSAGE') {
    const [row] = await db
      .select({ senderUserId: message.senderUserId })
      .from(message)
      .where(eq(message.id, targetId))
      .limit(1);
    if (!row) return { success: false, error: 'Target not found' };
    if (row.senderUserId === reporterUserId) {
      return { success: false, error: 'Cannot report your own content' };
    }
  } else if (targetType === 'USER') {
    const [row] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1);
    if (!row) return { success: false, error: 'Target not found' };
    if (targetId === reporterUserId) {
      return { success: false, error: 'Cannot report your own content' };
    }
  }

  await db.insert(contentReport).values({
    reporterUserId,
    targetType,
    targetId,
    reason,
    description: description ?? null,
    status: 'PENDING',
  });

  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: reporterUserId,
    action: 'CONTENT_REPORT_SUBMITTED',
    subject: 'ContentReport',
    subjectId: targetId,
    severity: 'MEDIUM',
    detailsJson: { targetType, reason },
  });

  return { success: true };
}

export async function getUserReportHistoryAction(userId: string) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ContentReport')) return [];
  return getUserReportHistory(userId);
}
