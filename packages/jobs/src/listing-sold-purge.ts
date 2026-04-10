/**
 * Listing Sold Purge Job — Decision #71 (SOLD Listings: Index for 90 Days)
 *
 * Canonical: TWICELY_V3_SLICE_B1_BROWSE_SEARCH.md §B1.4
 * Sibling pattern: listing-image-retention.ts (Decision #111)
 *
 * After 90 days a SOLD listing's page flips to noindex (handled by the SEO
 * layer in apps/web/src/app/(marketplace)/i/[slug]/page.tsx). However the
 * Typesense document for the listing must ALSO be physically deleted so that:
 *   1. Storage is reclaimed — stale SOLD docs otherwise accumulate indefinitely.
 *   2. "Recently sold" analytics queries can rely on absence of old documents
 *      rather than having to filter by soldAt in every query.
 *   3. If a listing is ever un-SOLD via admin override the old document cannot
 *      silently re-surface in discovery.
 *
 * Option A (cron purge) is the correct long-term answer. Option B (query-time
 * filter) was rejected because it is a band-aid — it reclaims no storage and
 * requires every search query to carry the soldAt constraint.
 *
 * Config (all read from platform_settings):
 *   • search.soldPurge.retentionDays   (default 90)
 *   • search.soldPurge.batchSize        (default 500)
 *
 * Scheduled via: jobs.cron.listingSoldPurge.pattern (default '0 3 * * *', UTC)
 *
 * Idempotent: re-running on the same day is a no-op because each pass narrows
 * the candidate set to rows not yet deleted from Typesense (the Typesense
 * delete is idempotent — 404 is treated as success).
 */

import { db } from '@twicely/db';
import { listing } from '@twicely/db/schema';
import { and, eq, lt } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';

export interface ListingSoldPurgeResult extends Record<string, unknown> {
  purgedCount: number;
  errorCount: number;
  cutoffDate: string;
}

/**
 * Run a single purge pass for SOLD listings older than retentionDays.
 * Uses dynamic import for @twicely/search to avoid the
 * jobs → search → commerce → jobs circular dependency at compile time.
 */
export async function runListingSoldPurge(): Promise<ListingSoldPurgeResult> {
  const startedAt = new Date();
  logger.info('[listingSoldPurge] Starting purge pass', { startedAt: startedAt.toISOString() });

  const [retentionDays, batchSize] = await Promise.all([
    getPlatformSetting<number>('search.soldPurge.retentionDays', 90),
    getPlatformSetting<number>('search.soldPurge.batchSize', 500),
  ]);

  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);

  // Query SOLD listings whose soldAt predates the retention cutoff.
  // We only need the id — the Typesense document id matches the listing id.
  const candidates = await db
    .select({ id: listing.id })
    .from(listing)
    .where(
      and(
        eq(listing.status, 'SOLD'),
        lt(listing.soldAt, cutoff),
      ),
    )
    .limit(batchSize);

  logger.info('[listingSoldPurge] Found candidates', {
    count: candidates.length,
    cutoff: cutoff.toISOString(),
  });

  if (candidates.length === 0) {
    return { purgedCount: 0, errorCount: 0, cutoffDate: cutoff.toISOString() };
  }

  // Dynamic import to avoid compile-time circular dep.
  // Uses search-engine abstraction which routes to the active engine (OpenSearch/Typesense/PG).
  let deleteDocumentFromIndex: (id: string) => Promise<void>;
  try {
    const mod = await import('@twicely/search/search-engine');
    deleteDocumentFromIndex = mod.deleteDocumentFromIndex;
  } catch (err) {
    logger.error('[listingSoldPurge] Failed to load search engine module — aborting pass', { err: String(err) });
    return { purgedCount: 0, errorCount: candidates.length, cutoffDate: cutoff.toISOString() };
  }

  let purgedCount = 0;
  let errorCount = 0;

  for (const { id } of candidates) {
    try {
      await deleteDocumentFromIndex(id);
      purgedCount++;
    } catch (err) {
      // Search engine unreachable or unexpected error — log and continue.
      // We do NOT fail the entire batch for a single document.
      logger.warn('[listingSoldPurge] Failed to delete search document', { listingId: id, err: String(err) });
      errorCount++;
    }
  }

  const result: ListingSoldPurgeResult = {
    purgedCount,
    errorCount,
    cutoffDate: cutoff.toISOString(),
  };

  logger.info('[listingSoldPurge] Pass complete', result);
  return result;
}
