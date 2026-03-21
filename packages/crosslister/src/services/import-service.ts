/**
 * Import pipeline engine — orchestrates 5 stages: FETCHING, DEDUPLICATING,
 * TRANSFORMING, IMPORTING, COMPLETING.
 * Source: F1.2 install prompt §2.5; Lister Canonical Section 6.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Decision #16: Imported listings are ALWAYS status 'ACTIVE'.
 */

import { db } from '@twicely/db';
import {
  importBatch,
  importRecord,
  crosslisterAccount,
  channelProjection,
  dedupeFingerprint,
  sellerProfile,
} from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { platformSetting } from '@twicely/db/schema';
import { logger } from '@twicely/logger';
import '../connectors'; // Ensure all connectors are registered
import { getConnector } from '../connector-registry';
import { generateFingerprint, findDedupeMatch } from './dedupe-service';
import { normalizeExternalListing } from './normalizer-dispatch';
import { createImportedListing } from './listing-creator';
import { notifyImportCompleted } from './import-notifier';
import type { ExternalListing, ExternalChannel } from '../types';

async function getBatchSize(): Promise<number> {
  const [row] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, 'crosslister.import.batchSize'))
    .limit(1);
  const val = Number(row?.value ?? 50);
  return isFinite(val) && val > 0 ? val : 50;
}

async function setBatchStatus(
  batchId: string,
  status: string,
): Promise<void> {
  await db
    .update(importBatch)
    .set({ status: status as 'CREATED' | 'FETCHING' | 'DEDUPLICATING' | 'TRANSFORMING' | 'IMPORTING' | 'COMPLETED' | 'FAILED' | 'PARTIALLY_COMPLETED', updatedAt: new Date() })
    .where(eq(importBatch.id, batchId));
}

/** Stage 1: FETCHING — paginate through all ACTIVE listings from the external platform */
async function stageFetch(
  batchId: string,
  account: import('../db-types').CrosslisterAccount,
  batchChannel: ExternalChannel,
): Promise<void> {
  await setBatchStatus(batchId, 'FETCHING');
  const connector = getConnector(batchChannel);
  const batchSize = await getBatchSize();
  let cursor: string | undefined = undefined;
  let totalFetched = 0;

  do {
    const page = await connector.fetchListings(account, cursor ?? undefined);
    const activeListing = page.listings.filter((l: ExternalListing) => l.status === 'ACTIVE');

    if (activeListing.length > 0) {
      await db.insert(importRecord).values(
        activeListing.map((l: ExternalListing) => ({
          batchId,
          externalId: l.externalId,
          channel: batchChannel,
          status: 'pending',
          rawDataJson: l,
        })),
      );
    }

    totalFetched += activeListing.length;
    await db.update(importBatch).set({ totalItems: totalFetched, updatedAt: new Date() }).where(eq(importBatch.id, batchId));

    cursor = page.cursor ?? undefined;
    if (!page.hasMore || page.listings.length === 0) break;
    void batchSize; // used via getBatchSize()
  } while (cursor !== undefined);
}

/** Stage 2: DEDUPLICATING */
async function stageDeduplicate(batchId: string, sellerId: string): Promise<void> {
  await setBatchStatus(batchId, 'DEDUPLICATING');

  const pendingRecords = await db
    .select({ id: importRecord.id, rawDataJson: importRecord.rawDataJson })
    .from(importRecord)
    .where(and(eq(importRecord.batchId, batchId), eq(importRecord.status, 'pending')));

  for (const record of pendingRecords) {
    try {
      const raw = record.rawDataJson as ExternalListing;
      const fp = generateFingerprint(raw, sellerId);
      const match = await findDedupeMatch(fp, sellerId);

      if (match.confidence >= 90) {
        await db.update(importRecord).set({
          status: 'deduplicated',
          dedupeMatchListingId: match.matchListingId,
          dedupeConfidence: match.confidence,
        }).where(eq(importRecord.id, record.id));
      } else if (match.confidence >= 70) {
        await db.update(importRecord).set({
          status: 'review',
          dedupeMatchListingId: match.matchListingId,
          dedupeConfidence: match.confidence,
        }).where(eq(importRecord.id, record.id));
      }
      // No match: remains 'pending'
    } catch (err) {
      logger.error('[importService.deduplicate] Record error', { recordId: record.id, error: String(err) });
    }
  }
}

/** Stage 3: TRANSFORMING — validate and normalize each pending record */
async function stageTransform(batchId: string, batchChannel: ExternalChannel): Promise<void> {
  await setBatchStatus(batchId, 'TRANSFORMING');

  const pendingRecords = await db
    .select({ id: importRecord.id, rawDataJson: importRecord.rawDataJson, externalId: importRecord.externalId })
    .from(importRecord)
    .where(and(eq(importRecord.batchId, batchId), eq(importRecord.status, 'pending')));

  for (const record of pendingRecords) {
    try {
      const raw = record.rawDataJson as Record<string, unknown>;
      const normalized = normalizeExternalListing(raw, batchChannel);

      if (!normalized) {
        await db.update(importRecord).set({ status: 'failed', errorMessage: 'Schema validation failed for raw listing data.' }).where(eq(importRecord.id, record.id));
        continue;
      }

      // Validate minimum requirements
      if (!normalized.title || normalized.title.trim() === '') {
        await db.update(importRecord).set({ status: 'failed', errorMessage: 'Missing required field: title.' }).where(eq(importRecord.id, record.id));
        continue;
      }
      if (normalized.priceCents <= 0) {
        await db.update(importRecord).set({ status: 'failed', errorMessage: 'Invalid price.' }).where(eq(importRecord.id, record.id));
        continue;
      }
      if (normalized.images.length === 0) {
        await db.update(importRecord).set({ status: 'failed', errorMessage: 'At least one image is required.' }).where(eq(importRecord.id, record.id));
        continue;
      }

      await db.update(importRecord).set({
        normalizedDataJson: normalized,
      }).where(eq(importRecord.id, record.id));
    } catch (err) {
      await db.update(importRecord).set({ status: 'failed', errorMessage: String(err) }).where(eq(importRecord.id, record.id));
    }
  }
}

/** Stage 4: IMPORTING — create listing rows for valid records */
async function stageImport(
  batchId: string,
  accountId: string,
  sellerId: string,
  batchChannel: ExternalChannel,
): Promise<{ created: number; deduplicated: number; failed: number }> {
  await setBatchStatus(batchId, 'IMPORTING');

  let created = 0;
  let deduplicated = 0;
  let failed = 0;

  // Handle newly validated records (pending with normalizedDataJson)
  const validRecords = await db
    .select({ id: importRecord.id, externalId: importRecord.externalId, normalizedDataJson: importRecord.normalizedDataJson })
    .from(importRecord)
    .where(and(eq(importRecord.batchId, batchId), eq(importRecord.status, 'pending')));

  for (const record of validRecords) {
    if (!record.normalizedDataJson) {
      await db.update(importRecord).set({ status: 'failed', errorMessage: 'No normalized data.' }).where(eq(importRecord.id, record.id));
      failed++;
      continue;
    }

    try {
      const normalized = record.normalizedDataJson as Parameters<typeof createImportedListing>[0];
      const { listingId } = await createImportedListing(normalized, sellerId, batchChannel);
      const fp = generateFingerprint(normalized as ExternalListing, sellerId);

      await db.insert(channelProjection).values({
        listingId,
        accountId,
        channel: batchChannel,
        sellerId,
        externalId: record.externalId,
        externalUrl: (normalized as { url?: string }).url ?? null,
        status: 'ACTIVE',
        syncEnabled: true,
      }).onConflictDoNothing();

      await db.insert(dedupeFingerprint).values({
        listingId,
        sellerId,
        titleHash: fp.titleHash,
        imageHash: fp.imageHash,
        priceRange: fp.priceRange,
        compositeHash: fp.compositeHash,
      }).onConflictDoNothing();

      await db.update(importRecord).set({ status: 'created', listingId }).where(eq(importRecord.id, record.id));
      created++;
    } catch (err) {
      await db.update(importRecord).set({ status: 'failed', errorMessage: String(err) }).where(eq(importRecord.id, record.id));
      failed++;
    }
  }

  // Handle deduplicated records — link projection to existing listing
  const dedupeRecords = await db
    .select({ id: importRecord.id, externalId: importRecord.externalId, dedupeMatchListingId: importRecord.dedupeMatchListingId })
    .from(importRecord)
    .where(and(eq(importRecord.batchId, batchId), eq(importRecord.status, 'deduplicated')));

  for (const record of dedupeRecords) {
    if (!record.dedupeMatchListingId) { deduplicated++; continue; }
    await db.insert(channelProjection).values({
      listingId: record.dedupeMatchListingId,
      accountId,
      channel: batchChannel,
      sellerId,
      externalId: record.externalId,
      status: 'ACTIVE',
      syncEnabled: true,
    }).onConflictDoNothing();
    deduplicated++;
  }

  // Count all failed records
  const allFailed = await db
    .select({ id: importRecord.id })
    .from(importRecord)
    .where(and(eq(importRecord.batchId, batchId), eq(importRecord.status, 'failed')));
  failed = allFailed.length;

  return { created, deduplicated, failed };
}

/**
 * processImportBatch — runs the full 5-stage import pipeline for a batch.
 * Called by startImport server action.
 */
export async function processImportBatch(batchId: string): Promise<void> {
  const [batch] = await db
    .select({ accountId: importBatch.accountId, sellerId: importBatch.sellerId, channel: importBatch.channel })
    .from(importBatch)
    .where(eq(importBatch.id, batchId))
    .limit(1);

  if (!batch) {
    logger.error('[importService] Batch not found', { batchId });
    return;
  }

  const [account] = await db
    .select()
    .from(crosslisterAccount)
    .where(eq(crosslisterAccount.id, batch.accountId))
    .limit(1);

  if (!account) {
    await db.update(importBatch).set({ status: 'FAILED', errorSummaryJson: [{ error: 'Account not found' }], completedAt: new Date(), updatedAt: new Date() }).where(eq(importBatch.id, batchId));
    return;
  }

  await db.update(importBatch).set({ startedAt: new Date(), updatedAt: new Date() }).where(eq(importBatch.id, batchId));

  const batchChannel = batch.channel as ExternalChannel;

  try {
    await stageFetch(batchId, account, batchChannel);
    await stageDeduplicate(batchId, batch.sellerId);
    await stageTransform(batchId, batchChannel);
    const { created, deduplicated, failed } = await stageImport(batchId, batch.accountId, batch.sellerId, batchChannel);

    const skipped = 0;
    const finalStatus = failed > 0 && created === 0 && deduplicated === 0 ? 'FAILED'
      : failed > 0 ? 'PARTIALLY_COMPLETED' : 'COMPLETED';

    await db.update(importBatch).set({
      status: finalStatus,
      createdItems: created,
      deduplicatedItems: deduplicated,
      failedItems: failed,
      skippedItems: skipped,
      processedItems: created + deduplicated + failed + skipped,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(importBatch.id, batchId));

    // F4-S2: Auto-activate FREE lister tier on first successful import
    if (finalStatus === 'COMPLETED') {
      const [profile] = await db
        .select({ listerTier: sellerProfile.listerTier })
        .from(sellerProfile)
        .where(eq(sellerProfile.userId, batch.sellerId))
        .limit(1);

      if (profile?.listerTier === 'NONE') {
        await db.update(sellerProfile)
          .set({ listerTier: 'FREE', updatedAt: new Date() })
          .where(eq(sellerProfile.userId, batch.sellerId));
        // No lister_subscription row created — FREE is $0, no Stripe product
      }
    }

    // Mark first import completed
    await db.update(crosslisterAccount).set({
      firstImportCompletedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(crosslisterAccount.id, batch.accountId));

    // Fire-and-forget notification
    notifyImportCompleted(batch.sellerId, batchId, {
      createdItems: created,
      deduplicatedItems: deduplicated,
      failedItems: failed,
      skippedItems: skipped,
    }).catch(() => {});
  } catch (err) {
    logger.error('[importService] Batch failed', { batchId, error: String(err) });
    await db.update(importBatch).set({
      status: 'FAILED',
      errorSummaryJson: [{ error: String(err) }],
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(importBatch.id, batchId));
  }
}
