import { db } from '@twicely/db';
import { listingPriceHistory, listing, listingImage } from '@twicely/db/schema';
import { eq, asc, desc, and, ne, gte, isNotNull } from 'drizzle-orm';

export interface PriceHistoryPoint {
  priceCents: number;
  recordedAt: Date;
}

/**
 * Get price history for a listing, ordered oldest to newest.
 * Includes the initial listing price (from createdAt) if no INITIAL record exists.
 */
export async function getPriceHistory(listingId: string): Promise<PriceHistoryPoint[]> {
  // Get listing creation info for initial price point
  const [listingRow] = await db
    .select({
      priceCents: listing.priceCents,
      createdAt: listing.createdAt,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow || !listingRow.priceCents) {
    return [];
  }

  // Get all price history records (using canonical column names)
  const history = await db
    .select({
      priceCents: listingPriceHistory.priceCents,
      previousCents: listingPriceHistory.previousCents,
      createdAt: listingPriceHistory.createdAt,
    })
    .from(listingPriceHistory)
    .where(eq(listingPriceHistory.listingId, listingId))
    .orderBy(asc(listingPriceHistory.createdAt));

  // Build timeline: start with initial price, then each change
  const points: PriceHistoryPoint[] = [];

  if (history.length > 0) {
    // Add initial price point from first record's previousCents
    const firstPreviousPrice = history[0]?.previousCents;
    if (firstPreviousPrice) {
      points.push({
        priceCents: firstPreviousPrice,
        recordedAt: listingRow.createdAt,
      });
    }

    // Add each price change
    for (const record of history) {
      points.push({
        priceCents: record.priceCents,
        recordedAt: record.createdAt,
      });
    }
  } else {
    // No history yet - just return current price at creation time
    points.push({
      priceCents: listingRow.priceCents,
      recordedAt: listingRow.createdAt,
    });
  }

  return points;
}

export interface SoldComparable {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  condition: string;
  imageUrl: string | null;
  soldAt: Date;
}

/**
 * Get recently sold similar items in the same category.
 * Returns up to 6 items sold within 90 days.
 */
export async function getSoldComparables(
  currentListingId: string,
  categoryId: string
): Promise<SoldComparable[]> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get sold listings in same category
  const soldListings = await db
    .select({
      id: listing.id,
      title: listing.title,
      slug: listing.slug,
      priceCents: listing.priceCents,
      condition: listing.condition,
      soldAt: listing.soldAt,
    })
    .from(listing)
    .where(
      and(
        eq(listing.status, 'SOLD'),
        eq(listing.categoryId, categoryId),
        ne(listing.id, currentListingId),
        gte(listing.soldAt, ninetyDaysAgo),
        isNotNull(listing.soldAt)
      )
    )
    .orderBy(desc(listing.soldAt))
    .limit(6);

  if (soldListings.length === 0) {
    return [];
  }

  // Get primary images for sold listings
  const listingIds = soldListings.map((l) => l.id);
  const images = await db
    .select({
      listingId: listingImage.listingId,
      url: listingImage.url,
    })
    .from(listingImage)
    .where(
      and(
        eq(listingImage.isPrimary, true)
      )
    );

  // Map images by listing ID
  const imageMap = new Map<string, string>();
  for (const img of images) {
    if (listingIds.includes(img.listingId)) {
      imageMap.set(img.listingId, img.url);
    }
  }

  return soldListings.map((item) => ({
    id: item.id,
    title: item.title ?? 'Untitled',
    slug: item.slug ?? item.id,
    priceCents: item.priceCents ?? 0,
    condition: item.condition ?? 'GOOD',
    imageUrl: imageMap.get(item.id) ?? null,
    soldAt: item.soldAt!,
  }));
}
