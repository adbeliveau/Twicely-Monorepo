/**
 * Search Full Reindex Job — Phase 4 (Decision #143)
 *
 * Streams all ACTIVE listings from PostgreSQL, batches them into
 * bulk upserts to the search engine, tracks progress in searchIndexJob
 * and searchIndexVersion tables.
 *
 * Flow:
 *   1. Create a searchIndexJob record (PENDING → RUNNING)
 *   2. Create a versioned OpenSearch index
 *   3. Point the write alias to the new index
 *   4. Stream ACTIVE listings from PG, build ListingDocuments, bulk upsert
 *   5. Swap read alias to the new index
 *   6. Record searchIndexVersion, mark job COMPLETED
 *
 * Config (from platform_settings):
 *   search.reindex.batchSize      (default 500)
 *   search.reindex.concurrency    (default 3)
 *
 * Uses dynamic imports of @twicely/search to avoid circular deps.
 */

import { db } from '@twicely/db';
import {
  listing,
  listingImage,
  user,
  sellerProfile,
  sellerPerformance,
  category,
  searchIndexJob,
  searchIndexVersion,
} from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import { createQueue, createWorker } from './queue';

const QUEUE_NAME = 'search-full-reindex';

interface FullReindexJobData {
  triggeredByStaffId?: string;
  mappingVersion?: number;
}

export interface FullReindexResult {
  jobId: string;
  indexName: string;
  totalItems: number;
  succeededItems: number;
  failedItems: number;
  durationMs: number;
}

export const searchFullReindexQueue = createQueue<FullReindexJobData>(QUEUE_NAME, {
  defaultJobOptions: {
    attempts: 1, // Full reindex should not auto-retry — operator decides
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Run a full reindex of all ACTIVE listings into the search engine.
 */
export async function runFullReindex(
  triggeredByStaffId?: string,
  mappingVersion = 1,
): Promise<FullReindexResult> {
  const startedAt = new Date();
  const jobId = createId();

  logger.info('[search-full-reindex] Starting full reindex', { jobId });

  // 1. Create searchIndexJob record
  await db.insert(searchIndexJob).values({
    id: jobId,
    jobType: 'FULL_REINDEX',
    domain: 'listings',
    status: 'RUNNING',
    startedAt,
    triggeredByStaffId: triggeredByStaffId ?? null,
  });

  // Load config
  const [batchSize, concurrency] = await Promise.all([
    getPlatformSetting<number>('search.reindex.batchSize', 500),
    getPlatformSetting<number>('search.reindex.concurrency', 3),
  ]);

  // Determine engine — only proceed with OpenSearch reindex
  const engineSetting = await getPlatformSetting<string>('search.engine', 'typesense');

  let indexName = '';
  let totalItems = 0;
  let succeededItems = 0;
  let failedItems = 0;

  try {
    if (engineSetting === 'opensearch') {
      // 2. Create versioned OpenSearch index
      const { createVersionedIndex, swapWriteAlias, swapReadAlias } =
        await import('@twicely/search/opensearch-lifecycle');
      const { bulkUpsert } = await import('@twicely/search/opensearch-index');

      indexName = await createVersionedIndex(mappingVersion);
      logger.info('[search-full-reindex] Created new index', { indexName });

      // 3. Point write alias to new index
      await swapWriteAlias(indexName);

      // 4. Count total ACTIVE listings
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(listing)
        .where(eq(listing.status, 'ACTIVE'));
      totalItems = countResult[0]?.count ?? 0;

      await db
        .update(searchIndexJob)
        .set({ totalItems })
        .where(eq(searchIndexJob.id, jobId));

      // 5. Stream and batch upsert
      let offset = 0;
      const batchPromises: Promise<{ success: number; failed: number }>[] = [];

      while (true) {
        const rows = await loadListingBatch(offset, batchSize);
        if (rows.length === 0) break;

        const docs = rows.map(buildListingDocument);

        // Queue batch for bulk upsert
        batchPromises.push(bulkUpsert(docs as never));

        // Flush when concurrency limit is reached
        if (batchPromises.length >= concurrency) {
          const results = await Promise.all(batchPromises);
          for (const r of results) {
            succeededItems += r.success;
            failedItems += r.failed;
          }
          batchPromises.length = 0;

          // Update progress
          await db
            .update(searchIndexJob)
            .set({ succeededItems, failedItems })
            .where(eq(searchIndexJob.id, jobId));
        }

        offset += batchSize;
      }

      // Flush remaining batches
      if (batchPromises.length > 0) {
        const results = await Promise.all(batchPromises);
        for (const r of results) {
          succeededItems += r.success;
          failedItems += r.failed;
        }
      }

      // 6. Swap read alias to new index
      await swapReadAlias(indexName);
      logger.info('[search-full-reindex] Swapped read alias', { indexName });

      // Record the index version
      await db.insert(searchIndexVersion).values({
        id: createId(),
        domain: 'listings',
        physicalIndexName: indexName,
        mappingVersion,
        docCount: succeededItems,
        status: 'ACTIVE',
        isReadActive: true,
        isWriteActive: true,
      });

      // Mark previous versions as RETIRED
      await db
        .update(searchIndexVersion)
        .set({ isReadActive: false, isWriteActive: false, status: 'RETIRED', updatedAt: new Date() })
        .where(
          and(
            eq(searchIndexVersion.domain, 'listings'),
            eq(searchIndexVersion.isReadActive, true),
          ),
        );

    } else {
      // Typesense reindex — delegate to existing bulk sync
      const { bulkUpsertListings } = await import('@twicely/search/typesense-index');

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(listing)
        .where(eq(listing.status, 'ACTIVE'));
      totalItems = countResult[0]?.count ?? 0;

      await db
        .update(searchIndexJob)
        .set({ totalItems })
        .where(eq(searchIndexJob.id, jobId));

      let offset = 0;
      while (true) {
        const rows = await loadListingBatch(offset, batchSize);
        if (rows.length === 0) break;

        const docs = rows.map(buildListingDocument);
        const result = await bulkUpsertListings(docs as never);
        succeededItems += result.success;
        failedItems += result.failed;

        await db
          .update(searchIndexJob)
          .set({ succeededItems, failedItems })
          .where(eq(searchIndexJob.id, jobId));

        offset += batchSize;
      }

      indexName = 'typesense-collection';
    }

    // Mark job COMPLETED
    const completedAt = new Date();
    await db
      .update(searchIndexJob)
      .set({
        status: 'COMPLETED',
        succeededItems,
        failedItems,
        completedAt,
      })
      .where(eq(searchIndexJob.id, jobId));

    const durationMs = completedAt.getTime() - startedAt.getTime();
    const result: FullReindexResult = { jobId, indexName, totalItems, succeededItems, failedItems, durationMs };
    logger.info('[search-full-reindex] Complete', { ...result });
    return result;

  } catch (err) {
    // Mark job FAILED
    await db
      .update(searchIndexJob)
      .set({
        status: 'FAILED',
        errorSummary: err instanceof Error ? err.message : String(err),
        succeededItems,
        failedItems,
        completedAt: new Date(),
      })
      .where(eq(searchIndexJob.id, jobId));

    logger.error('[search-full-reindex] Failed', { jobId, error: String(err) });
    throw err;
  }
}

// ─── BullMQ Worker ────────────────────────────────────────────────────────────

export const searchFullReindexWorker = createWorker<FullReindexJobData>(
  QUEUE_NAME,
  async (job) => {
    await runFullReindex(job.data.triggeredByStaffId, job.data.mappingVersion);
  },
  1, // Single concurrent reindex — heavy operation
);

/**
 * Enqueue a full reindex job. Called from admin actions.
 */
export async function enqueueFullReindex(
  triggeredByStaffId?: string,
  mappingVersion?: number,
): Promise<void> {
  await searchFullReindexQueue.add(
    'full-reindex',
    { triggeredByStaffId, mappingVersion },
    { jobId: `full-reindex-${Date.now()}` },
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Load a batch of ACTIVE listings with all fields needed for a ListingDocument.
 */
async function loadListingBatch(
  offset: number,
  batchSize: number,
) {
  return db
    .select({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      brand: listing.brand,
      tags: listing.tags,
      categoryId: listing.categoryId,
      categoryName: category.name,
      categorySlug: category.slug,
      condition: listing.condition,
      fulfillmentType: listing.fulfillmentType,
      authenticationStatus: listing.authenticationStatus,
      freeShipping: listing.freeShipping,
      ownerUserId: listing.ownerUserId,
      storefrontCategoryId: listing.storefrontCategoryId,
      priceCents: listing.priceCents,
      originalPriceCents: listing.originalPriceCents,
      shippingCents: listing.shippingCents,
      availableQuantity: listing.availableQuantity,
      sellerScore: sellerProfile.sellerScore,
      sellerPerformanceBand: sellerPerformance.currentBand,
      sellerTotalReviews: sellerPerformance.totalReviews,
      sellerName: user.name,
      sellerUsername: user.username,
      sellerAvatarUrl: user.avatarUrl,
      sellerAverageRating: sellerPerformance.averageRating,
      sellerShowStars: sellerPerformance.showStars,
      boostPercent: listing.boostPercent,
      activatedAt: listing.activatedAt,
      createdAt: listing.createdAt,
      slug: listing.slug,
      dealBadgeType: listing.dealBadgeType,
      primaryImageUrl: listingImage.url,
      primaryImageAlt: listingImage.altText,
      sellerLat: sellerProfile.sellerLat,
      sellerLng: sellerProfile.sellerLng,
    })
    .from(listing)
    .leftJoin(category, eq(listing.categoryId, category.id))
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(listing.ownerUserId, sellerProfile.userId))
    .leftJoin(sellerPerformance, eq(sellerProfile.id, sellerPerformance.sellerProfileId))
    .leftJoin(
      listingImage,
      and(
        eq(listingImage.listingId, listing.id),
        eq(listingImage.isPrimary, true),
      ),
    )
    .where(eq(listing.status, 'ACTIVE'))
    .orderBy(listing.id) // Stable order for pagination
    .limit(batchSize)
    .offset(offset);
}

type ListingRow = Awaited<ReturnType<typeof loadListingBatch>>[number];

/**
 * Convert a listing DB row to the ListingDocument shape expected by
 * both Typesense and OpenSearch indexing functions.
 */
function buildListingDocument(row: ListingRow): Record<string, unknown> {
  return {
    id: row.id,
    title: row.title ?? '',
    description: row.description ?? undefined,
    brand: row.brand ?? undefined,
    tags: row.tags ?? [],
    categoryId: row.categoryId ?? undefined,
    categoryName: row.categoryName ?? undefined,
    categorySlug: row.categorySlug ?? undefined,
    condition: row.condition ?? undefined,
    fulfillmentType: row.fulfillmentType ?? undefined,
    authenticationStatus: row.authenticationStatus ?? undefined,
    freeShipping: row.freeShipping,
    ownerUserId: row.ownerUserId,
    storefrontCategoryId: row.storefrontCategoryId ?? undefined,
    priceCents: row.priceCents ?? 0,
    originalPriceCents: row.originalPriceCents ?? undefined,
    shippingCents: row.shippingCents ?? 0,
    availableQuantity: row.availableQuantity ?? 0,
    sellerScore: row.sellerScore ?? 0,
    sellerPerformanceBand: row.sellerPerformanceBand ?? undefined,
    sellerTotalReviews: row.sellerTotalReviews ?? 0,
    sellerName: row.sellerName ?? undefined,
    sellerUsername: row.sellerUsername ?? undefined,
    sellerAvatarUrl: row.sellerAvatarUrl ?? undefined,
    sellerAverageRating: row.sellerAverageRating ? Number(row.sellerAverageRating) : undefined,
    sellerShowStars: row.sellerShowStars ?? false,
    boostPercent: row.boostPercent ?? 0,
    activatedAt: row.activatedAt ? row.activatedAt.getTime() : Date.now(),
    createdAt: row.createdAt.getTime(),
    slug: row.slug ?? undefined,
    dealBadgeType: row.dealBadgeType ?? undefined,
    primaryImageUrl: row.primaryImageUrl ?? undefined,
    primaryImageAlt: row.primaryImageAlt ?? undefined,
    // Decision #144: city-level centroid for geo-proximity search
    sellerLocation: row.sellerLat != null && row.sellerLng != null
      ? [row.sellerLat, row.sellerLng]
      : undefined,
  };
}
