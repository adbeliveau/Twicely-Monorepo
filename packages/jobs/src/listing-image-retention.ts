/**
 * Listing Image Retention Job — Decision #111
 *
 * Implements the tiered image retention policy for sold/ended listings:
 *   • Stage 1: 0–N days after sold/ended → keep full stack (no-op)
 *   • Stage 2: day N → delete platform variants, keep cover image + thumbnail
 *   • Stage 3: day M → delete all images and the listing record
 *
 * All thresholds read from platform_settings (FP-010 fallback pattern):
 *   • crosslister.images.variantPurgeAfterDays    (default 120)
 *   • crosslister.images.fullPurgeAfterDays       (default 730 — 2 years)
 *   • crosslister.images.batchSize                (default 200)
 *
 * Runs daily via cron-jobs.ts. Idempotent — re-running on the same day is a no-op
 * because each pass narrows the candidate set by deleting/marking what it processes.
 */

import { db } from '@twicely/db';
import { listing, listingImage } from '@twicely/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { deleteFromR2, extractKeyFromUrl } from '@twicely/storage/r2-client';
import { logger } from '@twicely/logger';
import { upsertPlatformSetting } from '@twicely/jobs/cleanup-helpers';

export interface ListingImageRetentionResult extends Record<string, unknown> {
  variantsPurgedListings: number;
  variantsPurgedImages: number;
  fullPurgedListings: number;
  fullPurgedImages: number;
  errors: number;
}

/**
 * Best-effort R2 delete. Logs and counts errors but never throws —
 * we'd rather leak a few R2 objects than block the entire retention pass.
 */
async function safeDeleteR2(url: string): Promise<boolean> {
  const key = extractKeyFromUrl(url);
  if (!key) return true; // not an R2 URL — treat as success
  try {
    await deleteFromR2(key);
    return true;
  } catch (err) {
    logger.warn('[listingImageRetention] R2 delete failed', { url, err: String(err) });
    return false;
  }
}

/**
 * Stage 2: For listings sold/ended ≥ variantPurgeAfterDays ago, delete every image
 * row except the cover (slot 0 / isPrimary). The cover + its thumbnail remain
 * for sold-comps and market intelligence.
 */
async function purgeVariantImages(cutoff: Date, batchSize: number): Promise<{ listings: number; images: number; errors: number }> {
  // Find candidate listings: ended/sold before cutoff, NOT yet fully purged.
  // We use status to short-circuit: only SOLD or ENDED listings have non-null sold/ended dates.
  const candidates = await db
    .select({ id: listing.id })
    .from(listing)
    .where(
      and(
        inArray(listing.status, ['SOLD', 'ENDED']),
        // sold or ended before cutoff
        sql`COALESCE(${listing.soldAt}, ${listing.endedAt}) < ${cutoff}`,
      ),
    )
    .limit(batchSize);

  if (candidates.length === 0) {
    return { listings: 0, images: 0, errors: 0 };
  }

  const listingIds = candidates.map((l) => l.id);

  // Pull all non-cover images for these listings
  const variantImages = await db
    .select({ id: listingImage.id, url: listingImage.url, listingId: listingImage.listingId })
    .from(listingImage)
    .where(
      and(
        inArray(listingImage.listingId, listingIds),
        eq(listingImage.isPrimary, false),
      ),
    );

  let errors = 0;
  let deletedRows = 0;

  for (const img of variantImages) {
    const ok = await safeDeleteR2(img.url);
    if (!ok) errors++;
  }

  if (variantImages.length > 0) {
    await db
      .delete(listingImage)
      .where(inArray(listingImage.id, variantImages.map((i) => i.id)));
    deletedRows = variantImages.length;
  }

  // Count distinct listings actually touched
  const touchedListings = new Set(variantImages.map((i) => i.listingId)).size;

  return { listings: touchedListings, images: deletedRows, errors };
}

/**
 * Stage 3: For listings sold/ended ≥ fullPurgeAfterDays ago, delete every remaining
 * image (including the cover) and the listing row itself. listingImage rows cascade
 * via the FK ON DELETE CASCADE.
 */
async function purgeListingsFully(cutoff: Date, batchSize: number): Promise<{ listings: number; images: number; errors: number }> {
  const candidates = await db
    .select({ id: listing.id })
    .from(listing)
    .where(
      and(
        inArray(listing.status, ['SOLD', 'ENDED']),
        sql`COALESCE(${listing.soldAt}, ${listing.endedAt}) < ${cutoff}`,
      ),
    )
    .limit(batchSize);

  if (candidates.length === 0) {
    return { listings: 0, images: 0, errors: 0 };
  }

  const listingIds = candidates.map((l) => l.id);

  // Fetch all surviving image URLs for these listings so we can delete the R2 objects
  // BEFORE the DB rows cascade away.
  const remainingImages = await db
    .select({ id: listingImage.id, url: listingImage.url })
    .from(listingImage)
    .where(inArray(listingImage.listingId, listingIds));

  let errors = 0;
  for (const img of remainingImages) {
    const ok = await safeDeleteR2(img.url);
    if (!ok) errors++;
  }

  // Delete listing rows — listingImage rows cascade.
  await db
    .delete(listing)
    .where(inArray(listing.id, listingIds));

  return {
    listings: listingIds.length,
    images: remainingImages.length,
    errors,
  };
}

/**
 * Run a single retention pass. Caller is responsible for scheduling.
 */
export async function runListingImageRetention(): Promise<ListingImageRetentionResult> {
  const startedAt = new Date();
  logger.info('[listingImageRetention] Starting retention pass', { startedAt: startedAt.toISOString() });

  const [variantPurgeAfterDays, fullPurgeAfterDays, batchSize] = await Promise.all([
    getPlatformSetting<number>('crosslister.images.variantPurgeAfterDays', 120),
    getPlatformSetting<number>('crosslister.images.fullPurgeAfterDays', 730),
    getPlatformSetting<number>('crosslister.images.batchSize', 200),
  ]);

  const variantCutoff = new Date(Date.now() - variantPurgeAfterDays * 86_400_000);
  const fullCutoff = new Date(Date.now() - fullPurgeAfterDays * 86_400_000);

  // Order matters: full purge first so we don't waste a variant pass on rows we're
  // about to delete entirely.
  const fullPurge = await purgeListingsFully(fullCutoff, batchSize);
  const variantPurge = await purgeVariantImages(variantCutoff, batchSize);

  const result: ListingImageRetentionResult = {
    variantsPurgedListings: variantPurge.listings,
    variantsPurgedImages: variantPurge.images,
    fullPurgedListings: fullPurge.listings,
    fullPurgedImages: fullPurge.images,
    errors: variantPurge.errors + fullPurge.errors,
  };

  await upsertPlatformSetting(
    'crosslister.images.lastRunAt',
    JSON.stringify({ at: new Date().toISOString(), result }),
  );

  logger.info('[listingImageRetention] Pass complete', result);
  return result;
}
