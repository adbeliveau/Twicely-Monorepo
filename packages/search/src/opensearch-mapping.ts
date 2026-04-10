/**
 * OpenSearch index mapping for listings.
 * Converts the 28 Typesense fields to explicit OpenSearch mappings.
 * Text fields get text + keyword multi-fields for full-text + exact filtering.
 */

/** Stable read alias — all search queries target this. */
export const LISTINGS_READ_ALIAS = 'twicely_listings';

/** Write alias — incremental writes target this during normal operation. */
export const LISTINGS_WRITE_ALIAS = 'twicely_listings_write';

/** Physical index prefix for versioned indices. */
export const LISTINGS_INDEX_PREFIX = 'twicely_listings_v';

/** Default field weights for multi_match queries (matches Typesense DEFAULT_QUERY_WEIGHTS). */
export const DEFAULT_FIELD_WEIGHTS = {
  title: 10,
  description: 3,
  brand: 5,
  tags: 2,
  categoryName: 4,
} as const;

/** Default query_by fields (matches Typesense DEFAULT_QUERY_BY). */
export const DEFAULT_QUERY_FIELDS = ['title', 'description', 'brand', 'tags', 'categoryName'] as const;

/** Facet fields used in aggregations. */
export const FACET_FIELDS = [
  'condition',
  'categoryId',
  'brand.keyword',
  'freeShipping',
  'fulfillmentType',
  'sellerPerformanceBand',
] as const;

/** Index settings with custom analyzers. */
export const LISTINGS_INDEX_SETTINGS = {
  number_of_shards: 1,
  number_of_replicas: 0,
  'index.max_result_window': 10000,
  analysis: {
    analyzer: {
      listing_analyzer: {
        type: 'custom' as const,
        tokenizer: 'standard',
        filter: ['lowercase', 'asciifolding', 'listing_edge_ngram'],
      },
      listing_search_analyzer: {
        type: 'custom' as const,
        tokenizer: 'standard',
        filter: ['lowercase', 'asciifolding'],
      },
    },
    filter: {
      listing_edge_ngram: {
        type: 'edge_ngram' as const,
        min_gram: 2,
        max_gram: 15,
      },
    },
  },
} as const;

/** Explicit field mappings — no dynamic mapping. */
export const LISTINGS_INDEX_MAPPINGS = {
  dynamic: 'strict' as const,
  properties: {
    // ── Searchable text fields (text + keyword multi-field) ──────────────────
    title: {
      type: 'text' as const,
      analyzer: 'listing_analyzer',
      search_analyzer: 'listing_search_analyzer',
      fields: { keyword: { type: 'keyword' as const, ignore_above: 256 } },
    },
    description: {
      type: 'text' as const,
      analyzer: 'listing_analyzer',
      search_analyzer: 'listing_search_analyzer',
    },
    brand: {
      type: 'text' as const,
      fields: { keyword: { type: 'keyword' as const, ignore_above: 128 } },
    },
    tags: {
      type: 'text' as const,
      fields: { keyword: { type: 'keyword' as const } },
    },
    categoryName: {
      type: 'text' as const,
      fields: { keyword: { type: 'keyword' as const, ignore_above: 128 } },
    },

    // ── Facet / filter fields (keyword for exact aggregations) ──────────────
    categoryId: { type: 'keyword' as const },
    categorySlug: { type: 'keyword' as const, index: false },
    condition: { type: 'keyword' as const },
    fulfillmentType: { type: 'keyword' as const },
    authenticationStatus: { type: 'keyword' as const },
    sellerPerformanceBand: { type: 'keyword' as const },
    freeShipping: { type: 'boolean' as const },
    ownerUserId: { type: 'keyword' as const },
    storefrontCategoryId: { type: 'keyword' as const },

    // ── Numeric / sort fields ───────────────────────────────────────────────
    priceCents: { type: 'integer' as const },
    originalPriceCents: { type: 'integer' as const },
    shippingCents: { type: 'integer' as const },
    availableQuantity: { type: 'integer' as const },
    sellerScore: { type: 'integer' as const },
    sellerTotalReviews: { type: 'integer' as const },
    boostPercent: { type: 'float' as const },
    activatedAt: { type: 'long' as const },
    createdAt: { type: 'long' as const },

    // ── Display-only fields (not indexed) ───────────────────────────────────
    slug: { type: 'keyword' as const, index: false },
    dealBadgeType: { type: 'keyword' as const, index: false },
    sellerName: { type: 'keyword' as const, index: false },
    sellerUsername: { type: 'keyword' as const, index: false },
    sellerAvatarUrl: { type: 'keyword' as const, index: false },
    sellerAverageRating: { type: 'float' as const, index: false },
    sellerShowStars: { type: 'boolean' as const, index: false },
    primaryImageUrl: { type: 'keyword' as const, index: false },
    primaryImageAlt: { type: 'keyword' as const, index: false },
  },
};
