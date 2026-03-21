import { db } from '@twicely/db';
import { listing, listingImage } from '@twicely/db/schema';
import { inArray, eq, and } from 'drizzle-orm';
import type { FeaturedListingData } from '@/components/storefront/puck-blocks/featured-listings-block';

/**
 * Fetch listing data for FeaturedListings blocks (server-side).
 * Returns a map of id → listing data to avoid client waterfall.
 */
export async function getFeaturedListingsForPage(
  ids: string[]
): Promise<Record<string, FeaturedListingData>> {
  if (ids.length === 0) return {};

  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      priceCents: listing.priceCents,
      slug: listing.slug,
      imageUrl: listingImage.url,
    })
    .from(listing)
    .leftJoin(
      listingImage,
      and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true))
    )
    .where(and(inArray(listing.id, ids), eq(listing.status, 'ACTIVE')));

  const map: Record<string, FeaturedListingData> = {};
  for (const row of rows) {
    map[row.id] = {
      id: row.id,
      title: row.title ?? 'Untitled',
      priceCents: row.priceCents ?? 0,
      imageUrl: row.imageUrl,
      slug: row.slug ?? row.id,
    };
  }
  return map;
}
