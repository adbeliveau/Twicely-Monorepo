/**
 * Admin Trust Security & Risk Queries (I7)
 * Risk signals, security events, security event KPIs.
 */

import { db } from '@twicely/db';
import { sellerProfile, sellerPerformance, auditEvent } from '@twicely/db/schema';
import { eq, desc, count, lt, sql, and, gte, like } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecurityEventOpts {
  page: number;
  pageSize: number;
  severity?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface SecurityEventRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  subject: string;
  subjectId: string | null;
  severity: string;
  detailsJson: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface SecurityEventKPIs {
  last24h: number;
  last7d: number;
  last30d: number;
  bySeverity: Array<{ severity: string; count: number }>;
  topEventTypes: Array<{ action: string; count: number }>;
}

export interface RiskSignals {
  restrictedSellers: number;
  preSuspensionSellers: number;
  highDefectSellers: number;
  recentFraudFlags: number;
  activeOverrides: number;
  lowTrustSellers: number;
}

// ─── Risk Signals ─────────────────────────────────────────────────────────────

export async function getRiskSignals(): Promise<RiskSignals> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [lowTrust, preSuspension, restricted, highDefect, overrides, fraudFlags] =
    await Promise.all([
      db.select({ cnt: count() }).from(sellerProfile).where(lt(sellerProfile.trustScore, 40)),
      db.select({ cnt: count() }).from(sellerProfile).where(eq(sellerProfile.enforcementLevel, 'PRE_SUSPENSION')),
      db.select({ cnt: count() }).from(sellerProfile).where(eq(sellerProfile.enforcementLevel, 'RESTRICTION')),
      db.select({ cnt: count() }).from(sellerPerformance).where(sql`${sellerPerformance.defectRate} > 0.02`),
      db.select({ cnt: count() }).from(sellerProfile).where(sql`${sellerProfile.bandOverride} IS NOT NULL`),
      db.select({ cnt: count() }).from(auditEvent).where(
        and(eq(auditEvent.action, 'security.fraud.flagged'), gte(auditEvent.createdAt, sevenDaysAgo))
      ),
    ]);

  return {
    lowTrustSellers: Number(lowTrust[0]?.cnt ?? 0),
    preSuspensionSellers: Number(preSuspension[0]?.cnt ?? 0),
    restrictedSellers: Number(restricted[0]?.cnt ?? 0),
    highDefectSellers: Number(highDefect[0]?.cnt ?? 0),
    activeOverrides: Number(overrides[0]?.cnt ?? 0),
    recentFraudFlags: Number(fraudFlags[0]?.cnt ?? 0),
  };
}

// ─── Security Events ──────────────────────────────────────────────────────────

export async function getSecurityEvents(
  opts: SecurityEventOpts
): Promise<{ events: SecurityEventRow[]; total: number }> {
  const { page, pageSize, severity, action, startDate, endDate } = opts;
  const offset = (page - 1) * pageSize;

  const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
  type AuditSeverity = (typeof validSeverities)[number];
  const conditions = [like(auditEvent.action, 'security.%')];
  if (severity && validSeverities.includes(severity as AuditSeverity)) {
    conditions.push(eq(auditEvent.severity, severity as AuditSeverity));
  }
  if (action) conditions.push(eq(auditEvent.action, action));
  if (startDate) conditions.push(gte(auditEvent.createdAt, startDate));
  if (endDate) conditions.push(lt(auditEvent.createdAt, endDate));

  const whereClause = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db.select().from(auditEvent).where(whereClause).orderBy(desc(auditEvent.createdAt)).limit(pageSize).offset(offset),
    db.select({ cnt: count() }).from(auditEvent).where(whereClause),
  ]);

  return {
    events: rows.map((r) => ({
      id: r.id, actorType: r.actorType, actorId: r.actorId ?? null,
      action: r.action, subject: r.subject, subjectId: r.subjectId ?? null,
      severity: r.severity, detailsJson: r.detailsJson,
      ipAddress: r.ipAddress ?? null, userAgent: r.userAgent ?? null, createdAt: r.createdAt,
    })),
    total: Number(totalRows[0]?.cnt ?? 0),
  };
}

export async function getSecurityEventKPIs(): Promise<SecurityEventKPIs> {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [cnt24h, cnt7d, cnt30d, bySeverity, topTypes] = await Promise.all([
    db.select({ cnt: count() }).from(auditEvent).where(and(like(auditEvent.action, 'security.%'), gte(auditEvent.createdAt, h24))),
    db.select({ cnt: count() }).from(auditEvent).where(and(like(auditEvent.action, 'security.%'), gte(auditEvent.createdAt, d7))),
    db.select({ cnt: count() }).from(auditEvent).where(and(like(auditEvent.action, 'security.%'), gte(auditEvent.createdAt, d30))),
    db.select({ severity: auditEvent.severity, cnt: count() }).from(auditEvent).where(and(like(auditEvent.action, 'security.%'), gte(auditEvent.createdAt, d30))).groupBy(auditEvent.severity),
    db.select({ action: auditEvent.action, cnt: count() }).from(auditEvent).where(and(like(auditEvent.action, 'security.%'), gte(auditEvent.createdAt, d30))).groupBy(auditEvent.action).orderBy(desc(count())).limit(5),
  ]);

  return {
    last24h: Number(cnt24h[0]?.cnt ?? 0),
    last7d: Number(cnt7d[0]?.cnt ?? 0),
    last30d: Number(cnt30d[0]?.cnt ?? 0),
    bySeverity: bySeverity.map((r) => ({ severity: r.severity, count: Number(r.cnt) })),
    topEventTypes: topTypes.map((r) => ({ action: r.action, count: Number(r.cnt) })),
  };
}
