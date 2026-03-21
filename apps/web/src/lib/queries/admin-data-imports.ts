/**
 * Admin Data Management — Import Batch Queries (I12)
 * Import batch summary, list, and health stat queries for /imports hub page.
 */

import { db } from '@twicely/db';
import { importBatch, user } from '@twicely/db/schema';
import { and, avg, count, eq, ilike, or, sql } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportBatchSummary {
  total: number;
  inProgress: number;
  completed: number;
  failed: number;
}

export interface ImportBatchRow {
  id: string;
  sellerName: string;
  channel: string;
  status: string;
  totalItems: number;
  createdItems: number;
  failedItems: number;
  startedAt: Date | null;
  completedAt: Date | null;
  errorSummaryJson: unknown;
}

export interface ImportHealthStats {
  avgCompletionMs: number | null;
  successRatePercent: number | null;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getImportBatchSummary(): Promise<ImportBatchSummary> {
  const IN_PROGRESS_STATUSES = ['CREATED', 'FETCHING', 'DEDUPLICATING', 'TRANSFORMING', 'IMPORTING'];
  const FAILED_STATUSES = ['FAILED', 'PARTIALLY_COMPLETED'];

  const [totals] = await db
    .select({
      total: count(),
      inProgress: sql<number>`sum(case when ${importBatch.status} in ('CREATED','FETCHING','DEDUPLICATING','TRANSFORMING','IMPORTING') then 1 else 0 end)::int`,
      completed: sql<number>`sum(case when ${importBatch.status} = 'COMPLETED' then 1 else 0 end)::int`,
      failed: sql<number>`sum(case when ${importBatch.status} in ('FAILED','PARTIALLY_COMPLETED') then 1 else 0 end)::int`,
    })
    .from(importBatch);

  // Suppress unused variable warnings — values are embedded in SQL above
  void IN_PROGRESS_STATUSES;
  void FAILED_STATUSES;

  return {
    total: totals?.total ?? 0,
    inProgress: totals?.inProgress ?? 0,
    completed: totals?.completed ?? 0,
    failed: totals?.failed ?? 0,
  };
}

export async function getImportBatchList(opts: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  channel?: string;
}): Promise<{ batches: ImportBatchRow[]; total: number }> {
  const { page, pageSize, search, status, channel } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) conditions.push(eq(importBatch.status, status as 'CREATED' | 'FETCHING' | 'DEDUPLICATING' | 'TRANSFORMING' | 'IMPORTING' | 'COMPLETED' | 'FAILED' | 'PARTIALLY_COMPLETED'));
  if (channel) conditions.push(eq(importBatch.channel, channel as 'TWICELY' | 'EBAY' | 'POSHMARK' | 'MERCARI' | 'DEPOP' | 'FB_MARKETPLACE' | 'ETSY' | 'GRAILED' | 'THEREALREAL' | 'WHATNOT' | 'SHOPIFY' | 'VESTIAIRE'));
  if (search) {
    conditions.push(
      or(
        ilike(user.name, `%${search}%`),
        ilike(importBatch.id, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: importBatch.id,
      sellerName: user.name,
      channel: importBatch.channel,
      status: importBatch.status,
      totalItems: importBatch.totalItems,
      createdItems: importBatch.createdItems,
      failedItems: importBatch.failedItems,
      startedAt: importBatch.startedAt,
      completedAt: importBatch.completedAt,
      errorSummaryJson: importBatch.errorSummaryJson,
    })
    .from(importBatch)
    .leftJoin(user, eq(user.id, importBatch.sellerId))
    .where(whereClause)
    .limit(pageSize)
    .offset(offset);

  const [countRow] = await db
    .select({ total: count() })
    .from(importBatch)
    .leftJoin(user, eq(user.id, importBatch.sellerId))
    .where(whereClause);

  return {
    batches: rows.map((r) => ({
      id: r.id,
      sellerName: r.sellerName ?? 'Unknown',
      channel: r.channel,
      status: r.status,
      totalItems: r.totalItems,
      createdItems: r.createdItems,
      failedItems: r.failedItems,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      errorSummaryJson: r.errorSummaryJson,
    })),
    total: countRow?.total ?? 0,
  };
}

export async function getImportHealthStats(): Promise<ImportHealthStats> {
  // avgCompletionMs from completed batches only
  const [avgRow] = await db
    .select({
      avgCompletionMs: avg(
        sql<number>`extract(epoch from (${importBatch.completedAt} - ${importBatch.startedAt})) * 1000`
      ),
    })
    .from(importBatch)
    .where(eq(importBatch.status, 'COMPLETED'));

  // Success rate across all terminal batches
  const [rateRow] = await db
    .select({
      total: count(),
      completed: sql<number>`sum(case when ${importBatch.status} = 'COMPLETED' then 1 else 0 end)::int`,
    })
    .from(importBatch);

  const total = rateRow?.total ?? 0;
  const completed = rateRow?.completed ?? 0;
  const avgMs = avgRow?.avgCompletionMs ? Number(avgRow.avgCompletionMs) : null;

  return {
    avgCompletionMs: avgMs,
    successRatePercent: total > 0 ? Math.round((completed / total) * 100) : null,
  };
}
