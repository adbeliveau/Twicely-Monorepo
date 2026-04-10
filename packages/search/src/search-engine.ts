/**
 * Search Engine Abstraction Layer
 *
 * Routes search queries and indexing operations to the active engine
 * (OpenSearch, Typesense, or PostgreSQL fallback).
 *
 * Engine selection: kill.search → search.engine platform_setting → gate.opensearch feature flag.
 * Supports dual-write mode for safe migration.
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { isKillSwitchActive, isFeatureEnabled } from '@twicely/config/feature-flags';
import { logger } from '@twicely/logger';
import type { SearchFilters, SearchResult, ListingCardData } from './shared';
import type { ListingDocument } from './typesense-index';
import { calculatePromotedSlots } from '@twicely/commerce/boosting';
import { mapToListingCard } from './shared';

export type SearchEngine = 'opensearch' | 'typesense' | 'postgres';

// ─── Engine Resolution ─────────────────────────────────────────────────────────

/**
 * Determine which search engine to use for READ queries.
 *
 * Priority:
 * 1. If kill.search is OFF → postgres (search is killed)
 * 2. If search.engine = 'opensearch' → opensearch
 * 3. If gate.opensearch is enabled for this user → opensearch
 * 4. Default: typesense
 */
export async function getActiveSearchEngine(
  context?: { userId?: string },
): Promise<SearchEngine> {
  // Kill switch check — if search is killed, degrade to postgres
  const searchAlive = await isKillSwitchActive('search');
  if (!searchAlive) return 'postgres';

  // Explicit engine override from platform_settings
  const configuredEngine = await getPlatformSetting<string>('search.engine', 'typesense');
  if (configuredEngine === 'opensearch') return 'opensearch';
  if (configuredEngine === 'postgres') return 'postgres';

  // Feature flag gate for canary rollout
  const gateOpen = await isFeatureEnabled('gate.opensearch', context);
  if (gateOpen) return 'opensearch';

  return 'typesense';
}

/**
 * Check if dual-write is enabled (writes go to both engines).
 */
async function isDualWriteEnabled(): Promise<boolean> {
  return getPlatformSetting<boolean>('search.opensearch.dualWrite', false);
}

// ─── Search Query Routing ──────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE_FALLBACK = 24;
const MAX_PAGE_SIZE_FALLBACK = 48;

async function resolvePageSize(requested: number | undefined): Promise<number> {
  const [defaultSize, maxSize] = await Promise.all([
    getPlatformSetting<number>('discovery.search.defaultPageSize', DEFAULT_PAGE_SIZE_FALLBACK),
    getPlatformSetting<number>('discovery.search.maxPageSize', MAX_PAGE_SIZE_FALLBACK),
  ]);
  return Math.min(requested ?? defaultSize, maxSize);
}

/**
 * Enforce the 30% promoted listings cap (D2.4).
 */
async function enforcePromotedCap(listings: ListingCardData[]): Promise<ListingCardData[]> {
  const maxSlots = await calculatePromotedSlots(listings.length);
  const boosted = listings.filter((l) => l.isBoosted);
  const organic = listings.filter((l) => !l.isBoosted);

  const keptBoosted = boosted.slice(0, maxSlots);
  const demoted = boosted.slice(maxSlots).map((l) => ({ ...l, isBoosted: false }));

  return [...keptBoosted, ...demoted, ...organic];
}

/**
 * Search listings via the active engine with automatic fallback.
 */
export async function searchViaEngine(
  filters: SearchFilters,
  context?: { userId?: string },
): Promise<SearchResult> {
  const engine = await getActiveSearchEngine(context);
  const limit = await resolvePageSize(filters.limit);

  try {
    let result: SearchResult;

    switch (engine) {
      case 'opensearch':
        result = await searchWithOpenSearch(filters, limit);
        break;
      case 'typesense':
        result = await searchWithTypesense(filters, limit);
        break;
      case 'postgres':
      default:
        result = await searchWithPostgres(filters, limit);
        break;
    }

    // D2.4: enforce promoted cap regardless of engine
    result.listings = await enforcePromotedCap(result.listings);
    return result;
  } catch (err) {
    logger.warn(`[search-engine] ${engine} failed, falling back to postgres`, {
      error: err instanceof Error ? err.message : String(err),
    });

    // Fallback chain: opensearch/typesense → postgres
    if (engine !== 'postgres') {
      try {
        const result = await searchWithPostgres(filters, limit);
        result.listings = await enforcePromotedCap(result.listings);
        return result;
      } catch (pgErr) {
        logger.error('[search-engine] PostgreSQL fallback also failed', {
          error: pgErr instanceof Error ? pgErr.message : String(pgErr),
        });
      }
    }

    // Complete failure — return empty
    return {
      listings: [],
      totalCount: 0,
      page: filters.page ?? 1,
      totalPages: 0,
      filters,
    };
  }
}

// ─── OpenSearch Search ──────────────────────────────────────────────────────────

async function searchWithOpenSearch(
  filters: SearchFilters,
  limit: number,
): Promise<SearchResult> {
  const { getOpenSearchClient } = await import('./opensearch-client');
  const { buildListingQuery, DEFAULT_RELEVANCE_WEIGHTS } = await import('./opensearch-query-builder');
  const { LISTINGS_READ_ALIAS } = await import('./opensearch-mapping');

  // Load weights from platform_settings
  const weights = { ...DEFAULT_RELEVANCE_WEIGHTS };
  const [tw, dw, bw, tgw, cw, pb, stb, fb, pmb] = await Promise.all([
    getPlatformSetting<number>('discovery.search.titleWeight', weights.titleWeight),
    getPlatformSetting<number>('discovery.search.descriptionWeight', weights.descriptionWeight),
    getPlatformSetting<number>('discovery.search.brandWeight', weights.brandWeight),
    getPlatformSetting<number>('discovery.search.tagsWeight', weights.tagsWeight),
    getPlatformSetting<number>('discovery.search.categoryWeight', weights.categoryWeight),
    getPlatformSetting<number>('discovery.search.phraseBoost', weights.phraseBoost),
    getPlatformSetting<number>('discovery.search.sellerTrustBoost', weights.sellerTrustBoost),
    getPlatformSetting<number>('discovery.search.freshnessBoost', weights.freshnessBoost),
    getPlatformSetting<number>('discovery.search.promotedBoost', weights.promotedBoost),
  ]);

  weights.titleWeight = tw;
  weights.descriptionWeight = dw;
  weights.brandWeight = bw;
  weights.tagsWeight = tgw;
  weights.categoryWeight = cw;
  weights.phraseBoost = pb;
  weights.sellerTrustBoost = stb;
  weights.freshnessBoost = fb;
  weights.promotedBoost = pmb;

  const queryDSL = buildListingQuery(filters, limit, weights);
  const client = getOpenSearchClient();

  const { body } = await client.search({
    index: LISTINGS_READ_ALIAS,
    body: queryDSL,
  });

  const hits = body.hits?.hits ?? [];
  const totalCount = typeof body.hits?.total === 'object'
    ? body.hits.total.value
    : body.hits?.total ?? 0;
  const page = filters.page ?? 1;

  const listings: ListingCardData[] = hits.map((hit: Record<string, unknown>) => {
    const doc = (hit as { _source: Record<string, unknown> })._source;
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
      isBoosted: Number(doc.boostPercent ?? 0) > 0,
      fulfillmentType: doc.fulfillmentType ? String(doc.fulfillmentType) : undefined,
    };
  });

  return {
    listings,
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit),
    filters,
  };
}

// ─── Typesense Search (delegated) ───────────────────────────────────────────────

async function searchWithTypesense(
  filters: SearchFilters,
  limit: number,
): Promise<SearchResult> {
  // Dynamic import to avoid loading Typesense when only OpenSearch is used
  const { getTypesenseClient } = await import('./typesense-client');
  const { LISTINGS_COLLECTION, DEFAULT_QUERY_BY, DEFAULT_QUERY_WEIGHTS } = await import('./typesense-schema');
  const { db } = await import('@twicely/db');
  const { category } = await import('@twicely/db/schema');
  const { eq } = await import('drizzle-orm');

  const page = filters.page ?? 1;

  // Build filter string
  const filterParts: string[] = ['availableQuantity:>0'];
  if (filters.categoryId) {
    const children = await db.select({ id: category.id }).from(category).where(eq(category.parentId, filters.categoryId));
    const allIds = [filters.categoryId, ...children.map((c) => c.id)];
    filterParts.push(`categoryId:[${allIds.join(',')}]`);
  }
  if (filters.condition && filters.condition.length > 0) {
    filterParts.push(`condition:[${filters.condition.join(',')}]`);
  }
  if (filters.minPrice !== undefined) filterParts.push(`priceCents:>=${filters.minPrice}`);
  if (filters.maxPrice !== undefined) filterParts.push(`priceCents:<=${filters.maxPrice}`);
  if (filters.freeShipping) filterParts.push('freeShipping:true');
  if (filters.brand) filterParts.push(`brand:=${filters.brand}`);
  if (filters.localPickup) filterParts.push('fulfillmentType:[LOCAL_ONLY,SHIP_AND_LOCAL]');

  let sortBy: string;
  switch (filters.sort) {
    case 'newest': sortBy = 'activatedAt:desc'; break;
    case 'price_asc': sortBy = 'priceCents:asc'; break;
    case 'price_desc': sortBy = 'priceCents:desc'; break;
    default:
      sortBy = filters.q ? '_text_match:desc,sellerScore:desc,activatedAt:desc' : 'activatedAt:desc';
      break;
  }

  const result = await getTypesenseClient()
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
      isBoosted: Number(doc.boostPercent ?? 0) > 0,
      fulfillmentType: doc.fulfillmentType ? String(doc.fulfillmentType) : undefined,
    };
  });

  return { listings, totalCount, page, totalPages: Math.ceil(totalCount / limit), filters };
}

// ─── PostgreSQL Fallback ────────────────────────────────────────────────────────

async function searchWithPostgres(
  filters: SearchFilters,
  limit: number,
): Promise<SearchResult> {
  const { db } = await import('@twicely/db');
  const { listing, listingImage, user, sellerProfile, sellerPerformance, category } = await import('@twicely/db/schema');
  const orm = await import('drizzle-orm');

  const page = filters.page ?? 1;
  const offset = (page - 1) * limit;
  const conditions = [orm.eq(listing.status, 'ACTIVE')];

  if (filters.q) {
    const words = filters.q.trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      const pattern = `%${word}%`;
      conditions.push(orm.or(orm.ilike(listing.title, pattern), orm.ilike(listing.description, pattern))!);
    }
  }
  if (filters.categoryId) {
    const children = await db.select({ id: category.id }).from(category).where(orm.eq(category.parentId, filters.categoryId));
    conditions.push(orm.inArray(listing.categoryId, [filters.categoryId, ...children.map((c) => c.id)]));
  }
  const validConditions = ['NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'NEW_WITH_DEFECTS', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'];
  if (filters.condition?.length) {
    const validated = filters.condition.filter((c) => validConditions.includes(c));
    if (validated.length > 0) conditions.push(orm.inArray(listing.condition, validated));
  }
  if (filters.minPrice !== undefined) conditions.push(orm.gte(listing.priceCents, filters.minPrice));
  if (filters.maxPrice !== undefined) conditions.push(orm.lte(listing.priceCents, filters.maxPrice));
  if (filters.freeShipping) conditions.push(orm.eq(listing.freeShipping, true));
  if (filters.brand) conditions.push(orm.ilike(listing.brand, `%${filters.brand}%`));
  if (filters.localPickup) conditions.push(orm.inArray(listing.fulfillmentType, ['LOCAL_ONLY', 'SHIP_AND_LOCAL']));

  const whereClause = orm.and(...conditions);
  const countResult = await db.select({ count: orm.sql<number>`count(*)::int` }).from(listing).where(whereClause);
  const totalCount = countResult[0]?.count ?? 0;

  let orderBy;
  switch (filters.sort) {
    case 'newest': orderBy = orm.desc(listing.createdAt); break;
    case 'price_asc': orderBy = orm.asc(listing.priceCents); break;
    case 'price_desc': orderBy = orm.desc(listing.priceCents); break;
    default: orderBy = orm.desc(listing.createdAt); break;
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
      boostPercent: listing.boostPercent,
      fulfillmentType: listing.fulfillmentType,
    })
    .from(listing)
    .leftJoin(user, orm.eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, orm.eq(listing.ownerUserId, sellerProfile.userId))
    .leftJoin(sellerPerformance, orm.eq(sellerProfile.id, sellerPerformance.sellerProfileId))
    .leftJoin(listingImage, orm.and(orm.eq(listingImage.listingId, listing.id), orm.eq(listingImage.isPrimary, true)))
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const mapped = rows.map((row) => ({
    ...mapToListingCard(row),
    isBoosted: (row.boostPercent ?? 0) > 0,
    fulfillmentType: row.fulfillmentType ?? undefined,
  }));

  return {
    listings: mapped,
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit),
    filters,
  };
}

// ─── Indexing Operations ────────────────────────────────────────────────────────

/**
 * Index a document to the active engine(s). Supports dual-write.
 */
export async function indexDocument(doc: ListingDocument): Promise<void> {
  const engine = await getPlatformSetting<string>('search.engine', 'typesense');
  const dualWrite = await isDualWriteEnabled();

  const tasks: Promise<void>[] = [];

  if (engine === 'opensearch' || dualWrite) {
    tasks.push(
      import('./opensearch-index').then((mod) => mod.upsertDocument(doc)).catch((err) => {
        logger.error('[search-engine] OpenSearch index failed', {
          docId: doc.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }),
    );
  }

  if (engine === 'typesense' || dualWrite) {
    tasks.push(
      import('./typesense-index').then((mod) => mod.upsertListingDocument(doc)).catch((err) => {
        logger.error('[search-engine] Typesense index failed', {
          docId: doc.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }),
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Delete a document from the active engine(s). Supports dual-write.
 */
export async function deleteDocumentFromIndex(listingId: string): Promise<void> {
  const engine = await getPlatformSetting<string>('search.engine', 'typesense');
  const dualWrite = await isDualWriteEnabled();

  const tasks: Promise<void>[] = [];

  if (engine === 'opensearch' || dualWrite) {
    tasks.push(
      import('./opensearch-index').then((mod) => mod.deleteDocument(listingId)).catch((err) => {
        logger.error('[search-engine] OpenSearch delete failed', { listingId, error: String(err) });
      }),
    );
  }

  if (engine === 'typesense' || dualWrite) {
    tasks.push(
      import('./typesense-index').then((mod) => mod.deleteListingDocument(listingId)).catch((err) => {
        logger.error('[search-engine] Typesense delete failed', { listingId, error: String(err) });
      }),
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Partial update fields on a document in the active engine(s).
 */
export async function partialUpdateDocument(
  listingId: string,
  fields: Partial<ListingDocument>,
): Promise<void> {
  const engine = await getPlatformSetting<string>('search.engine', 'typesense');
  const dualWrite = await isDualWriteEnabled();

  const tasks: Promise<void>[] = [];

  if (engine === 'opensearch' || dualWrite) {
    tasks.push(
      import('./opensearch-index').then((mod) => mod.partialUpdate(listingId, fields)).catch((err) => {
        logger.error('[search-engine] OpenSearch partial update failed', { listingId, error: String(err) });
      }),
    );
  }

  if (engine === 'typesense' || dualWrite) {
    // Typesense doesn't have native partial update — full upsert with merged fields
    tasks.push(
      import('./typesense-index').then((mod) => mod.upsertListingDocument({ id: listingId, ...fields } as ListingDocument)).catch((err) => {
        logger.error('[search-engine] Typesense partial update failed', { listingId, error: String(err) });
      }),
    );
  }

  await Promise.allSettled(tasks);
}

// ─── Search Analytics Logging ───────────────────────────────────────────────

/**
 * Log a search query to the searchQueryLog table (fire-and-forget).
 * Called after searchListings() returns results.
 */
export async function logSearchQuery(params: {
  queryText: string | null;
  normalizedQuery: string | null;
  resultCount: number;
  latencyMs: number;
  engine: string;
  facetUsageJson?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { db } = await import('@twicely/db');
    const { searchQueryLog } = await import('@twicely/db/schema');
    await db.insert(searchQueryLog).values({
      queryText: params.queryText,
      normalizedQuery: params.normalizedQuery,
      resultCount: params.resultCount,
      latencyMs: params.latencyMs,
      engine: params.engine,
      facetUsageJson: params.facetUsageJson ?? {},
    });
  } catch (err) {
    // Fire-and-forget — never block search results for analytics
    logger.warn('[search-engine] Failed to log search query', { error: String(err) });
  }
}
