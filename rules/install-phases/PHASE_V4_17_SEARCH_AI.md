# PHASE V4-17: Search AI & Discovery Install

**Canonical:** `07_SEARCH_AI_DISCOVERY.md`
**Depends On:** PHASE V4-16 (AI Module — `@twicely/ai` must exist for embeddings)
**Estimated Tests:** 60+

---

## Step 1: Typesense Schema — Vector Fields

### 1.1 Add vector fields to schema

**File:** `packages/search/src/typesense-schema.ts`

Add to the `fields` array in `listingsSchema`:

```ts
// ── Vector fields (V4 semantic search) ─────────────────────────────────
{ name: 'embedding', type: 'float[]', num_dim: 512, optional: true },
{ name: 'imageEmbedding', type: 'float[]', num_dim: 512, optional: true },
{ name: 'embeddingUpdatedAt', type: 'int64', index: true, optional: true },
```

### 1.2 Add to ListingDocument interface

**File:** `packages/search/src/typesense-index.ts`

Add to `ListingDocument`:

```ts
embedding?: number[];
imageEmbedding?: number[];
embeddingUpdatedAt?: number;
```

### 1.3 Add embedding text builder

**File:** `packages/search/src/embedding-text.ts`

```ts
import type { ListingDocument } from './typesense-index';

/**
 * Build composite text for embedding generation.
 * Deterministic: same input always produces same text.
 */
export function buildEmbeddingText(doc: ListingDocument): string {
  return [
    doc.title,
    doc.brand,
    doc.categoryName,
    doc.condition,
    doc.description?.slice(0, 500),
    doc.tags?.join(' '),
  ].filter(Boolean).join(' | ');
}
```

**Tests:** 3 tests (full fields, sparse fields, description truncation)

### 1.4 Wire embedding into upsert

**File:** `packages/search/src/typesense-index.ts`

Modify `upsertListingDocument` to optionally generate embedding:

```ts
import { buildEmbeddingText } from './embedding-text';

export async function upsertListingDocument(
  doc: ListingDocument,
  opts?: { generateEmbedding?: boolean }
): Promise<void> {
  if (opts?.generateEmbedding && !doc.embedding) {
    try {
      const { embedTexts } = await import('@twicely/ai/embeddings');
      const text = buildEmbeddingText(doc);
      const [embedding] = await embedTexts([text]);
      doc.embedding = embedding;
      doc.embeddingUpdatedAt = Date.now();
    } catch {
      // Embedding generation failed — index without it (graceful degradation)
    }
  }
  const client = getTypesenseClient();
  await client.collections(LISTINGS_COLLECTION).documents().upsert(doc);
}
```

**Note:** Dynamic import of `@twicely/ai/embeddings` to avoid hard dependency cycle. `@twicely/ai` is an **optional peerDependency**.

### 1.5 Update package.json

**File:** `packages/search/package.json`

Add optional peer dependency:

```json
{
  "peerDependencies": {
    "@twicely/ai": "workspace:*"
  },
  "peerDependenciesMeta": {
    "@twicely/ai": { "optional": true }
  }
}
```

### 1.6 Validation

```bash
npx turbo typecheck --filter=@twicely/search
npx turbo test --filter=@twicely/search
```

---

## Step 2: Hybrid Search

### 2.1 Add search mode to SearchFilters

**File:** `packages/search/src/shared.ts`

Add to `SearchFilters`:

```ts
export interface SearchFilters {
  q?: string;
  categoryId?: string;
  condition?: ('NEW_WITH_TAGS' | 'NEW_WITHOUT_TAGS' | 'NEW_WITH_DEFECTS' | 'LIKE_NEW' | 'VERY_GOOD' | 'GOOD' | 'ACCEPTABLE')[];
  minPrice?: number;
  maxPrice?: number;
  freeShipping?: boolean;
  brand?: string;
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
  /** V4: search mode */
  mode?: 'keyword' | 'hybrid' | 'semantic';
}
```

### 2.2 Hybrid search implementation

**File:** `packages/search/src/hybrid-search.ts`

```ts
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { getTypesenseClient } from './typesense-client';
import { LISTINGS_COLLECTION, DEFAULT_QUERY_BY, DEFAULT_QUERY_WEIGHTS } from './typesense-schema';
import type { SearchFilters, SearchResult, ListingCardData } from './shared';

export async function searchHybrid(
  filters: SearchFilters,
  queryEmbedding: number[]
): Promise<SearchResult> {
  const client = getTypesenseClient();
  const page = filters.page ?? 1;
  const limit = await resolvePageSize(filters.limit);
  const alpha = await getPlatformSetting<number>('search.hybrid.alpha', 0.3);

  const filterStr = buildFilterString(filters);

  let sortBy: string;
  switch (filters.sort) {
    case 'newest': sortBy = 'activatedAt:desc'; break;
    case 'price_asc': sortBy = 'priceCents:asc'; break;
    case 'price_desc': sortBy = 'priceCents:desc'; break;
    case 'relevance':
    default:
      sortBy = '_text_match:desc,_vector_distance:asc,sellerScore:desc,activatedAt:desc';
      break;
  }

  const result = await client
    .collections(LISTINGS_COLLECTION)
    .documents()
    .search({
      q: filters.q || '*',
      query_by: DEFAULT_QUERY_BY,
      query_by_weights: DEFAULT_QUERY_WEIGHTS,
      vector_query: `embedding:([${queryEmbedding.join(',')}], k:200, alpha:${alpha})`,
      filter_by: filterStr,
      sort_by: sortBy,
      per_page: limit,
      page,
      facet_by: 'condition,categoryId,brand,freeShipping,fulfillmentType,sellerPerformanceBand',
      num_typos: 2,
      typo_tokens_threshold: 3,
      prioritize_exact_match: true,
      highlight_full_fields: 'title',
    });

  return mapTypesenseResult(result, filters, limit);
}
```

### 2.3 Semantic-only search

**File:** `packages/search/src/semantic-search.ts`

```ts
export async function searchSemantic(
  filters: SearchFilters,
  queryEmbedding: number[]
): Promise<SearchResult> {
  const client = getTypesenseClient();
  const page = filters.page ?? 1;
  const limit = await resolvePageSize(filters.limit);

  const result = await client
    .collections(LISTINGS_COLLECTION)
    .documents()
    .search({
      q: '*',
      vector_query: `embedding:([${queryEmbedding.join(',')}], k:${limit * page})`,
      filter_by: buildFilterString(filters),
      per_page: limit,
      page,
    });

  return mapTypesenseResult(result, filters, limit);
}
```

### 2.4 Update searchListings router

**File:** `packages/search/src/listings.ts`

Modify `searchListings` to route by mode:

```ts
export async function searchListings(filters: SearchFilters): Promise<SearchResult> {
  const mode = filters.mode ?? 'keyword';
  const hybridEnabled = await getPlatformSetting<boolean>('search.hybrid.enabled', true);
  const semanticEnabled = await getPlatformSetting<boolean>('search.semantic.enabled', true);

  // If hybrid/semantic requested and enabled, try to generate query embedding
  if ((mode === 'hybrid' || mode === 'semantic') && filters.q) {
    try {
      const enabled = mode === 'hybrid' ? hybridEnabled : semanticEnabled;
      if (enabled) {
        const { embedQuery } = await import('@twicely/ai/embeddings');
        const queryEmbedding = await embedQuery(filters.q);

        if (mode === 'semantic') {
          const { searchSemantic } = await import('./semantic-search');
          return await searchSemantic(filters, queryEmbedding);
        }
        const { searchHybrid } = await import('./hybrid-search');
        return await searchHybrid(filters, queryEmbedding);
      }
    } catch {
      // AI/embedding unavailable — fall through to keyword
    }
  }

  // Default: keyword search (existing V3 path)
  try {
    return await searchWithTypesense(filters);
  } catch {
    return searchWithPostgres(filters);
  }
}
```

**Tests:** 8 tests (keyword mode, hybrid mode, semantic mode, hybrid disabled falls to keyword, embedding failure falls to keyword, Typesense down falls to PG, alpha setting respected, mode parameter routing)

---

## Step 3: Visual Search

**File:** `packages/search/src/visual-search.ts`

```ts
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { getTypesenseClient } from './typesense-client';
import { LISTINGS_COLLECTION } from './typesense-schema';
import type { SearchResult, SearchFilters } from './shared';

export interface VisualSearchRequest {
  imageUrl: string;
  categoryId?: string;
  limit?: number;
  page?: number;
  userId: string;
}

export async function searchByImage(req: VisualSearchRequest): Promise<SearchResult> {
  const enabled = await getPlatformSetting<boolean>('search.visual.enabled', true);
  if (!enabled) throw new Error('Visual search is disabled');

  // 1. Rate limit check
  const { checkRateLimit } = await import('@twicely/ai/rate-limiter');
  const { allowed } = await checkRateLimit('image-search', req.userId);
  if (!allowed) throw new Error('Daily visual search limit reached');

  // 2. Generate image description + embedding
  const { embedQuery } = await import('@twicely/ai/embeddings');
  const { analyzeImages } = await import('@twicely/ai/image-analysis');

  // Use image analysis to get a text description, then embed it
  // (V4.0 approach — V4.1 will use native CLIP embeddings)
  const analysis = await analyzeImages({
    imageUrls: [req.imageUrl],
    checks: ['quality', 'policy'],
  });
  if (analysis.policyViolations?.length) {
    throw new Error('Image contains policy violations');
  }

  // For V4.0: describe the image via vision, then embed the description
  const provider = await (await import('@twicely/ai/resolve-provider')).resolveProvider();
  const model = await getPlatformSetting<string>('ai.model.vision', 'gpt-4o-mini');
  const description = await provider.vision({
    model,
    systemPrompt: 'Describe this product image in detail for search matching. Include: item type, brand if visible, color, material, condition, style. Be concise.',
    userPrompt: 'Describe this product.',
    imageUrls: [req.imageUrl],
    maxTokens: 200,
    temperature: 0.1,
  });

  const queryEmbedding = await embedQuery(description.text);

  // 3. Vector search
  const client = getTypesenseClient();
  const limit = req.limit ?? 24;
  const filterParts = ['availableQuantity:>0'];
  if (req.categoryId) filterParts.push(`categoryId:=${req.categoryId}`);

  const result = await client
    .collections(LISTINGS_COLLECTION)
    .documents()
    .search({
      q: '*',
      vector_query: `embedding:([${queryEmbedding.join(',')}], k:${limit})`,
      filter_by: filterParts.join(' && '),
      per_page: limit,
      page: req.page ?? 1,
    });

  return mapTypesenseResult(result, { page: req.page }, limit);
}
```

**Tests:** 6 tests (happy path, disabled, rate limited, policy violation, category filter, provider error graceful)

---

## Step 4: Natural Language Query

**File:** `packages/search/src/nl-query.ts`

```ts
import { z } from 'zod';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { getCached, setCached, cacheKey } from '@twicely/ai/cache';
import type { SearchFilters } from './shared';

const NlParseSchema = z.object({
  keyword: z.string(),
  brand: z.string().nullable(),
  minPriceCents: z.number().nullable(),
  maxPriceCents: z.number().nullable(),
  condition: z.array(z.string()).nullable(),
  freeShipping: z.boolean().nullable(),
  confidence: z.number(),
});

export interface NlQueryParseResult {
  keyword: string;
  filters: Partial<SearchFilters>;
  confidence: number;
}

export async function parseNaturalLanguageQuery(query: string): Promise<NlQueryParseResult> {
  const enabled = await getPlatformSetting<boolean>('search.nlQuery.enabled', true);
  if (!enabled) return { keyword: query, filters: {}, confidence: 0 };

  // Check cache
  const ck = cacheKey('nl', query.toLowerCase().trim());
  const cached = await getCached('completion', ck);
  if (cached) return JSON.parse(cached);

  // Try local regex patterns first (brand names, size, price)
  const localResult = tryLocalParse(query);
  if (localResult.confidence >= 0.9) return localResult;

  // AI parse
  const { resolveProvider } = await import('@twicely/ai/resolve-provider');
  const provider = await resolveProvider();
  const model = await getPlatformSetting<string>('ai.model.completionDefault', 'gpt-4o-mini');

  const res = await provider.structured<z.infer<typeof NlParseSchema>>({
    model,
    systemPrompt: NL_SYSTEM_PROMPT,
    userPrompt: `Parse this search query: "${query}"`,
    schema: NlParseSchema,
    maxTokens: 256,
  });

  const result: NlQueryParseResult = {
    keyword: res.data.keyword,
    filters: {
      brand: res.data.brand ?? undefined,
      minPrice: res.data.minPriceCents ?? undefined,
      maxPrice: res.data.maxPriceCents ?? undefined,
      condition: (res.data.condition as SearchFilters['condition']) ?? undefined,
      freeShipping: res.data.freeShipping ?? undefined,
    },
    confidence: res.data.confidence,
  };

  // Cache for configured TTL
  const ttlHours = await getPlatformSetting<number>('search.nlQuery.cacheHours', 1);
  void setCached('completion', ck, JSON.stringify(result), ttlHours * 3600);

  return result;
}

// Local regex parser for common patterns (no AI call needed)
function tryLocalParse(query: string): NlQueryParseResult {
  let keyword = query;
  const filters: Partial<SearchFilters> = {};
  let confidence = 0;

  // Price: "under $50", "below $100", "$20-$50"
  const underMatch = query.match(/(?:under|below|less than)\s*\$?(\d+)/i);
  if (underMatch) {
    filters.maxPrice = parseInt(underMatch[1]!, 10) * 100;
    keyword = keyword.replace(underMatch[0], '').trim();
    confidence += 0.3;
  }
  const rangeMatch = query.match(/\$(\d+)\s*[-–]\s*\$(\d+)/);
  if (rangeMatch) {
    filters.minPrice = parseInt(rangeMatch[1]!, 10) * 100;
    filters.maxPrice = parseInt(rangeMatch[2]!, 10) * 100;
    keyword = keyword.replace(rangeMatch[0], '').trim();
    confidence += 0.3;
  }

  // Free shipping: "free shipping"
  if (/free shipping/i.test(query)) {
    filters.freeShipping = true;
    keyword = keyword.replace(/free shipping/i, '').trim();
    confidence += 0.2;
  }

  return { keyword: keyword.trim(), filters, confidence };
}

const NL_SYSTEM_PROMPT = `You parse search queries for a peer-to-peer resale marketplace (clothing, electronics, collectibles, etc.).
Extract: the core search keyword(s), brand name if mentioned, price range if mentioned (in cents), condition if mentioned, and free shipping preference.
Price examples: "under $50" = maxPriceCents: 5000. "$20-50" = minPriceCents: 2000, maxPriceCents: 5000.
Conditions: NEW_WITH_TAGS, LIKE_NEW, VERY_GOOD, GOOD, ACCEPTABLE.
Return confidence 0-1 based on how well you understood the query.`;
```

**Tests:** 7 tests (local parse price, local parse free shipping, local parse range, AI fallback, cache hit, disabled returns raw, NL injection sanitized)

---

## Step 5: Smart Autocomplete

**File:** `packages/search/src/autocomplete.ts`

```ts
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

export interface AutocompleteSuggestion {
  text: string;
  type: 'query' | 'category' | 'brand' | 'ai';
  metadata?: { categoryId?: string; resultCount?: number };
}

export async function getAutocompleteSuggestions(
  prefix: string,
  limit?: number
): Promise<AutocompleteSuggestion[]> {
  const enabled = await getPlatformSetting<boolean>('search.autocomplete.enabled', true);
  if (!enabled) return [];

  const maxSuggestions = limit ?? await getPlatformSetting<number>('search.autocomplete.maxSuggestions', 8);
  const normalized = prefix.toLowerCase().trim();
  if (normalized.length < 2) return [];

  const results: AutocompleteSuggestion[] = [];

  // 1. Popular queries (from Valkey sorted set)
  const popular = await getPopularQueries(normalized, 3);
  results.push(...popular.map((text) => ({ text, type: 'query' as const })));

  // 2. Category matches
  const categories = await getCategoryMatches(normalized, 2);
  results.push(...categories);

  // 3. Brand matches
  const brands = await getBrandMatches(normalized, 2);
  results.push(...brands.map((text) => ({ text, type: 'brand' as const })));

  return results.slice(0, maxSuggestions);
}

// Valkey-backed helpers (stubs — implementation reads from pre-populated sorted sets)
async function getPopularQueries(prefix: string, limit: number): Promise<string[]> {
  // ZRANGEBYLEX search:popular [prefix [prefix\xff LIMIT 0 {limit}
  return []; // Implementation reads from Valkey
}

async function getCategoryMatches(prefix: string, limit: number): Promise<AutocompleteSuggestion[]> {
  // ZRANGEBYLEX search:categories [prefix [prefix\xff LIMIT 0 {limit}
  return [];
}

async function getBrandMatches(prefix: string, limit: number): Promise<string[]> {
  // ZRANGEBYLEX search:brands [prefix [prefix\xff LIMIT 0 {limit}
  return [];
}
```

**Tests:** 5 tests (popular queries, category matches, brand matches, max limit, disabled returns empty)

---

## Step 6: Similar Items

**File:** `packages/search/src/similar-items.ts`

```ts
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { getTypesenseClient } from './typesense-client';
import { LISTINGS_COLLECTION } from './typesense-schema';
import type { ListingCardData } from './shared';

export async function findSimilarListings(
  listingId: string,
  opts?: { limit?: number; excludeSellerIds?: string[] }
): Promise<ListingCardData[]> {
  const enabled = await getPlatformSetting<boolean>('search.similar.enabled', true);
  if (!enabled) return [];

  const limit = opts?.limit ?? await getPlatformSetting<number>('search.similar.limit', 12);
  const excludeSameSeller = await getPlatformSetting<boolean>('search.similar.excludeSameSeller', true);

  const client = getTypesenseClient();

  // Fetch the source listing's embedding
  let sourceDoc: Record<string, unknown>;
  try {
    sourceDoc = await client
      .collections(LISTINGS_COLLECTION)
      .documents(listingId)
      .retrieve() as Record<string, unknown>;
  } catch {
    return []; // Listing not in index
  }

  const embedding = sourceDoc.embedding as number[] | undefined;
  if (!embedding?.length) return []; // No embedding — cannot find similar

  // Build filter: exclude source listing, optionally exclude same seller
  const filterParts = [`id:!=${listingId}`, 'availableQuantity:>0'];
  if (excludeSameSeller && sourceDoc.ownerUserId) {
    filterParts.push(`ownerUserId:!=${sourceDoc.ownerUserId}`);
  }
  if (opts?.excludeSellerIds?.length) {
    for (const sid of opts.excludeSellerIds) {
      filterParts.push(`ownerUserId:!=${sid}`);
    }
  }

  const result = await client
    .collections(LISTINGS_COLLECTION)
    .documents()
    .search({
      q: '*',
      vector_query: `embedding:([${embedding.join(',')}], k:${limit})`,
      filter_by: filterParts.join(' && '),
      per_page: limit,
      page: 1,
    });

  return mapHitsToCards(result.hits ?? []);
}
```

**Tests:** 6 tests (happy path, disabled, no embedding returns empty, excludes source, excludes same seller, excludes specified sellers)

---

## Step 7: Recommendations ("For You" Feed)

**File:** `packages/search/src/recommendations.ts`

```ts
import { db } from '@twicely/db';
import { userInterest } from '@twicely/db/schema';
import { eq, and, gt, isNull, or } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { getTypesenseClient } from './typesense-client';
import { LISTINGS_COLLECTION } from './typesense-schema';
import type { ListingCardData, SearchResult } from './shared';

export interface RecommendationRequest {
  userId: string;
  limit?: number;
  page?: number;
  excludeListingIds?: string[];
}

export async function getRecommendations(req: RecommendationRequest): Promise<SearchResult> {
  const enabled = await getPlatformSetting<boolean>('search.recommendations.enabled', true);
  if (!enabled) return fallbackTrending(req);

  try {
    return await generateRecommendations(req);
  } catch {
    return fallbackTrending(req);
  }
}

async function generateRecommendations(req: RecommendationRequest): Promise<SearchResult> {
  const limit = req.limit ?? 24;
  const page = req.page ?? 1;

  // 1. Fetch user interests (non-expired)
  const now = new Date();
  const interests = await db
    .select({ tagSlug: userInterest.tagSlug, weight: userInterest.weight, source: userInterest.source })
    .from(userInterest)
    .where(
      and(
        eq(userInterest.userId, req.userId),
        or(isNull(userInterest.expiresAt), gt(userInterest.expiresAt, now))
      )
    );

  if (interests.length === 0) return fallbackTrending(req);

  // 2. Build weighted interest text for embedding
  const interestText = interests
    .sort((a, b) => parseFloat(b.weight) - parseFloat(a.weight))
    .slice(0, 10)
    .map((i) => i.tagSlug.replace(/-/g, ' '))
    .join(', ');

  // 3. Embed user interests
  const { embedQuery } = await import('@twicely/ai/embeddings');
  const userEmbedding = await embedQuery(interestText);

  // 4. Vector search
  const client = getTypesenseClient();
  const filterParts = ['availableQuantity:>0'];
  if (req.excludeListingIds?.length) {
    for (const id of req.excludeListingIds.slice(0, 50)) {
      filterParts.push(`id:!=${id}`);
    }
  }

  const result = await client
    .collections(LISTINGS_COLLECTION)
    .documents()
    .search({
      q: '*',
      vector_query: `embedding:([${userEmbedding.join(',')}], k:${limit * page})`,
      filter_by: filterParts.join(' && '),
      per_page: limit,
      page,
    });

  const listings = mapHitsToCards(result.hits ?? []);

  // 5. Apply diversity filter
  const diversified = applyDiversityFilter(listings);

  return {
    listings: diversified,
    totalCount: result.found,
    page,
    totalPages: Math.ceil(result.found / limit),
    filters: { page },
  };
}

function applyDiversityFilter(listings: ListingCardData[]): ListingCardData[] {
  const sellerCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const maxPerSeller = 3;

  return listings.filter((l) => {
    const sellerCount = sellerCounts.get(l.sellerUsername) ?? 0;
    if (sellerCount >= maxPerSeller) return false;
    sellerCounts.set(l.sellerUsername, sellerCount + 1);
    return true;
  });
}

async function fallbackTrending(req: RecommendationRequest): Promise<SearchResult> {
  // Trending = newest popular items (no AI needed)
  const client = getTypesenseClient();
  const limit = req.limit ?? 24;
  const result = await client
    .collections(LISTINGS_COLLECTION)
    .documents()
    .search({
      q: '*',
      filter_by: 'availableQuantity:>0',
      sort_by: 'sellerScore:desc,activatedAt:desc',
      per_page: limit,
      page: req.page ?? 1,
    });

  return {
    listings: mapHitsToCards(result.hits ?? []),
    totalCount: result.found,
    page: req.page ?? 1,
    totalPages: Math.ceil(result.found / limit),
    filters: { page: req.page },
  };
}
```

**Tests:** 8 tests (with interests, no interests falls to trending, expired interests excluded, diversity filter, max 3 per seller, exclude listing IDs, disabled falls to trending, AI error falls to trending)

---

## Step 8: Synonyms Management

**File:** `packages/search/src/synonyms.ts`

```ts
import { getTypesenseClient } from './typesense-client';
import { LISTINGS_COLLECTION } from './typesense-schema';

export interface SynonymEntry {
  id: string;
  words: string[];
}

export async function addSynonym(words: string[]): Promise<string> {
  const client = getTypesenseClient();
  const id = `syn-${Date.now()}`;
  await client.collections(LISTINGS_COLLECTION).synonyms().upsert(id, { synonyms: words });
  return id;
}

export async function removeSynonym(id: string): Promise<void> {
  const client = getTypesenseClient();
  await client.collections(LISTINGS_COLLECTION).synonyms(id).delete();
}

export async function listSynonyms(): Promise<SynonymEntry[]> {
  const client = getTypesenseClient();
  const result = await client.collections(LISTINGS_COLLECTION).synonyms().retrieve();
  return result.synonyms.map((s) => ({ id: s.id!, words: s.synonyms ?? s.root ? [s.root!, ...(s.synonyms ?? [])] : [] }));
}
```

**Tests:** 3 tests (add, remove, list)

---

## Step 9: Embedding Backfill Job

**File:** `packages/jobs/src/ai-embedding-backfill.ts`

```ts
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

export async function processEmbeddingBackfill(): Promise<{ processed: number; failed: number }> {
  const batchSize = await getPlatformSetting<number>('search.embedding.backfillBatchSize', 100);

  // 1. Query Typesense for listings without embeddings (embeddingUpdatedAt is null/0)
  // 2. For each batch, generate embeddings via @twicely/ai/embeddings
  // 3. Upsert back to Typesense with embedding + embeddingUpdatedAt

  // Dynamic imports to avoid hard dep
  const { getTypesenseClient } = await import('@twicely/search/typesense-client');
  const { LISTINGS_COLLECTION } = await import('@twicely/search/typesense-schema');
  const { embedTexts } = await import('@twicely/ai/embeddings');
  const { buildEmbeddingText } = await import('@twicely/search/embedding-text');

  const client = getTypesenseClient();
  const result = await client
    .collections(LISTINGS_COLLECTION)
    .documents()
    .search({
      q: '*',
      filter_by: 'embeddingUpdatedAt:=0 || embeddingUpdatedAt:!*',
      per_page: batchSize,
      page: 1,
      include_fields: 'id,title,description,brand,categoryName,condition,tags',
    });

  const docs = (result.hits ?? []).map((h) => h.document as Record<string, unknown>);
  if (docs.length === 0) return { processed: 0, failed: 0 };

  const texts = docs.map((d) => buildEmbeddingText(d as any));
  let processed = 0;
  let failed = 0;

  try {
    const embeddings = await embedTexts(texts);
    const now = Date.now();

    for (let i = 0; i < docs.length; i++) {
      try {
        await client
          .collections(LISTINGS_COLLECTION)
          .documents(String(docs[i]!.id))
          .update({ embedding: embeddings[i], embeddingUpdatedAt: now });
        processed++;
      } catch {
        failed++;
      }
    }
  } catch {
    failed = docs.length;
  }

  return { processed, failed };
}
```

**Tests:** 4 tests (batch processes, empty batch, partial failure, embedding error)

---

## Step 10: Platform Settings Seed

**File:** `packages/db/src/seed/seed-search-ai.ts`

```ts
import type { PlatformSettingSeed } from './v32-platform-settings';

export const SEARCH_AI_SETTINGS: PlatformSettingSeed[] = [
  { key: 'search.hybrid.enabled', value: true, type: 'boolean', category: 'search', description: 'Enable hybrid (keyword + vector) search' },
  { key: 'search.hybrid.alpha', value: 0.3, type: 'number', category: 'search', description: 'Vector weight in hybrid ranking (0=keyword, 1=vector)' },
  { key: 'search.semantic.enabled', value: true, type: 'boolean', category: 'search', description: 'Enable pure semantic search mode' },
  { key: 'search.visual.enabled', value: true, type: 'boolean', category: 'search', description: 'Enable visual (image) search' },
  { key: 'search.visual.dailyLimitPerUser', value: 30, type: 'number', category: 'search', description: 'Visual searches per user per day' },
  { key: 'search.nlQuery.enabled', value: true, type: 'boolean', category: 'search', description: 'Enable natural language query parsing' },
  { key: 'search.nlQuery.cacheHours', value: 1, type: 'number', category: 'search', description: 'NL parse result cache TTL (hours)' },
  { key: 'search.similar.enabled', value: true, type: 'boolean', category: 'search', description: 'Enable similar items section' },
  { key: 'search.similar.limit', value: 12, type: 'number', category: 'search', description: 'Max similar items shown' },
  { key: 'search.similar.excludeSameSeller', value: true, type: 'boolean', category: 'search', description: 'Exclude same seller from similar items' },
  { key: 'search.recommendations.enabled', value: true, type: 'boolean', category: 'search', description: 'Enable For You recommendations feed' },
  { key: 'search.recommendations.userEmbeddingTtlSeconds', value: 3600, type: 'number', category: 'search', description: 'User embedding cache TTL' },
  { key: 'search.recommendations.diversityMinCategories', value: 3, type: 'number', category: 'search', description: 'Minimum category diversity in recommendations' },
  { key: 'search.recommendations.explorationPct', value: 10, type: 'number', category: 'search', description: 'Percentage of results from exploration pool' },
  { key: 'search.personalization.enabled', value: true, type: 'boolean', category: 'search', description: 'Enable personalized re-ranking' },
  { key: 'search.personalization.maxBoostPct', value: 15, type: 'number', category: 'search', description: 'Max personalization boost percentage' },
  { key: 'search.autocomplete.enabled', value: true, type: 'boolean', category: 'search', description: 'Enable smart autocomplete' },
  { key: 'search.autocomplete.maxSuggestions', value: 8, type: 'number', category: 'search', description: 'Max autocomplete suggestions' },
  { key: 'search.embedding.backfillBatchSize', value: 100, type: 'number', category: 'search', description: 'Batch size for embedding backfill job' },
];
```

Import and call from `packages/db/src/seed.ts`.

---

## Step 11: Shared Helpers (Extract)

### 11.1 Filter builder

**File:** `packages/search/src/filter-builder.ts`

Extract the filter string construction from `listings.ts` into a shared helper used by keyword, hybrid, semantic, and visual search:

```ts
export function buildFilterString(filters: SearchFilters): string;
```

### 11.2 Result mapper

**File:** `packages/search/src/result-mapper.ts`

Extract the Typesense result-to-SearchResult mapping:

```ts
export function mapTypesenseResult(result: SearchResult, filters: SearchFilters, limit: number): SearchResult;
export function mapHitsToCards(hits: Array<{ document: unknown }>): ListingCardData[];
```

**Tests:** 4 tests (filter building, result mapping, empty results, facet extraction)

---

## Step 12: Validation

```bash
pnpm install
npx turbo typecheck                       # All packages pass
npx turbo test --filter=@twicely/search   # Existing + 60 new tests
npx turbo test --filter=@twicely/jobs     # Backfill job tests
npx turbo test                            # 9838+ baseline preserved
```

---

## Deliverables Checklist

- [ ] `packages/search/src/typesense-schema.ts` — 3 vector fields added
- [ ] `packages/search/src/typesense-index.ts` — embedding fields + generation
- [ ] `packages/search/src/embedding-text.ts` — composite text builder
- [ ] `packages/search/src/hybrid-search.ts` — hybrid search
- [ ] `packages/search/src/semantic-search.ts` — semantic-only search
- [ ] `packages/search/src/visual-search.ts` — image-based search
- [ ] `packages/search/src/nl-query.ts` — natural language parsing
- [ ] `packages/search/src/autocomplete.ts` — smart autocomplete
- [ ] `packages/search/src/similar-items.ts` — "More Like This"
- [ ] `packages/search/src/recommendations.ts` — "For You" feed
- [ ] `packages/search/src/synonyms.ts` — synonym management
- [ ] `packages/search/src/filter-builder.ts` — shared filter construction
- [ ] `packages/search/src/result-mapper.ts` — shared result mapping
- [ ] `packages/search/src/shared.ts` — mode field added to SearchFilters
- [ ] `packages/search/src/listings.ts` — mode routing in searchListings
- [ ] `packages/search/package.json` — optional peer dep on @twicely/ai
- [ ] `packages/jobs/src/ai-embedding-backfill.ts` — backfill job
- [ ] `packages/db/src/seed/seed-search-ai.ts` — 19 platform settings
- [ ] 60+ new tests passing
- [ ] All existing search tests preserved
- [ ] Typecheck clean
- [ ] Baseline tests preserved
