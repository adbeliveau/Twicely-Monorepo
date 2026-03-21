/**
 * Finance Center report list and fetch queries.
 * Split from finance-center-reports.ts to stay under the 300-line limit.
 */
import { db } from '@twicely/db';
import { financialReport } from '@twicely/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import type { ListReportsInput } from '@/lib/validations/finance-center';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SavedReport {
  id: string;
  reportType: string;
  periodStart: Date;
  periodEnd: Date;
  snapshotJson: unknown;
  format: string;
  fileUrl: string | null;
  createdAt: Date;
}

export interface ReportListResult {
  reports: SavedReport[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Column maps
// ---------------------------------------------------------------------------

const REPORT_COLUMNS = {
  id: financialReport.id,
  reportType: financialReport.reportType,
  periodStart: financialReport.periodStart,
  periodEnd: financialReport.periodEnd,
  snapshotJson: financialReport.snapshotJson,
  format: financialReport.format,
  fileUrl: financialReport.fileUrl,
  createdAt: financialReport.createdAt,
} as const;

const REPORT_META_COLUMNS = {
  id: financialReport.id,
  reportType: financialReport.reportType,
  periodStart: financialReport.periodStart,
  periodEnd: financialReport.periodEnd,
  format: financialReport.format,
  fileUrl: financialReport.fileUrl,
  createdAt: financialReport.createdAt,
} as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getReportList(
  userId: string,
  opts: ListReportsInput,
): Promise<ReportListResult> {
  const { page, pageSize, reportType } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(financialReport.userId, userId)];
  if (reportType) conditions.push(eq(financialReport.reportType, reportType));

  const where = and(...conditions);

  const [totalRow] = await db
    .select({ total: count() })
    .from(financialReport)
    .where(where);

  const rows = await db
    .select(REPORT_META_COLUMNS)
    .from(financialReport)
    .where(where)
    .orderBy(desc(financialReport.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    reports: rows.map((r) => ({
      ...r,
      snapshotJson: null,
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getReportById(
  userId: string,
  reportId: string,
): Promise<SavedReport | null> {
  const [row] = await db
    .select(REPORT_COLUMNS)
    .from(financialReport)
    .where(and(eq(financialReport.userId, userId), eq(financialReport.id, reportId)))
    .limit(1);

  return row ?? null;
}
