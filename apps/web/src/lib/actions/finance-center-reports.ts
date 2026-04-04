'use server';

import { revalidatePath } from 'next/cache';
import { authorize, sub } from '@twicely/casl';
import { logger } from '@twicely/logger';
import { db } from '@twicely/db';
import { financialReport } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  generateReportSchema,
  listReportsSchema,
  deleteReportSchema,
  getReportSchema,
} from '@/lib/validations/finance-center';
import {
  getPnlReportData,
  getBalanceSheetData,
  getCashFlowData,
  getReportList,
  getReportById,
  type SavedReport,
  type ReportListResult,
} from '@/lib/queries/finance-center-reports';
import { getFinanceTier } from '@/lib/queries/finance-center';
import { generatePnlCsv, generateBalanceSheetCsv, generateCashFlowCsv } from '@twicely/finance/report-csv';
import { generatePnlHtml, generateBalanceSheetHtml, generateCashFlowHtml } from '@twicely/finance/report-pdf';
import { uploadToR2, deleteFromR2, extractKeyFromUrl } from '@twicely/storage/r2-client';

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export type GenerateReportResponse =
  | { success: true; report: SavedReport }
  | { success: false; error: string };

export type ListReportsResponse =
  | { success: true; data: ReportListResult }
  | { success: false; error: string };

export type GetReportResponse =
  | { success: true; report: SavedReport }
  | { success: false; error: string };

export type DeleteReportResponse =
  | { success: true }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

function resolveUserId(session: {
  delegationId: string | null;
  onBehalfOfSellerId?: string | null;
  userId: string;
}): string {
  return session.delegationId ? session.onBehalfOfSellerId! : session.userId;
}

// ---------------------------------------------------------------------------
// generateReportAction
// ---------------------------------------------------------------------------

export async function generateReportAction(
  input: unknown,
): Promise<GenerateReportResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  // Delegation: staff cannot generate reports
  if (session.delegationId !== null) {
    return { success: false, error: 'Delegated staff cannot generate reports' };
  }

  const userId = resolveUserId(session);

  if (!ability.can('create', sub('FinancialReport', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = generateReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const financeTier = await getFinanceTier(userId);
  if (financeTier !== 'PRO') {
    return { success: false, error: 'Upgrade to Finance Pro to generate reports' };
  }

  try {
    const { reportType, periodStart: startStr, periodEnd: endStr, format } = parsed.data;
    const periodStart = new Date(startStr);
    const periodEnd = new Date(endStr);

    // Determine file URL if format requires upload
    let fileUrl: string | null = null;
    const reportId = crypto.randomUUID();

    // Assemble report data and generate file content in the same branch
    // so TypeScript knows the exact type without casts.
    let snapshotData: Awaited<ReturnType<typeof getPnlReportData>> | Awaited<ReturnType<typeof getBalanceSheetData>> | Awaited<ReturnType<typeof getCashFlowData>>;

    if (reportType === 'PNL') {
      const data = await getPnlReportData(userId, periodStart, periodEnd);
      snapshotData = data;
      if (format === 'CSV') {
        const key = `reports/${userId}/${reportType}/${reportId}.csv`;
        fileUrl = await uploadToR2(key, Buffer.from(generatePnlCsv(data), 'utf-8'), 'text/csv');
      } else if (format === 'PDF') {
        const key = `reports/${userId}/${reportType}/${reportId}.html`;
        fileUrl = await uploadToR2(key, Buffer.from(generatePnlHtml(data), 'utf-8'), 'text/html');
      }
    } else if (reportType === 'BALANCE_SHEET') {
      const data = await getBalanceSheetData(userId, periodStart, periodEnd);
      snapshotData = data;
      if (format === 'CSV') {
        const key = `reports/${userId}/${reportType}/${reportId}.csv`;
        fileUrl = await uploadToR2(key, Buffer.from(generateBalanceSheetCsv(data), 'utf-8'), 'text/csv');
      } else if (format === 'PDF') {
        const key = `reports/${userId}/${reportType}/${reportId}.html`;
        fileUrl = await uploadToR2(key, Buffer.from(generateBalanceSheetHtml(data), 'utf-8'), 'text/html');
      }
    } else {
      const data = await getCashFlowData(userId, periodStart, periodEnd);
      snapshotData = data;
      if (format === 'CSV') {
        const key = `reports/${userId}/${reportType}/${reportId}.csv`;
        fileUrl = await uploadToR2(key, Buffer.from(generateCashFlowCsv(data), 'utf-8'), 'text/csv');
      } else if (format === 'PDF') {
        const key = `reports/${userId}/${reportType}/${reportId}.html`;
        fileUrl = await uploadToR2(key, Buffer.from(generateCashFlowHtml(data), 'utf-8'), 'text/html');
      }
    }

    const [inserted] = await db
      .insert(financialReport)
      .values({
        userId,
        reportType,
        periodStart,
        periodEnd,
        snapshotJson: snapshotData,
        format,
        fileUrl,
      })
      .returning({
        id: financialReport.id,
        reportType: financialReport.reportType,
        periodStart: financialReport.periodStart,
        periodEnd: financialReport.periodEnd,
        snapshotJson: financialReport.snapshotJson,
        format: financialReport.format,
        fileUrl: financialReport.fileUrl,
        createdAt: financialReport.createdAt,
      });

    if (!inserted) return { success: false, error: 'Failed to save report' };

    revalidatePath('/my/selling/finances/statements');
    return { success: true, report: inserted };
  } catch (error) {
    logger.error('[generateReportAction] Failed to generate report', { error: String(error) });
    return { success: false, error: 'Failed to generate report' };
  }
}

// ---------------------------------------------------------------------------
// listReportsAction
// ---------------------------------------------------------------------------

export async function listReportsAction(
  input: unknown,
): Promise<ListReportsResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('read', sub('FinancialReport', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = listReportsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const data = await getReportList(userId, parsed.data);
    return { success: true, data };
  } catch (error) {
    logger.error('[listReportsAction] Failed to load reports', { error: String(error) });
    return { success: false, error: 'Failed to load reports' };
  }
}

// ---------------------------------------------------------------------------
// getReportAction
// ---------------------------------------------------------------------------

export async function getReportAction(
  input: unknown,
): Promise<GetReportResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('read', sub('FinancialReport', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = getReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const report = await getReportById(userId, parsed.data.id);
    if (!report) return { success: false, error: 'Not found' };
    return { success: true, report };
  } catch (error) {
    logger.error('[getReportAction] Failed to load report', { error: String(error) });
    return { success: false, error: 'Failed to load report' };
  }
}

// ---------------------------------------------------------------------------
// deleteReportAction
// ---------------------------------------------------------------------------

export async function deleteReportAction(
  input: unknown,
): Promise<DeleteReportResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  // Delegation: staff cannot delete reports
  if (session.delegationId !== null) {
    return { success: false, error: 'Delegated staff cannot delete reports' };
  }

  const userId = resolveUserId(session);

  if (!ability.can('delete', sub('FinancialReport', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = deleteReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const { id } = parsed.data;
    const existing = await getReportById(userId, id);
    if (!existing) return { success: false, error: 'Not found' };

    // Delete file from R2 if one exists
    if (existing.fileUrl) {
      const key = extractKeyFromUrl(existing.fileUrl);
      if (key) {
        await deleteFromR2(key);
      }
    }

    await db
      .delete(financialReport)
      .where(and(eq(financialReport.id, id), eq(financialReport.userId, userId)));

    revalidatePath('/my/selling/finances/statements');
    return { success: true };
  } catch (error) {
    logger.error('[deleteReportAction] Failed to delete report', { error: String(error) });
    return { success: false, error: 'Failed to delete report' };
  }
}
