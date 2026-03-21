/**
 * Tax document queries
 * G5.4 — 1099-K document generation + seller download
 */

import { db } from '@twicely/db';
import { financialReport } from '@twicely/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

export interface TaxDocument {
  id: string;
  userId: string;
  reportType: string;
  periodStart: Date;
  periodEnd: Date;
  fileUrl: string | null;
  format: string;
  createdAt: Date;
  taxYear: number;
}

/**
 * Get all tax documents (1099-K and 1099-NEC) for a seller, sorted by year descending.
 */
export async function getTaxDocumentsByUserId(
  userId: string
): Promise<TaxDocument[]> {
  const rows = await db
    .select({
      id: financialReport.id,
      userId: financialReport.userId,
      reportType: financialReport.reportType,
      periodStart: financialReport.periodStart,
      periodEnd: financialReport.periodEnd,
      fileUrl: financialReport.fileUrl,
      format: financialReport.format,
      createdAt: financialReport.createdAt,
    })
    .from(financialReport)
    .where(
      and(
        eq(financialReport.userId, userId),
        inArray(financialReport.reportType, ['1099_K', '1099_NEC'])
      )
    )
    .orderBy(desc(financialReport.periodStart));

  return rows.map((row) => ({
    ...row,
    taxYear: row.periodStart.getUTCFullYear(),
  }));
}

/**
 * Get a specific tax document by ID, verifying it belongs to the user.
 * Used for download access control.
 */
export async function getTaxDocumentById(
  id: string,
  userId: string
): Promise<TaxDocument | null> {
  const [row] = await db
    .select({
      id: financialReport.id,
      userId: financialReport.userId,
      reportType: financialReport.reportType,
      periodStart: financialReport.periodStart,
      periodEnd: financialReport.periodEnd,
      fileUrl: financialReport.fileUrl,
      format: financialReport.format,
      createdAt: financialReport.createdAt,
    })
    .from(financialReport)
    .where(
      and(
        eq(financialReport.id, id),
        eq(financialReport.userId, userId),
        inArray(financialReport.reportType, ['1099_K', '1099_NEC'])
      )
    )
    .limit(1);

  if (!row) return null;
  return { ...row, taxYear: row.periodStart.getUTCFullYear() };
}
