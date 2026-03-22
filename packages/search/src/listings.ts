import { db } from '@twicely/db';
import { listing, listingImage, user, sellerProfile, category, sellerPerformance } from '@twicely/db/schema';
import { eq, and, or, ilike, gte, lte, inArray, desc, asc, sql } from 'drizzle-orm';
import type { SearchFilters, SearchResult, ListingCardData } from '@/types/listings';
import { mapToListingCard } from '@/lib/queries/shared';
import { getTypesenseClient } from './typesense-client';
import { LISTINGS_COLLECTION, DEFAULT_QUERY_BY, DEFAULT_QUERY_WEIGHTS } from './typesense-schema';

/**
 * Search listings with Typesense (primary) or PostgreSQL ILIKE (fallback).
 * Supports typo tolerance, faceted filtering, and relevance ranking.
 */
export async function searchListings(filters: SearchFilters): Promise<SearchResult> {
  try {
    return await searchWithTypesense(filters);
  } catch {
    // Typesense unavailable — fall back to PostgreSQL
    return searchWithPostgres(filters);
  }
}

// ── Typesense search ────────────────────────────────────────────────────────

async function searchWithTypesense(filters: SearchFilters): Promise<SearchResult> {
  const client = getTypesenseClient();
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 48, 48);

  // Build filter string
  const filterParts: string[] = ['availableQuantity:>0'];
  if (filters.categoryId) {
    const childIds = await getChildCategoryIds(filters.categoryId);
    const allIds = [filters.categoryId, ...childIds];
    filterParts.push(`categoryId:[${allIds.join(',')}]`);
  }
  if (filters.condition && filters.condition.length > 0) {
    filterParts.push(`condition:[${filters.condition.join(',')}]`);
  }
  if (filters.minPrice !== undefined) {
    filterParts.push(`priceCents:>=${filters.minPrice}`);
  }
  if (filters.maxPrice !== undefined) {
    filterParts.push(`priceCents:<=${filters.maxPrice}`);
  }
  if (filters.freeShipping) {
    filterParts.push('freeShipping:true');
  }
  if (filters.brand) {
    filterParts.push(`brand:=${filters.brand}`);
  }

  // Build sort_by
  let sortBy: string;
  switch (filters.sort) {
    case 'newest':
      sortBy = 'activatedAt:desc';
      break;
    case 'price_asc':
      sortBy = 'priceCents:asc';
      break;
    case 'price_desc':
      sortBy = 'priceCents:desc';
      break;
    case 'relevance':
    default:
      sortBy = filters.q
        ? '_text_match:desc,sellerScore:desc,activatedAt:desc'
        : 'activatedAt:desc';
      break;
  }

  const result = await client
    .collections(LISTINGS_COLLECTION)
    .documents()
    .search({
      q: filters.q || '*',
      query_by: DEFAULT_QUERY_BY,
      query_by_weights: DEFAULT_QUERY_WEIGHTS,
      filter_by: filterParts.join(' && '),
      sort_by: sortBy,
      per_page: limit,
      page,
      facet_by: 'condition,categoryId,brand,freeShipping,fulfillmentType,sellerPerformanceBand',
      num_typos: 2,
      typo_tokens_threshold: 3,
      prioritize_exact_match: true,
      highlight_full_fields: 'title',
    });

  const totalCount = result.found;
  const totalPages = Math.ceil(totalCount / limit);

  const hits = result.hits ?? [];
  const listings: ListingCardData[] = hits.map((hit) => {
    const doc = hit.document as unknown as Record<string, unknown>;
    return {
      id: String(doc.id ?? ''),
      slug: String(doc.slug ?? ''),
      title: String(doc.title ?? ''),
      priceCents: Number(doc.priceCents ?? 0),
      originalPriceCents: doc.originalPriceCents ? Number(doc.originalPriceCents) : null,
      condition: String(doc.condition ?? ''),
      brand: doc.brand ? String(doc.brand) : null,
      freeShipping: Boolean(doc.freeShipping),
      shippingCents: Number(doc.shippingCents ?? 0),
      primaryImageUrl: doc.primaryImageUrl ? String(doc.primaryImageUrl) : null,
      primaryImageAlt: doc.primaryImageAlt ? String(doc.primaryImageAlt) : null,
      sellerName: String(doc.sellerName ?? ''),
      sellerUsername: String(doc.sellerUsername ?? ''),
      sellerAvatarUrl: doc.sellerAvatarUrl ? String(doc.sellerAvatarUrl) : null,
      sellerAverageRating: doc.sellerAverageRating ? Number(doc.sellerAverageRating) : null,
      sellerTotalReviews: Number(doc.sellerTotalReviews ?? 0),
      sellerShowStars: Boolean(doc.sellerShowStars),
      storefrontCategoryId: doc.storefrontCategoryId ? String(doc.storefrontCategoryId) : null,
    };
  });

  return { listings, totalCount, page, totalPages, filters };
}

// ── PostgreSQL fallback (original ILIKE search) ─────────────────────────────

async function getChildCategoryIds(parentId: string): Promise<string[]> {
  const children = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.parentId, parentId));
  return children.map((c) => c.id);
}

async function searchWithPostgres(filters: SearchFilters): Promise<SearchResult> {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 48, 48);
  const offset = (page - 1) * limit;
  const conditions = [eq(listing.status, 'ACTIVE')];

  if (filters.q) {
    const words = filters.q.trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      const pattern = `%${word}%`;
      conditions.push(or(ilike(listing.title, pattern), ilike(listing.description, pattern))!);
    }
  }
  if (filters.categoryId) {
    const childIds = await getChildCategoryIds(filters.categoryId);
    conditions.push(inArray(listing.categoryId, [filters.categoryId, ...childIds]));
  }
  const validConditions = ['NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'NEW_WITH_DEFECTS', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'];
  if (filters.condition?.length) {
    const validated = filters.condition.filter((c) => validConditions.includes(c));
    if (validated.length > 0) conditions.push(inArray(listing.condition, validated));
  }
  if (filters.minPrice !== undefined) conditions.push(gte(listing.priceCents, filters.minPrice));
  if (filters.maxPrice !== undefined) conditions.push(lte(listing.priceCents, filters.maxPrice));
  if (filters.freeShipping) conditions.push(eq(listing.freeShipping, true));
  if (filters.brand) conditions.push(ilike(listing.brand, `%${filters.brand}%`));

  const whereClause = and(...conditions);
  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(listing).where(whereClause);
  const totalCount = countResult[0]?.count ?? 0;

  let orderBy;
  switch (filters.sort) {
    case 'newest': orderBy = desc(listing.createdAt); break;
    case 'price_asc': orderBy = asc(listing.priceCents); break;
    case 'price_desc': orderBy = desc(listing.priceCents); break;
    default: orderBy = desc(listing.createdAt); break;
  }

  const rows = await db
    .select({
      id: listing.id, slug: listing.slug, title: listing.title,
      priceCents: listing.priceCents, originalPriceCents: listing.originalPriceCents,
      condition: listing.condition, brand: listing.brand,
      freeShipping: listing.freeShipping, shippingCents: listing.shippingCents,
      primaryImageUrl: listingImage.url, primaryImageAlt: listingImage.altText,
      sellerName: user.name, sellerUsername: user.username, sellerAvatarUrl: user.avatarUrl,
      sellerAverageRating: sellerPerformance.averageRating,
      sellerTotalReviews: sellerPerformance.totalReviews,
      sellerShowStars: sellerPerformance.showStars,
    })
    .from(listing)
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(listing.ownerUserId, sellerProfile.userId))
    .leftJoin(sellerPerformance, eq(sellerProfile.id, sellerPerformance.sellerProfileId))
    .leftJoin(listingImage, and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true)))
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    listings: rows.map(mapToListingCard),
    totalCount, page,
    totalPages: Math.ceil(totalCount / limit),
    filters,
  };
}
