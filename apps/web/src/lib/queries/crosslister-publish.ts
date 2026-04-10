/**
 * Crosslister publish query — listing + images for the transform pipeline.
 * Extracted from crosslister.ts to stay under the 300-line limit.
 */

import { db } from '@twicely/db';
import { listing, listingImage } from '@twicely/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import type { CanonicalListingData, CanonicalImageData } from '@twicely/crosslister/services/listing-transform';

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
