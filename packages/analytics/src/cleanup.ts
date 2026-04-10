/**
 * @twicely/analytics — Cleanup / Retention
 *
 * Canonical 15 Section 12: Data retention and GDPR pseudonymization.
 * Events are append-only; snapshots retained per configurable period.
 */

import { db } from '@twicely/db';
import { analyticsEvent, metricSnapshot } from '@twicely/db/schema';
import { lt, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

/**
 * Purge old metric snapshots beyond retention period.
 * Default retention: 365 days (from `analytics.snapshot.retentionDays`).
 * Returns count of deleted snapshot rows.
 */
export async function purgeOldSnapshots(): Promise<{ deleted: number }> {
  const retentionDays = await getPlatformSetting<number>(
    'analytics.snapshot.retentionDays',
    365,
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await db
    .delete(metricSnapshot)
    .where(lt(metricSnapshot.periodEnd, cutoff));

  const deleted = (result as unknown as { count: number }).count;
  logger.info('analytics.snapshots.purged', { deleted, retentionDays });
  return { deleted };
}

/**
 * Pseudonymize old analytics events for GDPR compliance.
 * Replaces actorUserId with SHA-256 hash after retention period.
 * Does NOT delete events (they are append-only for audit trail).
 * Default retention: 730 days (from `analytics.event.retentionDays`).
 */
export async function pseudonymizeOldEvents(): Promise<{ affected: number }> {
  const retentionDays = await getPlatformSetting<number>(
    'analytics.event.retentionDays',
    730,
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await db
    .update(analyticsEvent)
    .set({
      actorUserId: sql`encode(sha256(${analyticsEvent.actorUserId}::bytea), 'hex')`,
      sessionId: null,
      ipHash: null,
    })
    .where(
      lt(analyticsEvent.occurredAt, cutoff),
    );

  const affected = (result as unknown as { count: number }).count;
  logger.info('analytics.events.pseudonymized', { affected, retentionDays });
  return { affected };
}
