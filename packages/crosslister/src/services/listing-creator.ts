/**
 * Listing creator — creates a canonical Twicely listing from normalized import data.
 * Source: F1.2 install prompt §2.10; F2 (genericized to ExternalListing)
 *
 * NOT a 'use server' file — plain TypeScript module.
 *
 * Decision #16: Imported listings are ALWAYS status 'ACTIVE'.
 * Images: External URLs stored directly. R2 migration is a separate background job.
 */

import { db } from '@twicely/db';
import { listing, listingImage } from '@twicely/db/schema';
import { generateListingSlug } from '../slug';
import type { ExternalListing, ExternalChannel } from '../types';

export interface ListingCreatorResult {
  listingId: string;
}

/**
 * Create a canonical listing row + listingImage rows from normalized import data.
 * Returns the created listing ID.
 *
 * Listing is always created with status ACTIVE (Decision #16).
 * Images are stored as eBay URLs directly — no R2 download during import.
 * Category is null — seller must categorize manually after import.
 */
export async function createImportedListing(
  normalized: ExternalListing,
  ownerUserId: string,
  channel: ExternalChannel,
): Promise<ListingCreatorResult> {
  const slug = await generateListingSlug(normalized.title || 'listing');

  const [newListing] = await db
    .insert(listing)
    .values({
      ownerUserId,
      status: 'ACTIVE',
      title: normalized.title || null,
      description: normalized.description || null,
      categoryId: null,
      condition: isValidCondition(normalized.condition) ? normalized.condition : undefined,
      brand: normalized.brand || null,
      priceCents: normalized.priceCents > 0 ? normalized.priceCents : null,
      quantity: normalized.quantity,
      availableQuantity: normalized.quantity,
      slug,
      importedFromChannel: channel,
      importedExternalId: normalized.externalId,
      attributesJson: normalized.itemSpecifics,
      activatedAt: new Date(),
    })
    .returning({ id: listing.id });

  if (!newListing) {
    throw new Error('Failed to insert listing row');
  }

  // Insert image rows — eBay URLs stored directly, no R2 download
  if (normalized.images.length > 0) {
    await db.insert(listingImage).values(
      normalized.images.map((img, index) => ({
        listingId: newListing.id,
        url: img.url,
        position: img.sortOrder,
        isPrimary: img.isPrimary || index === 0,
      })),
    );
  }

  return { listingId: newListing.id };
}

/**
 * Type guard for listingConditionEnum values.
 */
function isValidCondition(value: string | null): value is
  | 'NEW_WITH_TAGS'
  | 'NEW_WITHOUT_TAGS'
  | 'NEW_WITH_DEFECTS'
  | 'LIKE_NEW'
  | 'VERY_GOOD'
  | 'GOOD'
  | 'ACCEPTABLE' {
  if (!value) return false;
  return [
    'NEW_WITH_TAGS',
    'NEW_WITHOUT_TAGS',
    'NEW_WITH_DEFECTS',
    'LIKE_NEW',
    'VERY_GOOD',
    'GOOD',
    'ACCEPTABLE',
  ].includes(value);
}
