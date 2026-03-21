/**
 * Admin Data Retention — Export Request Queries (I13)
 * Read-only queries for GDPR data export request management.
 */

import { db } from '@twicely/db';
import { dataExportRequest, user } from '@twicely/db/schema';
import { eq, desc, inArray, sql, count, ilike, and } from 'drizzle-orm';

export type ExportRequestRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  format: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  downloadUrl: string | null;
  downloadExpiresAt: Date | null;
};

export interface ExportRequestSummary {
  total: number;
  pending: number;
  completed: number;
  failed: number;
}

export async function getExportRequestAdminSummary(): Promise<ExportRequestSummary> {
  const [totalRow, pendingRow, completedRow, failedRow] = await Promise.all([
    db.select({ c: count() }).from(dataExportRequest),
    db
      .select({ c: count() })
      .from(dataExportRequest)
      .where(inArray(dataExportRequest.status, ['PENDING', 'PROCESSING'])),
    db
      .select({ c: count() })
      .from(dataExportRequest)
      .where(inArray(dataExportRequest.status, ['COMPLETED'])),
    db
      .select({ c: count() })
      .from(dataExportRequest)
      .where(inArray(dataExportRequest.status, ['FAILED', 'EXPIRED'])),
  ]);

  return {
    total: totalRow[0]?.c ?? 0,
    pending: pendingRow[0]?.c ?? 0,
    completed: completedRow[0]?.c ?? 0,
    failed: failedRow[0]?.c ?? 0,
  };
}

export async function getExportRequestAdminList(opts: {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}): Promise<{ requests: ExportRequestRow[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, opts.pageSize ?? 25);
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (opts.status) {
    conditions.push(eq(dataExportRequest.status, opts.status));
  }

  if (opts.search) {
    conditions.push(
      ilike(user.email, `%${opts.search}%`)
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: dataExportRequest.id,
        userId: dataExportRequest.userId,
        userName: user.name,
        userEmail: user.email,
        format: dataExportRequest.format,
        status: dataExportRequest.status,
        createdAt: dataExportRequest.createdAt,
        completedAt: dataExportRequest.completedAt,
        downloadUrl: dataExportRequest.downloadUrl,
        downloadExpiresAt: dataExportRequest.downloadExpiresAt,
      })
      .from(dataExportRequest)
      .leftJoin(user, eq(user.id, dataExportRequest.userId))
      .where(whereClause)
      .orderBy(desc(dataExportRequest.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ c: count() })
      .from(dataExportRequest)
      .leftJoin(user, eq(user.id, dataExportRequest.userId))
      .where(whereClause),
  ]);

  return {
    requests: rows,
    total: totalRows[0]?.c ?? 0,
  };
}

export async function getExportSlaBreachCount(maxHours: number): Promise<number> {
  const result = await db
    .select({ c: count() })
    .from(dataExportRequest)
    .where(
      and(
        inArray(dataExportRequest.status, ['PENDING', 'PROCESSING']),
        sql`${dataExportRequest.createdAt} < ${new Date(Date.now() - Number(maxHours) * 3600000)}`
      )
    );

  return result[0]?.c ?? 0;
}
