/**
 * Job executor — connector execution logic for CREATE/UPDATE/DELIST jobs.
 * Called by the BullMQ worker after picking up a job from lister:publish.
 * Source: F3.1 install prompt §3.5
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import {
  channelProjection,
  crossJob,
  crosslisterAccount,
  channelCategoryMapping,
} from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getConnector } from '../connector-registry';
import { transformListingForChannel } from '@twicely/crosslister/services/listing-transform';
import { getListingForPublish } from '@/lib/queries/crosslister';
import { recordSuccess, recordFailure } from '../queue/circuit-breaker';
import type { ExternalChannel, ExternalCategoryMapping } from '../types';
import type { ChannelOverrides } from '@twicely/crosslister/services/listing-transform';

export interface JobExecutionResult {
  success: boolean;
  externalId: string | null;
  externalUrl: string | null;
  error?: string;
  retryable: boolean;
}

async function getCategoryMapping(
  channel: ExternalChannel,
  categoryId: string | null,
): Promise<ExternalCategoryMapping | null> {
  if (!categoryId) return null;
  const [row] = await db
    .select({
      externalCategoryId: channelCategoryMapping.externalCategoryId,
      externalCategoryName: channelCategoryMapping.externalCategoryName,
    })
    .from(channelCategoryMapping)
    .where(
      and(
        eq(channelCategoryMapping.channel, channel),
        eq(channelCategoryMapping.twicelyCategoryId, categoryId),
      ),
    )
    .limit(1);

  return row
    ? { externalCategoryId: row.externalCategoryId, externalCategoryName: row.externalCategoryName, path: [] }
    : null;
}

/**
 * Execute a CREATE publish job. Called by the BullMQ worker.
 * Loads listing, transforms, calls connector.createListing().
 */
export async function executeCreateJob(
  crossJobId: string,
  listingId: string,
  channel: ExternalChannel,
  sellerId: string,
  accountId: string,
  projectionId: string,
  overrides: ChannelOverrides | null,
): Promise<JobExecutionResult> {
  const data = await getListingForPublish(listingId, sellerId);
  if (!data) {
    return { success: false, externalId: null, externalUrl: null, error: 'Listing not found.', retryable: false };
  }

  const [accountRow] = await db
    .select()
    .from(crosslisterAccount)
    .where(eq(crosslisterAccount.id, accountId))
    .limit(1);

  if (!accountRow) {
    return { success: false, externalId: null, externalUrl: null, error: 'Account not found.', retryable: false };
  }

  const categoryMapping = await getCategoryMapping(channel, data.listing.categoryId);

  const transformed = transformListingForChannel({
    listing: data.listing,
    images: data.images,
    channel,
    overrides,
    categoryMapping,
    handlingTimeDays: 3,
  });

  try {
    const connector = getConnector(channel);
    const result = await connector.createListing(accountRow, transformed);

    if (result.success) {
      recordSuccess(channel);
      await db.update(channelProjection).set({
        status: 'ACTIVE',
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        updatedAt: new Date(),
      }).where(eq(channelProjection.id, projectionId));

      await db.update(crossJob).set({
        status: 'COMPLETED',
        completedAt: new Date(),
        result: { externalId: result.externalId, externalUrl: result.externalUrl } as Record<string, unknown>,
        updatedAt: new Date(),
      }).where(eq(crossJob.id, crossJobId));

      return { success: true, externalId: result.externalId, externalUrl: result.externalUrl, retryable: false };
    }

    if (!result.retryable) {
      recordFailure(channel);
      await db.update(channelProjection).set({
        status: 'ERROR',
        lastPublishError: result.error ?? null,
        updatedAt: new Date(),
      }).where(eq(channelProjection.id, projectionId));
    }

    return {
      success: false,
      externalId: null,
      externalUrl: null,
      error: result.error,
      retryable: result.retryable,
    };
  } catch (err) {
    recordFailure(channel);
    logger.error('[jobExecutor] executeCreateJob threw', { crossJobId, listingId, channel, error: String(err) });
    return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
  }
}

/**
 * Execute an UPDATE/SYNC job. Called by the BullMQ worker.
 * Loads listing, transforms changes, calls connector.updateListing().
 */
export async function executeUpdateJob(
  crossJobId: string,
  listingId: string,
  channel: ExternalChannel,
  sellerId: string,
  accountId: string,
  projectionId: string,
  externalId: string,
): Promise<JobExecutionResult> {
  const data = await getListingForPublish(listingId, sellerId);
  if (!data) {
    return { success: false, externalId: null, externalUrl: null, error: 'Listing not found.', retryable: false };
  }

  const [accountRow] = await db
    .select()
    .from(crosslisterAccount)
    .where(eq(crosslisterAccount.id, accountId))
    .limit(1);

  if (!accountRow) {
    return { success: false, externalId: null, externalUrl: null, error: 'Account not found.', retryable: false };
  }

  const categoryMapping = await getCategoryMapping(channel, data.listing.categoryId);

  const transformed = transformListingForChannel({
    listing: data.listing,
    images: data.images,
    channel,
    overrides: null,
    categoryMapping,
    handlingTimeDays: 3,
  });

  try {
    const connector = getConnector(channel);
    const result = await connector.updateListing(accountRow, externalId, transformed);

    if (result.success) {
      recordSuccess(channel);
      await db.update(channelProjection).set({
        hasPendingSync: false,
        updatedAt: new Date(),
      }).where(eq(channelProjection.id, projectionId));

      await db.update(crossJob).set({
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(crossJob.id, crossJobId));

      return { success: true, externalId, externalUrl: null, retryable: false };
    }

    if (!result.retryable) {
      recordFailure(channel);
    }

    return {
      success: false,
      externalId: null,
      externalUrl: null,
      error: result.error,
      retryable: result.retryable,
    };
  } catch (err) {
    recordFailure(channel);
    logger.error('[jobExecutor] executeUpdateJob threw', { crossJobId, listingId, channel, error: String(err) });
    return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
  }
}

/**
 * Execute a DELIST job. Called by the BullMQ worker.
 * Calls connector.delistListing(), updates projection to DELISTED.
 */
export async function executeDelistJob(
  crossJobId: string,
  channel: ExternalChannel,
  accountId: string,
  projectionId: string,
  externalId: string,
): Promise<JobExecutionResult> {
  const [accountRow] = await db
    .select()
    .from(crosslisterAccount)
    .where(eq(crosslisterAccount.id, accountId))
    .limit(1);

  if (!accountRow) {
    return { success: false, externalId: null, externalUrl: null, error: 'Account not found.', retryable: false };
  }

  try {
    const connector = getConnector(channel);
    const result = await connector.delistListing(accountRow, externalId);

    if (result.success) {
      recordSuccess(channel);
      await db.update(channelProjection).set({
        status: 'DELISTED',
        updatedAt: new Date(),
      }).where(eq(channelProjection.id, projectionId));

      await db.update(crossJob).set({
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(crossJob.id, crossJobId));

      return { success: true, externalId, externalUrl: null, retryable: false };
    }

    if (!result.retryable) {
      recordFailure(channel);
    }

    return {
      success: false,
      externalId: null,
      externalUrl: null,
      error: result.error,
      retryable: result.retryable,
    };
  } catch (err) {
    recordFailure(channel);
    logger.error('[jobExecutor] executeDelistJob threw', { crossJobId, channel, error: String(err) });
    return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
  }
}
