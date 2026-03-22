/**
 * Outbound sync service — propagates canonical listing changes to external channels.
 * Source: H3.4 install prompt §2.11; Lister Canonical §14.2
 *
 * When a seller edits their listing on Twicely:
 * 1. Canonical listing updated
 * 2. System computes hash of new canonical data
 * 3. Compares against each projection's lastCanonicalHash
 * 4. For projections where sync is enabled and hash differs -> queue SYNC job
 * 5. SYNC job transforms canonical data to platform format and pushes update
 *
 * Important: Syncs do NOT count as publishes (Lister Canonical §7.1).
 *
 * This service is channel-agnostic — works for Shopify AND any other channel
 * that supports updateListing.
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import * as crypto from 'crypto';
import { db } from '@twicely/db';
import { listing, listingImage, channelProjection, crossJob, crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getConnector } from '../connector-registry';
import { PRIORITY_SYNC } from '../queue/constants';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type { ExternalChannel } from '../types';

/** The canonical fields that matter for sync hash computation. */
export interface CanonicalListingData {
  title: string;
  description: string;
  priceCents: number;
  quantity: number;
  status: string;
  imageUrls: string[];  // sorted before hashing
}

/** A projection that needs outbound sync. */
export interface ProjectionSyncTarget {
  projectionId: string;
  channel: ExternalChannel;
  accountId: string;
}

/** Payload stored in crossJob for SYNC jobs. */
export type SyncJobPayload = {
  listingId: string;
  projectionId: string;
  channel: ExternalChannel;
  canonicalHash: string;
} & Record<string, unknown>;

/**
 * Compute a deterministic SHA-256 hash of the canonical listing fields that matter for sync.
 * Image URLs are sorted before hashing to ensure consistent results.
 */
export function computeCanonicalHash(listingData: CanonicalListingData): string {
  const sorted = {
    title: listingData.title,
    description: listingData.description,
    priceCents: listingData.priceCents,
    quantity: listingData.quantity,
    status: listingData.status,
    imageUrls: [...listingData.imageUrls].sort(),
  };
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

/**
 * Detect which projections need outbound sync after a listing update.
 *
 * Returns projections where:
 * - syncEnabled = true
 * - status = ACTIVE
 * - lastCanonicalHash differs from the current canonical hash
 */
export async function detectOutboundSyncNeeded(
  listingId: string,
): Promise<ProjectionSyncTarget[]> {
  // Load the canonical listing data
  const [listingRow] = await db
    .select({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      quantity: listing.quantity,
      status: listing.status,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    logger.warn('[outboundSync] detectOutboundSyncNeeded: listing not found', { listingId });
    return [];
  }

  // Load image URLs
  const images = await db
    .select({ url: listingImage.url })
    .from(listingImage)
    .where(eq(listingImage.listingId, listingId));

  const canonicalData: CanonicalListingData = {
    title: listingRow.title ?? '',
    description: listingRow.description ?? '',
    priceCents: listingRow.priceCents ?? 0,
    quantity: listingRow.quantity,
    status: listingRow.status,
    imageUrls: images.map((img) => img.url),
  };

  const canonicalHash = computeCanonicalHash(canonicalData);

  // Query active projections with sync enabled
  const projections = await db
    .select({
      id: channelProjection.id,
      channel: channelProjection.channel,
      accountId: channelProjection.accountId,
      lastCanonicalHash: channelProjection.lastCanonicalHash,
    })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.listingId, listingId),
        eq(channelProjection.syncEnabled, true),
        eq(channelProjection.status, 'ACTIVE'),
      ),
    );

  // Return only projections where the hash differs
  return projections
    .filter((proj) => proj.lastCanonicalHash !== canonicalHash)
    .map((proj) => ({
      projectionId: proj.id,
      channel: proj.channel as ExternalChannel,
      accountId: proj.accountId,
    }));
}

/**
 * Queue outbound SYNC jobs for projections that need syncing.
 * Uses idempotency key to prevent duplicate jobs.
 * Syncs do NOT count as publishes (Lister Canonical §7.1).
 */
export async function queueOutboundSync(
  listingId: string,
  projections: ProjectionSyncTarget[],
): Promise<void> {
  if (projections.length === 0) return;

  // Compute hash once for all projections
  const [listingRow] = await db
    .select({
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      quantity: listing.quantity,
      status: listing.status,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    logger.warn('[outboundSync] queueOutboundSync: listing not found', { listingId });
    return;
  }

  const images = await db
    .select({ url: listingImage.url })
    .from(listingImage)
    .where(eq(listingImage.listingId, listingId));

  const canonicalHash = computeCanonicalHash({
    title: listingRow.title ?? '',
    description: listingRow.description ?? '',
    priceCents: listingRow.priceCents ?? 0,
    quantity: listingRow.quantity,
    status: listingRow.status,
    imageUrls: images.map((img) => img.url),
  });

  for (const proj of projections) {
    const idempotencyKey = `sync-${proj.projectionId}-${canonicalHash}`;
    const payload: SyncJobPayload = {
      listingId,
      projectionId: proj.projectionId,
      channel: proj.channel,
      canonicalHash,
    };

    await db
      .insert(crossJob)
      .values({
        sellerId: await getSellerIdForProjection(proj.projectionId),
        projectionId: proj.projectionId,
        accountId: proj.accountId,
        jobType: 'SYNC',
        priority: PRIORITY_SYNC,
        idempotencyKey,
        payload: payload as Record<string, unknown>,
      })
      .onConflictDoNothing();

    logger.info('[outboundSync] SYNC job queued', {
      listingId,
      projectionId: proj.projectionId,
      channel: proj.channel,
      idempotencyKey,
    });
  }
}

/** Look up sellerId for a projection (needed for crossJob.sellerId). */
async function getSellerIdForProjection(projectionId: string): Promise<string> {
  const [proj] = await db
    .select({ sellerId: channelProjection.sellerId })
    .from(channelProjection)
    .where(eq(channelProjection.id, projectionId))
    .limit(1);
  return proj?.sellerId ?? '';
}

/**
 * Execute an outbound sync job.
 * Transforms canonical listing data to platform format and pushes update via connector.
 * On success, updates projection's lastCanonicalHash and clears hasPendingSync.
 */
export async function executeOutboundSync(job: SyncJobPayload): Promise<void> {
  const { listingId, projectionId, channel, canonicalHash } = job;

  // Load canonical listing data
  const [listingRow] = await db
    .select({
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      quantity: listing.quantity,
      status: listing.status,
      condition: listing.condition,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    logger.warn('[outboundSync] executeOutboundSync: listing not found', { listingId });
    return;
  }

  const handlingTimeDays = await getPlatformSetting<number>('fulfillment.shipping.defaultHandlingDays', 3);

  // Load projection and account
  const [proj] = await db
    .select({
      id: channelProjection.id,
      externalId: channelProjection.externalId,
      accountId: channelProjection.accountId,
    })
    .from(channelProjection)
    .where(eq(channelProjection.id, projectionId))
    .limit(1);

  if (!proj || !proj.externalId) {
    logger.warn('[outboundSync] executeOutboundSync: projection not found or no externalId', {
      projectionId,
    });
    return;
  }

  const [account] = await db
    .select()
    .from(crosslisterAccount)
    .where(eq(crosslisterAccount.id, proj.accountId))
    .limit(1);

  if (!account) {
    logger.warn('[outboundSync] executeOutboundSync: account not found', {
      accountId: proj.accountId,
    });
    return;
  }

  // Get connector for the channel
  const connector = getConnector(channel);
  if (!connector) {
    logger.warn('[outboundSync] executeOutboundSync: connector not found', { channel });
    return;
  }

  // Transform canonical data to platform format
  const changes = {
    title: listingRow.title ?? '',
    description: listingRow.description ?? '',
    descriptionHtml: null,
    priceCents: listingRow.priceCents ?? 0,
    quantity: listingRow.quantity,
    condition: listingRow.condition ?? 'USED',
    category: { externalCategoryId: '', externalCategoryName: '', path: [] },
    brand: null,
    images: [],
    itemSpecifics: {},
    shipping: { type: 'FREE' as const, flatRateCents: null, weightOz: null, dimensions: null, handlingTimeDays },
  };

  try {
    const result = await connector.updateListing(account, proj.externalId, changes);

    if (result.success) {
      // Update projection hash and clear pending sync flag
      await db
        .update(channelProjection)
        .set({
          lastCanonicalHash: canonicalHash,
          hasPendingSync: false,
          updatedAt: new Date(),
        })
        .where(eq(channelProjection.id, projectionId));

      logger.info('[outboundSync] executeOutboundSync: sync completed', {
        listingId,
        projectionId,
        channel,
      });
    } else {
      logger.error('[outboundSync] executeOutboundSync: connector update failed', {
        listingId,
        projectionId,
        channel,
        error: result.error,
      });
    }
  } catch (err) {
    logger.error('[outboundSync] executeOutboundSync: unexpected error', {
      listingId,
      projectionId,
      channel,
      error: String(err),
    });
    throw err;
  }
}
