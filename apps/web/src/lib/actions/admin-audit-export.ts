'use server';

import { db } from '@twicely/db';
import { auditEvent } from '@twicely/db/schema';
import { eq, gte, lte, and } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import type { AuditLogQuery } from '@/lib/queries/admin-audit-log-schemas';
import { getAuditEventById } from '@/lib/queries/admin-audit-log';

function escapeCsvValue(value: string | null | undefined): string {
  const str = value ?? '';
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportAuditLogCsv(
  params: AuditLogQuery
): Promise<{ csv: string } | { error: string }> {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'AuditEvent')) {
    return { error: 'Access denied' };
  }

  const {
    actorType,
    action,
    subject,
    severity,
    startDate,
    endDate,
    actorId,
    subjectId,
  } = params;

  const conditions = [];
  if (actorType) conditions.push(eq(auditEvent.actorType, actorType));
  if (action) conditions.push(eq(auditEvent.action, action));
  if (subject) conditions.push(eq(auditEvent.subject, subject));
  if (severity) conditions.push(eq(auditEvent.severity, severity));
  if (startDate) conditions.push(gte(auditEvent.createdAt, new Date(startDate)));
  if (endDate) conditions.push(lte(auditEvent.createdAt, new Date(endDate)));
  if (actorId) conditions.push(eq(auditEvent.actorId, actorId));
  if (subjectId) conditions.push(eq(auditEvent.subjectId, subjectId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: auditEvent.id,
      createdAt: auditEvent.createdAt,
      actorType: auditEvent.actorType,
      actorId: auditEvent.actorId,
      action: auditEvent.action,
      subject: auditEvent.subject,
      subjectId: auditEvent.subjectId,
      severity: auditEvent.severity,
      ipAddress: auditEvent.ipAddress,
    })
    .from(auditEvent)
    .where(where)
    .orderBy(auditEvent.createdAt)
    .limit(10000);

  const header = 'id,timestamp,actorType,actorId,action,subject,subjectId,severity,ipAddress';

  const lines = rows.map((r) =>
    [
      escapeCsvValue(r.id),
      escapeCsvValue(r.createdAt.toISOString()),
      escapeCsvValue(r.actorType),
      escapeCsvValue(r.actorId),
      escapeCsvValue(r.action),
      escapeCsvValue(r.subject),
      escapeCsvValue(r.subjectId),
      escapeCsvValue(r.severity),
      escapeCsvValue(r.ipAddress),
    ].join(',')
  );

  return { csv: [header, ...lines].join('\n') };
}

export async function getAuditEventByIdAction(eventId: string) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'AuditEvent')) return null;
  return getAuditEventById(eventId);
}
