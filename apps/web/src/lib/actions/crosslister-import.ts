'use server';

/**
 * Crosslister import server actions.
 * Source: F1.2 install prompt §2.4
 *
 * Actions: startImport, getImportBatchStatus, getImportIssues, retryImportRecord
 */

import { db } from '@twicely/db';
import {
  importBatch,
  importRecord,
  crosslisterAccount,
  platformSetting,
} from '@twicely/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { startImportSchema } from '@/lib/validations/crosslister';
import { processImportBatch } from '@twicely/crosslister/services/import-service';
import { normalizeExternalListing } from '@twicely/crosslister/services/normalizer-dispatch';
import { createImportedListing } from '@twicely/crosslister/services/listing-creator';
import { generateFingerprint, findDedupeMatch } from '@twicely/crosslister/services/dedupe-service';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import type { ImportBatch, ImportRecord } from '@twicely/crosslister/db-types';
import type { ExternalChannel } from '@twicely/crosslister/types';

function getImportFlagKey(channel: ExternalChannel): string {
  const map: Record<ExternalChannel, string> = {
    EBAY: 'crosslister.ebay.importEnabled',
    POSHMARK: 'crosslister.poshmark.importEnabled',
    MERCARI: 'crosslister.mercari.importEnabled',
    DEPOP: 'crosslister.depop.importEnabled',
    FB_MARKETPLACE: 'crosslister.fbMarketplace.importEnabled',
    ETSY: 'crosslister.etsy.importEnabled',
    GRAILED: 'crosslister.grailed.importEnabled',
    THEREALREAL: 'crosslister.therealreal.importEnabled',
    WHATNOT: 'crosslister.whatnot.importEnabled',
    SHOPIFY: 'crosslister.shopify.importEnabled',
    VESTIAIRE: 'crosslister.vestiaire.importEnabled',
  };
  return map[channel];
}

const batchIdSchema = z.object({ batchId: zodId }).strict();
const issuesSchema = z.object({
  batchId: zodId,
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).strict();
const recordIdSchema = z.object({ recordId: zodId }).strict();

interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Start a one-time free import from a connected account.
 * Decision #16: imported listings are always ACTIVE.
 * ONE free import per marketplace per account (enforced by firstImportCompletedAt).
 */
export async function startImport(
  input: unknown,
): Promise<ActionResult<{ batchId: string }>> {
  const parsed = startImportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('create', sub('ImportBatch', { sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // Lookup account + verify ownership + check status
  const [account] = await db
    .select()
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.id, parsed.data.accountId),
        eq(crosslisterAccount.sellerId, sellerId),
      ),
    )
    .limit(1);

  if (!account) return { success: false, error: 'Account not found.' };
  if (account.status !== 'ACTIVE') {
    return { success: false, error: 'Account is not active. Please reconnect.' };
  }

  // ONE free import per marketplace per account
  if (account.firstImportCompletedAt !== null) {
    return { success: false, error: 'Free import already used for this platform.' };
  }

  // Check channel feature flag
  const flagKey = getImportFlagKey(account.channel as ExternalChannel);
  const [flag] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, flagKey))
    .limit(1);

  if (flag?.value === false || flag?.value === 'false') {
    return { success: false, error: `${account.channel} import is currently disabled.` };
  }

  // Create import batch
  const [batch] = await db
    .insert(importBatch)
    .values({
      sellerId,
      accountId: account.id,
      channel: account.channel,
      status: 'CREATED',
      isFirstImport: true,
      totalItems: 0,
    })
    .returning({ id: importBatch.id });

  if (!batch) return { success: false, error: 'Failed to create import batch.' };

  // Run the pipeline (fire-and-forget — runs async in the same request context)
  // For production this would be enqueued in BullMQ, but for F1 we run inline
  processImportBatch(batch.id).catch((err) => {
    void err; // errors logged inside processImportBatch
  });

  return { success: true, data: { batchId: batch.id } };
}

/**
 * Poll import progress (fallback if Centrifugo unavailable).
 */
export async function getImportBatchStatus(
  input: unknown,
): Promise<ActionResult<ImportBatch>> {
  const parsed = batchIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('read', sub('ImportBatch', { sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const [batch] = await db
    .select()
    .from(importBatch)
    .where(and(eq(importBatch.id, parsed.data.batchId), eq(importBatch.sellerId, sellerId)))
    .limit(1);

  if (!batch) return { success: false, error: 'Import batch not found.' };

  return { success: true, data: batch };
}

/**
 * Get failed/skipped import records for a batch (paginated).
 */
export async function getImportIssues(
  input: unknown,
): Promise<ActionResult<{ records: ImportRecord[]; total: number }>> {
  const parsed = issuesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('read', sub('ImportBatch', { sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // Verify batch ownership
  const [batch] = await db
    .select({ id: importBatch.id })
    .from(importBatch)
    .where(and(eq(importBatch.id, parsed.data.batchId), eq(importBatch.sellerId, sellerId)))
    .limit(1);

  if (!batch) return { success: false, error: 'Import batch not found.' };

  const page = parsed.data.page ?? 1;
  const limit = parsed.data.limit ?? 50;
  const offset = (page - 1) * limit;

  const records = await db
    .select()
    .from(importRecord)
    .where(
      and(
        eq(importRecord.batchId, parsed.data.batchId),
        or(eq(importRecord.status, 'failed'), eq(importRecord.status, 'skipped')),
      ),
    )
    .limit(limit)
    .offset(offset);

  return { success: true, data: { records, total: records.length } };
}

/**
 * Retry a single failed import record.
 */
export async function retryImportRecord(
  input: unknown,
): Promise<ActionResult> {
  const parsed = recordIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('create', sub('ImportBatch', { sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // Fetch record + verify ownership via batch
  const [record] = await db.select().from(importRecord).where(eq(importRecord.id, parsed.data.recordId)).limit(1);
  if (!record) return { success: false, error: 'Import record not found.' };

  const [batch] = await db
    .select({ sellerId: importBatch.sellerId, accountId: importBatch.accountId, channel: importBatch.channel })
    .from(importBatch)
    .where(and(eq(importBatch.id, record.batchId), eq(importBatch.sellerId, sellerId)))
    .limit(1);

  if (!batch) return { success: false, error: 'Forbidden.' };
  if (record.status !== 'failed') return { success: false, error: 'Record is not in failed state.' };

  try {
    const raw = record.rawDataJson as Record<string, unknown>;
    const channel = batch.channel as ExternalChannel;
    const normalized = normalizeExternalListing(raw, channel);

    if (!normalized) {
      await db.update(importRecord).set({ errorMessage: 'Schema validation failed for raw listing data.' }).where(eq(importRecord.id, record.id));
      return { success: false, error: 'Schema validation failed for raw listing data.' };
    }

    if (!normalized.title) {
      await db.update(importRecord).set({ errorMessage: 'Missing required field: title.' }).where(eq(importRecord.id, record.id));
      return { success: false, error: 'Missing required field: title.' };
    }
    if (normalized.priceCents <= 0) {
      await db.update(importRecord).set({ errorMessage: 'Invalid price.' }).where(eq(importRecord.id, record.id));
      return { success: false, error: 'Invalid price.' };
    }
    if (normalized.images.length === 0) {
      await db.update(importRecord).set({ errorMessage: 'At least one image is required.' }).where(eq(importRecord.id, record.id));
      return { success: false, error: 'At least one image is required.' };
    }

    const fp = generateFingerprint(normalized, sellerId);
    const match = await findDedupeMatch(fp, sellerId);
    if (match.confidence >= 90 && match.matchListingId) {
      await db.update(importRecord).set({
        status: 'deduplicated',
        dedupeMatchListingId: match.matchListingId,
        dedupeConfidence: match.confidence,
      }).where(eq(importRecord.id, record.id));
      return { success: true };
    }

    const { listingId } = await createImportedListing(normalized, sellerId, channel);
    await db.update(importRecord).set({ status: 'created', listingId, errorMessage: null }).where(eq(importRecord.id, record.id));

    return { success: true };
  } catch (err) {
    await db.update(importRecord).set({ errorMessage: String(err) }).where(eq(importRecord.id, record.id));
    return { success: false, error: String(err) };
  }
}
