/**
 * Crosslister queries — data access layer for crosslister domain.
 * Source: F1.2 install prompt §2.8; F3 install prompt §3.6
 */

import { db } from '@twicely/db';
import {
  crosslisterAccount,
  importBatch,
  importRecord,
  channelProjection,
  crossJob,
  listing,
  listingImage,
} from '@twicely/db/schema';
import { eq, and, desc, count, asc, sql } from 'drizzle-orm';
import type { CrosslisterAccount, ImportBatch, ImportRecord, ChannelProjection, CrossJob } from '../crosslister/db-types';
import type { CanonicalListingData, CanonicalImageData } from '../crosslister/services/listing-transform';

/**
 * Get all connected channel accounts for a seller, ordered by channel name.
 */
export async function getConnectedAccounts(sellerId: string): Promise<CrosslisterAccount[]> {
  return db
    .select()
    .from(crosslisterAccount)
    .where(eq(crosslisterAccount.sellerId, sellerId))
    .orderBy(crosslisterAccount.channel);
}

/**
 * Get all import batches for a seller, ordered by createdAt DESC.
 */
export async function getImportBatches(sellerId: string): Promise<ImportBatch[]> {
  return db
    .select()
    .from(importBatch)
    .where(eq(importBatch.sellerId, sellerId))
    .orderBy(desc(importBatch.createdAt));
}

/**
 * Get a single import batch by ID with ownership check.
 */
export async function getImportBatchById(
  batchId: string,
  sellerId: string,
): Promise<ImportBatch | null> {
  const [row] = await db
    .select()
    .from(importBatch)
    .where(and(eq(importBatch.id, batchId), eq(importBatch.sellerId, sellerId)))
    .limit(1);

  return row ?? null;
}

/**
 * Get paginated import records for a batch.
 */
export async function getImportRecords(
  batchId: string,
  sellerId: string,
  options: { status?: string; page?: number; limit?: number } = {},
): Promise<{ records: ImportRecord[]; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, options.limit ?? 50);
  const offset = (page - 1) * limit;

  // Verify batch ownership
  const [batch] = await db
    .select({ sellerId: importBatch.sellerId })
    .from(importBatch)
    .where(and(eq(importBatch.id, batchId), eq(importBatch.sellerId, sellerId)))
    .limit(1);

  if (!batch) return { records: [], total: 0 };

  const query = db.select().from(importRecord).where(
    options.status
      ? and(eq(importRecord.batchId, batchId), eq(importRecord.status, options.status))
      : eq(importRecord.batchId, batchId),
  );

  const [records, [countRow]] = await Promise.all([
    query.limit(limit).offset(offset),
    db.select({ total: count() }).from(importRecord).where(
      options.status
        ? and(eq(importRecord.batchId, batchId), eq(importRecord.status, options.status))
        : eq(importRecord.batchId, batchId),
    ),
  ]);

  return { records, total: countRow?.total ?? 0 };
}

/**
 * Get count of active channel projections for a seller + channel.
 */
export async function getChannelProjectionCount(
  sellerId: string,
  channel: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.sellerId, sellerId),
        eq(channelProjection.channel, channel as 'EBAY'),
        eq(channelProjection.status, 'ACTIVE'),
      ),
    );
  return row?.total ?? 0;
}

export interface CrosslisterDashboardData {
  accounts: Array<CrosslisterAccount & { activeListingCount: number; latestBatch: ImportBatch | null }>;
}

/**
 * Get aggregated data for the crosslister dashboard:
 * connected accounts + latest import batch + active listing count per account.
 */
export async function getCrosslisterDashboardData(
  sellerId: string,
): Promise<CrosslisterDashboardData> {
  const accounts = await getConnectedAccounts(sellerId);
  const batches = await getImportBatches(sellerId);

  const enriched = await Promise.all(
    accounts.map(async (acc) => {
      const activeListingCount = await getChannelProjectionCount(sellerId, acc.channel);
      const latestBatch = batches.find((b) => b.accountId === acc.id) ?? null;
      return { ...acc, activeListingCount, latestBatch };
    }),
  );

  return { accounts: enriched };
}

/**
 * Get all channel projections for a specific listing (with ownership check).
 */
export async function getProjectionsForListing(
  listingId: string,
  sellerId: string,
): Promise<ChannelProjection[]> {
  return db
    .select()
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.listingId, listingId),
        eq(channelProjection.sellerId, sellerId),
      ),
    )
    .orderBy(asc(channelProjection.channel));
}

/**
 * Get all channel projections for a seller (paginated, filterable).
 * Joins with listing to include listing title for display.
 */
export async function getSellerProjections(
  sellerId: string,
  options: { channel?: string; status?: string; page?: number; limit?: number } = {},
): Promise<{ projections: Array<ChannelProjection & { listingTitle: string | null }>; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, options.limit ?? 50);
  const offset = (page - 1) * limit;

  const conditions = [eq(channelProjection.sellerId, sellerId)];
  if (options.channel) {
    conditions.push(eq(channelProjection.channel, options.channel as ChannelProjection['channel']));
  }
  if (options.status) {
    conditions.push(eq(channelProjection.status, options.status as ChannelProjection['status']));
  }
  const where = and(...conditions);

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: channelProjection.id,
        listingId: channelProjection.listingId,
        accountId: channelProjection.accountId,
        channel: channelProjection.channel,
        sellerId: channelProjection.sellerId,
        externalId: channelProjection.externalId,
        externalUrl: channelProjection.externalUrl,
        status: channelProjection.status,
        overridesJson: channelProjection.overridesJson,
        platformDataJson: channelProjection.platformDataJson,
        syncEnabled: channelProjection.syncEnabled,
        lastCanonicalHash: channelProjection.lastCanonicalHash,
        hasPendingSync: channelProjection.hasPendingSync,
        externalDiff: channelProjection.externalDiff,
        publishAttempts: channelProjection.publishAttempts,
        lastPublishError: channelProjection.lastPublishError,
        pollTier: channelProjection.pollTier,
        nextPollAt: channelProjection.nextPollAt,
        lastPolledAt: channelProjection.lastPolledAt,
        prePollTier: channelProjection.prePollTier,
        orphanedAt: channelProjection.orphanedAt,
        source: channelProjection.source,
        createdAt: channelProjection.createdAt,
        updatedAt: channelProjection.updatedAt,
        listingTitle: listing.title,
      })
      .from(channelProjection)
      .leftJoin(listing, eq(channelProjection.listingId, listing.id))
      .where(where)
      .orderBy(desc(channelProjection.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(channelProjection).where(where),
  ]);

  return { projections: rows, total: countRow?.total ?? 0 };
}

/**
 * Get pending/active cross jobs for a seller.
 */
export async function getSellerCrossJobs(
  sellerId: string,
  options: { status?: string; limit?: number } = {},
): Promise<CrossJob[]> {
  const limit = Math.min(200, options.limit ?? 50);
  const conditions = [eq(crossJob.sellerId, sellerId)];
  if (options.status) {
    conditions.push(eq(crossJob.status, options.status as CrossJob['status']));
  }

  return db
    .select()
    .from(crossJob)
    .where(and(...conditions))
    .orderBy(desc(crossJob.createdAt))
    .limit(limit);
}

export interface QueueStatusSummary {
  queued: number;
  inProgress: number;
  /** COUNT limited to last 24 hours */
  completed: number;
  /** COUNT limited to last 24 hours */
  failed: number;
}

/**
 * Get queue status counts for a seller across all crosslister jobs.
 * completed and failed counts are limited to the last 24 hours.
 */
export async function getSellerQueueStatus(sellerId: string): Promise<QueueStatusSummary> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [row] = await db
    .select({
      queued: sql<number>`COUNT(*) FILTER (WHERE ${crossJob.status} = 'QUEUED')::int`,
      inProgress: sql<number>`COUNT(*) FILTER (WHERE ${crossJob.status} = 'IN_PROGRESS')::int`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${crossJob.status} = 'COMPLETED' AND ${crossJob.completedAt} > ${dayAgo})::int`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${crossJob.status} = 'FAILED' AND ${crossJob.updatedAt} > ${dayAgo})::int`,
    })
    .from(crossJob)
    .where(eq(crossJob.sellerId, sellerId));

  return {
    queued: row?.queued ?? 0,
    inProgress: row?.inProgress ?? 0,
    completed: row?.completed ?? 0,
    failed: row?.failed ?? 0,
  };
}

/**
 * Get listing + images for the transform pipeline.
 * Returns null if listing not found or not owned by seller.
 */
export async function getListingForPublish(
  listingId: string,
  sellerId: string,
): Promise<{ listing: CanonicalListingData; images: CanonicalImageData[] } | null> {
  const [row] = await db
    .select({
      id: listing.id,
      ownerUserId: listing.ownerUserId,
      status: listing.status,
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      condition: listing.condition,
      brand: listing.brand,
      quantity: listing.quantity,
      weightOz: listing.weightOz,
      lengthIn: listing.lengthIn,
      widthIn: listing.widthIn,
      heightIn: listing.heightIn,
      freeShipping: listing.freeShipping,
      shippingCents: listing.shippingCents,
      attributesJson: listing.attributesJson,
      categoryId: listing.categoryId,
    })
    .from(listing)
    .where(and(eq(listing.id, listingId), eq(listing.ownerUserId, sellerId)))
    .limit(1);

  if (!row) return null;

  const images = await db
    .select({ url: listingImage.url, position: listingImage.position, isPrimary: listingImage.isPrimary })
    .from(listingImage)
    .where(eq(listingImage.listingId, listingId))
    .orderBy(asc(listingImage.position));

  return {
    listing: { ...row, attributesJson: row.attributesJson as Record<string, unknown> },
    images: images.map((img) => ({ url: img.url, position: img.position, isPrimary: img.isPrimary ?? false })),
  };
}
