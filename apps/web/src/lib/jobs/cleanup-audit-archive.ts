/**
 * Audit Archive Job — G8.2
 *
 * Runs monthly on the 1st at 03:00 UTC.
 * Archives audit_event rows older than retention threshold to R2,
 * then deletes them.
 *
 * Per Feature Lock-in section 39 and 40.
 * Setting: audit.retentionMonths (default 24)
 * Setting: audit.archiveBeforePurge (default true)
 *
 * Archive format: audit-archives/{year}/{month}/audit-events-{year}-{month}.json.gz
 */

import { db } from '@twicely/db';
import { auditEvent } from '@twicely/db/schema';
import { lt } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { uploadToR2 } from '@twicely/storage/r2-client';
import { logger } from '@twicely/logger';
import { upsertPlatformSetting } from '@twicely/jobs/cleanup-helpers';
import { createGzip } from 'zlib';

async function compressJson(data: unknown): Promise<Buffer> {
  const jsonStr = JSON.stringify(data);
  const buf = Buffer.from(jsonStr, 'utf-8');
  return new Promise((resolve, reject) => {
    const gz = createGzip();
    const chunks: Buffer[] = [];
    gz.on('data', (chunk: Buffer) => chunks.push(chunk));
    gz.on('end', () => resolve(Buffer.concat(chunks)));
    gz.on('error', reject);
    gz.end(buf);
  });
}

/**
 * Archive old audit events to R2 then delete them from the DB.
 */
export async function runAuditArchive(): Promise<void> {
  const now = new Date();

  const retentionMonths = await getPlatformSetting<number>(
    'audit.retentionMonths',
    24
  );

  const archiveBeforePurge = await getPlatformSetting<boolean>(
    'audit.archiveBeforePurge',
    true
  );

  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);

  // Fetch events older than cutoff (batched to avoid OOM)
  const events = await db
    .select()
    .from(auditEvent)
    .where(lt(auditEvent.createdAt, cutoff))
    .limit(10000);

  if (events.length === 0) {
    logger.info('[auditArchive] No events to archive', { retentionMonths });
    await upsertPlatformSetting('cleanup.auditArchive.lastRunAt', now.toISOString());
    await upsertPlatformSetting('cleanup.auditArchive.lastResult', 'No events to archive');
    return;
  }

  if (archiveBeforePurge) {
    // Group by year/month and upload one file per period
    const byPeriod = new Map<string, typeof events>();
    for (const ev of events) {
      const d = new Date(ev.createdAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const group = byPeriod.get(key) ?? [];
      group.push(ev);
      byPeriod.set(key, group);
    }

    for (const [period, periodEvents] of byPeriod) {
      const [year, month] = period.split('-');
      const r2Key = `audit-archives/${year}/${month}/audit-events-${period}.json.gz`;

      const compressed = await compressJson(periodEvents);
      await uploadToR2(r2Key, compressed, 'application/gzip');
      logger.info('[auditArchive] Archived period to R2', {
        period,
        count: periodEvents.length,
        r2Key,
      });
    }
  }

  // Delete archived rows — system-level operation bypassing INSERT-only constraint
  const eventIds = events.map((e) => e.id);
  const { sql } = await import('drizzle-orm');
  // Delete in batches of 1000 to avoid query size limits
  let deleted = 0;
  for (let i = 0; i < eventIds.length; i += 1000) {
    const batch = eventIds.slice(i, i + 1000);
    // Use raw SQL to bypass application-level immutability enforcement
    await db.execute(
      sql`DELETE FROM audit_event WHERE id IN (SELECT unnest(ARRAY[${sql.join(batch.map(id => sql`${id}`), sql`, `)}]::text[]))`
    );
    deleted += batch.length;
  }

  logger.info('[auditArchive] Archived and purged audit events', {
    archived: events.length,
    deleted,
  });

  await upsertPlatformSetting('cleanup.auditArchive.lastRunAt', now.toISOString());
  await upsertPlatformSetting(
    'cleanup.auditArchive.lastResult',
    `Archived ${events.length} events, deleted ${deleted}`
  );
}
