/**
 * Admin Audit Log Queries (E4)
 * Paginated audit event list with filters, plus single event lookup.
 */

import { db } from '@twicely/db';
import { auditEvent } from '@twicely/db/schema';
import { eq, gte, lte, desc, and, sql } from 'drizzle-orm';
import type { AuditLogQuery } from './admin-audit-log-schemas';

export interface AuditEventRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  subject: string;
  subjectId: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detailsJson: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * Return paginated audit events with optional filters.
 * All filters are optional and applied with AND logic.
 * Ordered by createdAt descending (most recent first).
 */
export async function getAuditEvents(params: AuditLogQuery): Promise<{
  events: AuditEventRow[];
  totalCount: number;
}> {
  const {
    page,
    limit,
    actorType,
    action,
    subject,
    severity,
    startDate,
    endDate,
    actorId,
    subjectId,
  } = params;

  const offset = (page - 1) * limit;

  // Build dynamic WHERE conditions
  const conditions = [];

  if (actorType) {
    conditions.push(eq(auditEvent.actorType, actorType));
  }
  if (action) {
    conditions.push(eq(auditEvent.action, action));
  }
  if (subject) {
    conditions.push(eq(auditEvent.subject, subject));
  }
  if (severity) {
    conditions.push(eq(auditEvent.severity, severity));
  }
  if (startDate) {
    conditions.push(gte(auditEvent.createdAt, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(auditEvent.createdAt, new Date(endDate)));
  }
  if (actorId) {
    conditions.push(eq(auditEvent.actorId, actorId));
  }
  if (subjectId) {
    conditions.push(eq(auditEvent.subjectId, subjectId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Count query
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditEvent)
    .where(where);

  const totalCount = Number(countResult?.count ?? 0);

  // Data query
  const rows = await db
    .select()
    .from(auditEvent)
    .where(where)
    .orderBy(desc(auditEvent.createdAt))
    .limit(limit)
    .offset(offset);

  const events: AuditEventRow[] = rows.map((row) => ({
    id: row.id,
    actorType: row.actorType,
    actorId: row.actorId ?? null,
    action: row.action,
    subject: row.subject,
    subjectId: row.subjectId ?? null,
    severity: row.severity,
    detailsJson: row.detailsJson,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    createdAt: row.createdAt,
  }));

  return { events, totalCount };
}

/**
 * Return a single audit event by ID, or null if not found.
 */
export async function getAuditEventById(id: string): Promise<AuditEventRow | null> {
  const [row] = await db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.id, id))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    actorType: row.actorType,
    actorId: row.actorId ?? null,
    action: row.action,
    subject: row.subject,
    subjectId: row.subjectId ?? null,
    severity: row.severity,
    detailsJson: row.detailsJson,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    createdAt: row.createdAt,
  };
}
