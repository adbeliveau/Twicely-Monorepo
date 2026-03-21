/**
 * Content Report Queries (G4)
 */

import { db } from '@twicely/db';
import { contentReport, user } from '@twicely/db/schema';
import { eq, and, count, desc, inArray } from 'drizzle-orm';

type ContentReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'CONFIRMED' | 'DISMISSED';
type ContentReportTarget = 'LISTING' | 'REVIEW' | 'MESSAGE' | 'USER';

export interface ContentReportRow {
  id: string;
  reporterUserId: string;
  reporterName: string;
  targetType: ContentReportTarget;
  targetId: string;
  reason: string;
  status: ContentReportStatus;
  createdAt: Date;
}

export async function getContentReports(
  status: ContentReportStatus | null,
  page: number,
  pageSize: number
): Promise<{ reports: ContentReportRow[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const whereClause = status
    ? eq(contentReport.status, status)
    : undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(contentReport)
    .where(whereClause);

  const rows = await db
    .select({
      id: contentReport.id,
      reporterUserId: contentReport.reporterUserId,
      targetType: contentReport.targetType,
      targetId: contentReport.targetId,
      reason: contentReport.reason,
      status: contentReport.status,
      createdAt: contentReport.createdAt,
    })
    .from(contentReport)
    .where(whereClause)
    .orderBy(desc(contentReport.createdAt))
    .limit(pageSize)
    .offset(offset);

  const reporterIds = [...new Set(rows.map((r) => r.reporterUserId))];
  const reporters = reporterIds.length > 0
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, reporterIds))
    : [];
  const nameMap = new Map(reporters.map((u) => [u.id, u.name]));

  return {
    reports: rows.map((r) => ({
      ...r,
      reporterName: nameMap.get(r.reporterUserId) ?? 'Unknown',
    })) as ContentReportRow[],
    total: totalResult?.count ?? 0,
  };
}

export async function getContentReportById(reportId: string) {
  const [row] = await db
    .select({
      id: contentReport.id,
      reporterUserId: contentReport.reporterUserId,
      reporterName: user.name,
      targetType: contentReport.targetType,
      targetId: contentReport.targetId,
      reason: contentReport.reason,
      description: contentReport.description,
      status: contentReport.status,
      reviewedByStaffId: contentReport.reviewedByStaffId,
      reviewedAt: contentReport.reviewedAt,
      reviewNotes: contentReport.reviewNotes,
      enforcementActionId: contentReport.enforcementActionId,
      createdAt: contentReport.createdAt,
      updatedAt: contentReport.updatedAt,
    })
    .from(contentReport)
    .leftJoin(user, eq(contentReport.reporterUserId, user.id))
    .where(eq(contentReport.id, reportId))
    .limit(1);
  if (!row) return null;
  return { ...row, reporterName: row.reporterName ?? null };
}

export async function getContentReportCountByStatus(): Promise<Record<ContentReportStatus, number>> {
  const rows = await db
    .select({ status: contentReport.status, count: count() })
    .from(contentReport)
    .groupBy(contentReport.status);

  const result: Record<ContentReportStatus, number> = {
    PENDING: 0,
    UNDER_REVIEW: 0,
    CONFIRMED: 0,
    DISMISSED: 0,
  };
  for (const row of rows) {
    if (row.status !== null) {
      result[row.status as ContentReportStatus] = row.count;
    }
  }
  return result;
}

export async function getUserReportHistory(userId: string) {
  return db
    .select({
      id: contentReport.id,
      targetType: contentReport.targetType,
      targetId: contentReport.targetId,
      reason: contentReport.reason,
      status: contentReport.status,
      createdAt: contentReport.createdAt,
    })
    .from(contentReport)
    .where(eq(contentReport.reporterUserId, userId))
    .orderBy(desc(contentReport.createdAt));
}

export async function getReportsForTarget(
  targetType: ContentReportTarget,
  targetId: string
) {
  return db
    .select({
      id: contentReport.id,
      reporterUserId: contentReport.reporterUserId,
      reason: contentReport.reason,
      status: contentReport.status,
      createdAt: contentReport.createdAt,
    })
    .from(contentReport)
    .where(
      and(
        eq(contentReport.targetType, targetType),
        eq(contentReport.targetId, targetId)
      )
    )
    .orderBy(desc(contentReport.createdAt));
}
