import { db } from '@twicely/db';
import { listing, listingImage, user, sellerProfile, category, sellerPerformance } from '@twicely/db/schema';
import { eq, and, or, ilike, gte, lte, inArray, desc, asc, sql } from 'drizzle-orm';
import { escapeLike } from '@/lib/utils/escape-like';
import type { SearchFilters, SearchResult } from '@/types/listings';
import { mapToListingCard } from '@/lib/queries/shared';

/**
 * Get all child category IDs for a parent category (for filtering)
 */
async function getChildCategoryIds(parentId: string): Promise<string[]> {
  const children = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.parentId, parentId));
  return children.map((c) => c.id);
}

/**
 * Search listings with filters, sorting, and pagination.
 * This is THE search function for B1. Uses Drizzle ILIKE for text search.
 */
export async function searchListings(filters: SearchFilters): Promise<SearchResult> {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 24, 48);
  const offset = (page - 1) * limit;

  // Build WHERE conditions
  const conditions = [eq(listing.status, 'ACTIVE')];

  // Text search: split query into words, each word must appear in title OR description
  if (filters.q) {
    const words = filters.q.trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      const pattern = `%${escapeLike(word)}%`;
      conditions.push(
        or(ilike(listing.title, pattern), ilike(listing.description, pattern))!
      );
    }
  }

  // Category filter: include parent + all children
  if (filters.categoryId) {
    const childIds = await getChildCategoryIds(filters.categoryId);
    const allCategoryIds = [filters.categoryId, ...childIds];
    conditions.push(inArray(listing.categoryId, allCategoryIds));
  }

  // Condition filter - validate against known enum values
  const validConditions = ['NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'NEW_WITH_DEFECTS', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'];
  if (filters.condition && filters.condition.length > 0) {
    const validatedConditions = filters.condition.filter((c) => validConditions.includes(c));
    if (validatedConditions.length > 0) {
      conditions.push(inArray(listing.condition, validatedConditions));
    }
  }

  // Price range
  if (filters.minPrice !== undefined) {
    conditions.push(gte(listing.priceCents, filters.minPrice));
  }
  if (filters.maxPrice !== undefined) {
    conditions.push(lte(listing.priceCents, filters.maxPrice));
  }

  // Free shipping
  if (filters.freeShipping) {
    conditions.push(eq(listing.freeShipping, true));
  }

  // Brand filter
  if (filters.brand) {
    conditions.push(ilike(listing.brand, `%${escapeLike(filters.brand)}%`));
  }

  const whereClause = and(...conditions);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listing)
    .where(whereClause);
  const totalCount = countResult[0]?.count ?? 0;

  // Determine sort order
  let orderBy;
  switch (filters.sort) {
    case 'newest':
      orderBy = desc(listing.createdAt);
      break;
    case 'price_asc':
      orderBy = asc(listing.priceCents);
      break;
    case 'price_desc':
      orderBy = desc(listing.priceCents);
      break;
    case 'relevance':
    default:
      // For relevance with a query, we could add relevance scoring later
      // For now, just use newest
      orderBy = desc(listing.createdAt);
      break;
  }

  // Main query with joins
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
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const listings = rows.map(mapToListingCard);
  const totalPages = Math.ceil(totalCount / limit);

  return {
    listings,
    totalCount,
    page,
    totalPages,
    filters,
  };
}
