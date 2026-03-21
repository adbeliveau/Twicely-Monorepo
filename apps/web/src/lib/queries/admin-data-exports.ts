/**
 * Admin Data Management — Export Request Queries (I12)
 * GDPR data export request summary and list queries for /exports hub page.
 */

import { db } from '@twicely/db';
import { dataExportRequest, user } from '@twicely/db/schema';
import { and, count, eq, ilike, lte, or, sql } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportRequestSummary {
  total: number;
  pending: number;
  completed: number;
  failed: number;
}

export interface ExportRequestRow {
  id: string;
  userName: string;
  userEmail: string;
  format: string;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
  downloadUrl: string | null;
  downloadExpiresAt: Date | null;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getExportRequestSummary(): Promise<ExportRequestSummary> {
  const [totals] = await db
    .select({
      total: count(),
      pending: sql<number>`sum(case when ${dataExportRequest.status} = 'PENDING' then 1 else 0 end)::int`,
      completed: sql<number>`sum(case when ${dataExportRequest.status} = 'COMPLETED' then 1 else 0 end)::int`,
      failed: sql<number>`sum(case when ${dataExportRequest.status} = 'FAILED' then 1 else 0 end)::int`,
    })
    .from(dataExportRequest);

  return {
    total: totals?.total ?? 0,
    pending: totals?.pending ?? 0,
    completed: totals?.completed ?? 0,
    failed: totals?.failed ?? 0,
  };
}

export async function getExportRequestList(opts: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}): Promise<{ requests: ExportRequestRow[]; total: number }> {
  const { page, pageSize, search, status } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) conditions.push(eq(dataExportRequest.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(user.name, `%${search}%`),
        ilike(user.email, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: dataExportRequest.id,
      userName: user.name,
      userEmail: user.email,
      format: dataExportRequest.format,
      status: dataExportRequest.status,
      requestedAt: dataExportRequest.createdAt,
      completedAt: dataExportRequest.completedAt,
      downloadUrl: dataExportRequest.downloadUrl,
      downloadExpiresAt: dataExportRequest.downloadExpiresAt,
    })
    .from(dataExportRequest)
    .leftJoin(user, eq(user.id, dataExportRequest.userId))
    .where(whereClause)
    .limit(pageSize)
    .offset(offset);

  const [countRow] = await db
    .select({ total: count() })
    .from(dataExportRequest)
    .leftJoin(user, eq(user.id, dataExportRequest.userId))
    .where(whereClause);

  return {
    requests: rows.map((r) => ({
      id: r.id,
      userName: r.userName ?? 'Unknown',
      userEmail: r.userEmail ?? 'Unknown',
      format: r.format,
      status: r.status,
      requestedAt: r.requestedAt,
      completedAt: r.completedAt,
      downloadUrl: r.downloadUrl,
      downloadExpiresAt: r.downloadExpiresAt,
    })),
    total: countRow?.total ?? 0,
  };
}

export async function getExportSlaBreach(slaHours: number): Promise<number> {
  const cutoff = new Date(Date.now() - slaHours * 60 * 60 * 1000);

  const [row] = await db
    .select({ total: count() })
    .from(dataExportRequest)
    .where(
      and(
        eq(dataExportRequest.status, 'PENDING'),
        lte(dataExportRequest.createdAt, cutoff)
      )
    );

  return row?.total ?? 0;
}
