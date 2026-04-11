/**
 * Search Index Sync Worker — Phase 4 (Decision #143)
 *
 * BullMQ queue for search index operations: upsert, delete, partial-update,
 * bulk-upsert. Routes all operations through @twicely/search/search-engine
 * which handles engine selection and dual-write.
 *
 * Uses dynamic imports of @twicely/search to avoid the
 * jobs → search → commerce → jobs circular dependency at compile time.
 *
 * Config:
 *   Worker concurrency: 5
 *   Retries: 3 with exponential backoff
 *   Queue: 'search-index-sync'
 */

import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { createQueue, createWorker } from './queue';

const QUEUE_NAME = 'search-index-sync';

export type SearchIndexJobType = 'upsert' | 'delete' | 'partial-update' | 'bulk-upsert';

export interface SearchIndexJobData {
  type: SearchIndexJobType;
  /** Listing ID for single-doc operations. */
  listingId?: string;
  /** Full document for upsert. */
  document?: Record<string, unknown>;
  /** Partial fields for partial-update. */
  fields?: Record<string, unknown>;
  /** Array of documents for bulk-upsert. */
  documents?: Array<Record<string, unknown>>;
}

export const searchIndexSyncQueue = createQueue<SearchIndexJobData>(QUEUE_NAME, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

/**
 * Process a single search index sync job.
 * Dynamically imports @twicely/search to avoid circular deps.
 */
export async function processSearchIndexJob(data: SearchIndexJobData): Promise<void> {
  const { indexDocument, deleteDocumentFromIndex, partialUpdateDocument } =
    await import('@twicely/search/search-engine');

  switch (data.type) {
    case 'upsert': {
      if (!data.document) {
        logger.warn('[search-index-sync] upsert job missing document');
        return;
      }
      // Decision #144: enrich with sellerLocation if not already present
      if (!data.document.sellerLocation && data.document.ownerUserId) {
        const loc = await lookupSellerLocation(String(data.document.ownerUserId));
        if (loc) data.document.sellerLocation = loc;
      }
      await indexDocument(data.document as never);
      break;
    }

    case 'delete': {
      if (!data.listingId) {
        logger.warn('[search-index-sync] delete job missing listingId');
        return;
      }
      await deleteDocumentFromIndex(data.listingId);
      break;
    }

    case 'partial-update': {
      if (!data.listingId || !data.fields) {
        logger.warn('[search-index-sync] partial-update job missing listingId or fields');
        return;
      }
      await partialUpdateDocument(data.listingId, data.fields as never);
      break;
    }

    case 'bulk-upsert': {
      if (!data.documents || data.documents.length === 0) {
        logger.warn('[search-index-sync] bulk-upsert job has no documents');
        return;
      }
      // Bulk upsert processes each document through the engine router
      // for dual-write support
      for (const doc of data.documents) {
        await indexDocument(doc as never);
      }
      break;
    }

    default:
      logger.warn('[search-index-sync] Unknown job type', { type: data.type });
  }
}

/**
 * Create the search index sync worker.
 * Concurrency: 5 (parallel job processing).
 */
export const searchIndexSyncWorker = createWorker<SearchIndexJobData>(
  QUEUE_NAME,
  async (job) => {
    logger.info('[search-index-sync] Processing job', {
      jobId: job.id,
      type: job.data.type,
      attempt: job.attemptsMade + 1,
    });

    await processSearchIndexJob(job.data);

    logger.info('[search-index-sync] Job complete', {
      jobId: job.id,
      type: job.data.type,
    });
  },
  5,
);

// ─── Convenience Enqueue Functions ──────────────────────────────────────────────

/**
 * Enqueue a document upsert into the search index.
 * Called by listing server actions instead of direct indexing.
 */
export async function enqueueSearchIndexUpsert(
  document: Record<string, unknown>,
): Promise<void> {
  await searchIndexSyncQueue.add(
    `upsert:${String(document.id ?? 'unknown')}`,
    { type: 'upsert', document },
  );
}

/**
 * Enqueue a document deletion from the search index.
 */
export async function enqueueSearchIndexDelete(listingId: string): Promise<void> {
  await searchIndexSyncQueue.add(
    `delete:${listingId}`,
    { type: 'delete', listingId },
  );
}

/**
 * Enqueue a partial field update to the search index.
 */
export async function enqueueSearchIndexPartialUpdate(
  listingId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await searchIndexSyncQueue.add(
    `partial-update:${listingId}`,
    { type: 'partial-update', listingId, fields },
  );
}

/**
 * Enqueue a bulk upsert of documents to the search index.
 * Used by the full reindex job to push batches through the engine router.
 */
export async function enqueueSearchIndexBulkUpsert(
  documents: Array<Record<string, unknown>>,
): Promise<void> {
  await searchIndexSyncQueue.add(
    `bulk-upsert:${documents.length}-docs`,
    { type: 'bulk-upsert', documents },
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Look up seller lat/lng for geo-proximity search (Decision #144).
 * Returns [lat, lng] tuple or null if seller has no geocoded location.
 */
async function lookupSellerLocation(ownerUserId: string): Promise<[number, number] | null> {
  try {
    const [profile] = await db
      .select({ sellerLat: sellerProfile.sellerLat, sellerLng: sellerProfile.sellerLng })
      .from(sellerProfile)
      .where(eq(sellerProfile.userId, ownerUserId))
      .limit(1);
    if (profile?.sellerLat != null && profile?.sellerLng != null) {
      return [profile.sellerLat, profile.sellerLng];
    }
    return null;
  } catch {
    return null;
  }
}
