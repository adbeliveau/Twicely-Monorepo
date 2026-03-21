/**
 * Data Retention Purge Job — G8.2
 *
 * Runs daily at 04:30 UTC.
 * Purges data that has exceeded its retention period across multiple categories.
 *
 * Gracefully skips tables that don't exist yet (future phases will create them).
 * Per Feature Lock-in section 40 and Platform Settings Canonical section 14.
 */

import { db } from '@twicely/db';
import { dataExportRequest } from '@twicely/db/schema';
import { and, lt, inArray } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { deleteFromR2, extractKeyFromUrl } from '@twicely/storage/r2-client';
import { logger } from '@twicely/logger';
import { upsertPlatformSetting } from '@twicely/jobs/cleanup-helpers';
import { sql } from 'drizzle-orm';

// Data export files expire after 7 days (hard-coded per spec)
const EXPORT_EXPIRY_DAYS = 7;

interface PurgeResult {
  category: string;
  purged: number;
  skipped?: string;
}

/**
 * Attempt to purge a table by raw SQL. Gracefully skips if table doesn't exist.
 */
async function purgeTableGracefully(
  tableName: string,
  columnName: string,
  cutoff: Date
): Promise<PurgeResult> {
  try {
    const result = await db.execute(
      sql`DELETE FROM ${sql.identifier(tableName)}
          WHERE ${sql.identifier(columnName)} < ${cutoff}`
    );
    const purged = result.count ?? 0;
    logger.info('[dataPurge] Purged table', { tableName, purged });
    return { category: tableName, purged };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Gracefully skip tables that don't exist yet
    if (msg.includes('does not exist') || msg.includes('undefined')) {
      logger.debug('[dataPurge] Table not yet created, skipping', { tableName });
      return { category: tableName, purged: 0, skipped: 'table not yet created' };
    }
    throw err;
  }
}

/**
 * Purge expired data export requests and delete their R2 files.
 */
async function purgeExpiredDataExports(): Promise<number> {
  const cutoff = new Date(Date.now() - EXPORT_EXPIRY_DAYS * 86400000);

  const expiredExports = await db
    .select({ id: dataExportRequest.id, downloadUrl: dataExportRequest.downloadUrl })
    .from(dataExportRequest)
    .where(
      and(
        inArray(dataExportRequest.status, ['COMPLETED', 'FAILED', 'EXPIRED']),
        lt(dataExportRequest.createdAt, cutoff)
      )
    )
    .limit(500);

  if (expiredExports.length === 0) return 0;

  // Delete R2 files for completed exports
  for (const exp of expiredExports) {
    if (exp.downloadUrl) {
      const key = extractKeyFromUrl(exp.downloadUrl);
      if (key) {
        try {
          await deleteFromR2(key);
        } catch (err) {
          logger.warn('[dataPurge] Could not delete R2 file', { key, err });
        }
      }
    }
  }

  const ids = expiredExports.map((e) => e.id);
  await db
    .delete(dataExportRequest)
    .where(inArray(dataExportRequest.id, ids));

  logger.info('[dataPurge] Purged expired data exports', { count: expiredExports.length });
  return expiredExports.length;
}

/**
 * Run all data retention purges.
 */
export async function runDataPurge(): Promise<void> {
  const now = new Date();

  const searchLogDays = await getPlatformSetting<number>(
    'retention.searchLogDays',
    90
  );
  const webhookLogDays = await getPlatformSetting<number>(
    'retention.webhookLogDays',
    90
  );
  const analyticsEventDays = await getPlatformSetting<number>(
    'retention.analyticsEventDays',
    365
  );
  const notificationLogDays = await getPlatformSetting<number>(
    'retention.notificationLogDays',
    180
  );

  const results: PurgeResult[] = [];

  // Search logs — table may not exist yet
  results.push(
    await purgeTableGracefully(
      'search_log',
      'created_at',
      new Date(Date.now() - searchLogDays * 86400000)
    )
  );

  // Webhook logs — table may not exist yet
  results.push(
    await purgeTableGracefully(
      'webhook_log',
      'created_at',
      new Date(Date.now() - webhookLogDays * 86400000)
    )
  );

  // Analytics events — table may not exist yet
  results.push(
    await purgeTableGracefully(
      'analytics_event',
      'created_at',
      new Date(Date.now() - analyticsEventDays * 86400000)
    )
  );

  // Notification logs — table may not exist yet
  results.push(
    await purgeTableGracefully(
      'notification_log',
      'created_at',
      new Date(Date.now() - notificationLogDays * 86400000)
    )
  );

  // Expired data exports (concrete table — always runs)
  const exportsPurged = await purgeExpiredDataExports();
  results.push({ category: 'data_export_request', purged: exportsPurged });

  const summary = results
    .map((r) => `${r.category}:${r.purged}`)
    .join(', ');

  logger.info('[dataPurge] Data purge complete', { results });

  await upsertPlatformSetting('cleanup.dataPurge.lastRunAt', now.toISOString());
  await upsertPlatformSetting('cleanup.dataPurge.lastResult', summary);
}
