/**
 * Admin Audit Event Queries (I11)
 * High-severity event queries for the Error Log Viewer.
 * Reuses AuditEventRow from admin-audit-log.ts.
 */

import { db } from '@twicely/db';
import { auditEvent } from '@twicely/db/schema';
import { eq, gte, lte, desc, and, inArray, sql } from 'drizzle-orm';
import type { AuditEventRow } from './admin-audit-log';

export type { AuditEventRow };

export interface HighSeverityFilters {
  severity?: 'HIGH' | 'CRITICAL';
  subject?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Return paginated audit events filtered to HIGH and CRITICAL severity.
 * All filters are optional and applied with AND logic.
 * Ordered by createdAt descending.
 */
export async function getHighSeverityAuditEvents(
  filters: HighSeverityFilters,
): Promise<{ events: AuditEventRow[]; total: number }> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  const severityFilter =
    filters.severity != null
      ? eq(auditEvent.severity, filters.severity)
      : inArray(auditEvent.severity, ['HIGH', 'CRITICAL']);

  const conditions = [severityFilter];

  if (filters.subject) {
    conditions.push(eq(auditEvent.subject, filters.subject));
  }
  if (filters.from) {
    conditions.push(gte(auditEvent.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(auditEvent.createdAt, new Date(filters.to)));
  }

  const where = conditions.length === 1 ? conditions[0]! : and(...conditions);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditEvent)
    .where(where);

  const total = Number(countResult?.count ?? 0);

  const rows = await db
    .select()
    .from(auditEvent)
    .where(where)
    .orderBy(desc(auditEvent.createdAt))
    .limit(pageSize)
    .offset(offset);

  const events: AuditEventRow[] = rows.map((r) => ({
    id: r.id,
    actorType: r.actorType,
    actorId: r.actorId ?? null,
    action: r.action,
    subject: r.subject,
    subjectId: r.subjectId ?? null,
    severity: r.severity,
    detailsJson: r.detailsJson,
    ipAddress: r.ipAddress ?? null,
    userAgent: r.userAgent ?? null,
    createdAt: r.createdAt,
  }));

  return { events, total };
}

/**
 * Return recent audit events for a specific subject + subjectId.
 * Used to show audit history on entity detail pages.
 */
export async function getAuditEventsForSubject(
  subject: string,
  subjectId: string,
  limit: number = 20,
): Promise<AuditEventRow[]> {
  const rows = await db
    .select()
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.subject, subject),
        eq(auditEvent.subjectId, subjectId),
      ),
    )
    .orderBy(desc(auditEvent.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    actorType: r.actorType,
    actorId: r.actorId ?? null,
    action: r.action,
    subject: r.subject,
    subjectId: r.subjectId ?? null,
    severity: r.severity,
    detailsJson: r.detailsJson,
    ipAddress: r.ipAddress ?? null,
    userAgent: r.userAgent ?? null,
    createdAt: r.createdAt,
  }));
}
