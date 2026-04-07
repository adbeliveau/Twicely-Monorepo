import { db } from '@twicely/db';
import { listing, listingImage, user, category, sellerProfile, sellerPerformance } from '@twicely/db/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import type { ListingCardData } from '@/types/listings';

/**
 * Get recent listings for homepage.
 * Returns ACTIVE listings ordered by createdAt DESC.
 */
export async function getRecentListings(limit: number = 12): Promise<ListingCardData[]> {
  const rows = await db
    .select({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      priceCents: listing.priceCents,
      originalPriceCents: listing.originalPriceCents,
      condition: listing.condition,
      brand: listing.brand,
      freeShipping: listing.freeShipping,
      shippingCents: listing.shippingCents,
      primaryImageUrl: listingImage.url,
      primaryImageAlt: listingImage.altText,
      sellerName: user.name,
      sellerUsername: user.username,
      sellerAvatarUrl: user.avatarUrl,
      sellerAverageRating: sellerPerformance.averageRating,
      sellerTotalReviews: sellerPerformance.totalReviews,
      sellerShowStars: sellerPerformance.showStars,
    })
    .from(listing)
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(listing.ownerUserId, sellerProfile.userId))
    .leftJoin(sellerPerformance, eq(sellerProfile.id, sellerPerformance.sellerProfileId))
    .leftJoin(
      listingImage,
      and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true))
    )
    .where(eq(listing.status, 'ACTIVE'))
    .orderBy(desc(listing.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug ?? row.id,
    title: row.title ?? '',
    priceCents: row.priceCents ?? 0,
    originalPriceCents: row.originalPriceCents,
    condition: row.condition ?? 'GOOD',
    brand: row.brand,
    freeShipping: row.freeShipping,
    shippingCents: row.shippingCents ?? 0,
    primaryImageUrl: row.primaryImageUrl,
    primaryImageAlt: row.primaryImageAlt,
    sellerName: row.sellerName ?? 'Unknown Seller',
    sellerUsername: row.sellerUsername ?? '',
    sellerAvatarUrl: row.sellerAvatarUrl,
    sellerAverageRating: row.sellerAverageRating,
    sellerTotalReviews: row.sellerTotalReviews ?? 0,
    sellerShowStars: row.sellerShowStars ?? false,
  }));
}

/**
 * Get recently sold listings (listing status = SOLD).
 * Queries listings table directly — these have real images and seller data.
 */
export async function getRecentlySoldListings(limit: number = 12): Promise<ListingCardData[]> {
  const rows = await db
    .select({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      priceCents: listing.priceCents,
      originalPriceCents: listing.originalPriceCents,
      condition: listing.condition,
      brand: listing.brand,
      freeShipping: listing.freeShipping,
      shippingCents: listing.shippingCents,
      primaryImageUrl: listingImage.url,
      primaryImageAlt: listingImage.altText,
      sellerName: user.name,
      sellerUsername: user.username,
      sellerAvatarUrl: user.avatarUrl,
      sellerAverageRating: sellerPerformance.averageRating,
      sellerTotalReviews: sellerPerformance.totalReviews,
      sellerShowStars: sellerPerformance.showStars,
    })
    .from(listing)
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(listing.ownerUserId, sellerProfile.userId))
    .leftJoin(sellerPerformance, eq(sellerProfile.id, sellerPerformance.sellerProfileId))
    .leftJoin(
      listingImage,
      and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true))
    )
    .where(eq(listing.status, 'SOLD'))
    .orderBy(sql`RANDOM()`)
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug ?? row.id,
    title: row.title ?? '',
    priceCents: row.priceCents ?? 0,
    originalPriceCents: row.originalPriceCents,
    condition: row.condition ?? 'GOOD',
    brand: row.brand,
    freeShipping: row.freeShipping,
    shippingCents: row.shippingCents ?? 0,
    primaryImageUrl: row.primaryImageUrl,
    primaryImageAlt: row.primaryImageAlt,
    sellerName: row.sellerName ?? 'Unknown Seller',
    sellerUsername: row.sellerUsername ?? '',
    sellerAvatarUrl: row.sellerAvatarUrl,
    sellerAverageRating: row.sellerAverageRating,
    sellerTotalReviews: row.sellerTotalReviews ?? 0,
    sellerShowStars: row.sellerShowStars ?? false,
  }));
}

/**
 * Get top-level categories for homepage with listing counts.
 */
export async function getHomepageCategories(): Promise<
  Array<{ id: string; name: string; slug: string; listingCount: number }>
> {
  // Run all 3 independent queries in parallel
  const [categories, counts, childCategories] = await Promise.all([
    // Get top-level categories (parentId is null)
    db
      .select({
        id: category.id,
        name: category.name,
        slug: category.slug,
      })
      .from(category)
      .where(and(isNull(category.parentId), eq(category.isActive, true))),
    // Get listing counts for each category (including child categories)
    db
      .select({
        categoryId: listing.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(listing)
      .where(eq(listing.status, 'ACTIVE'))
      .groupBy(listing.categoryId),
    // Get child category mappings
    db
      .select({
        id: category.id,
        parentId: category.parentId,
      })
      .from(category)
      .where(eq(category.isActive, true)),
  ]);

  // Build parent -> children map
  const parentChildMap = new Map<string, string[]>();
  for (const child of childCategories) {
    if (child.parentId) {
      const existing = parentChildMap.get(child.parentId) ?? [];
      existing.push(child.id);
      parentChildMap.set(child.parentId, existing);
    }
  }

  // Build category ID -> count map
  const countMap = new Map(counts.map((c) => [c.categoryId, c.count]));

  // Calculate total count for each top-level category (self + children)
  return categories.map((cat) => {
    const childIds = parentChildMap.get(cat.id) ?? [];
    const selfCount = countMap.get(cat.id) ?? 0;
    const childCount = childIds.reduce((sum, id) => sum + (countMap.get(id) ?? 0), 0);

    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      listingCount: selfCount + childCount,
    };
  });
}
