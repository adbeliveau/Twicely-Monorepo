/**
 * OpenSearch query builder — converts SearchFilters to OpenSearch Query DSL.
 * Supports full-text search, filters, facets, sorting, fuzziness, and promoted boost.
 */

import type { SearchFilters } from './shared';
import { DEFAULT_FIELD_WEIGHTS, FACET_FIELDS } from './opensearch-mapping';

export interface RelevanceWeights {
  titleWeight: number;
  descriptionWeight: number;
  brandWeight: number;
  tagsWeight: number;
  categoryWeight: number;
  phraseBoost: number;
  sellerTrustBoost: number;
  freshnessBoost: number;
  promotedBoost: number;
}

export const DEFAULT_RELEVANCE_WEIGHTS: RelevanceWeights = {
  titleWeight: DEFAULT_FIELD_WEIGHTS.title,
  descriptionWeight: DEFAULT_FIELD_WEIGHTS.description,
  brandWeight: DEFAULT_FIELD_WEIGHTS.brand,
  tagsWeight: DEFAULT_FIELD_WEIGHTS.tags,
  categoryWeight: DEFAULT_FIELD_WEIGHTS.categoryName,
  phraseBoost: 2.0,
  sellerTrustBoost: 2,
  freshnessBoost: 2,
  promotedBoost: 4,
};

export interface OpenSearchQueryDSL {
  query: Record<string, unknown>;
  sort: Array<Record<string, unknown>>;
  from: number;
  size: number;
  aggs: Record<string, unknown>;
  highlight?: Record<string, unknown>;
}

/**
 * Build a complete OpenSearch query from SearchFilters.
 */
export function buildListingQuery(
  filters: SearchFilters,
  limit: number,
  weights: RelevanceWeights = DEFAULT_RELEVANCE_WEIGHTS,
): OpenSearchQueryDSL {
  const page = filters.page ?? 1;
  const from = (page - 1) * limit;

  // ── Build bool query ────────────────────────────────────────────────────
  const must: Array<Record<string, unknown>> = [];
  const should: Array<Record<string, unknown>> = [];
  const filterClauses: Array<Record<string, unknown>> = [];

  // Always filter to available items
  filterClauses.push({ range: { availableQuantity: { gt: 0 } } });

  // Text query
  const hasQuery = Boolean(filters.q && filters.q.trim() !== '' && filters.q !== '*');
  if (hasQuery) {
    const fields = [
      `title^${weights.titleWeight}`,
      `description^${weights.descriptionWeight}`,
      `brand^${weights.brandWeight}`,
      `tags^${weights.tagsWeight}`,
      `categoryName^${weights.categoryWeight}`,
    ];

    // Primary fuzzy match
    must.push({
      multi_match: {
        query: filters.q,
        fields,
        type: 'best_fields',
        fuzziness: 'AUTO',
        prefix_length: 1,
        minimum_should_match: '75%',
      },
    });

    // Exact phrase boost
    should.push({
      multi_match: {
        query: filters.q,
        fields: [`title^${weights.phraseBoost}`, 'brand'],
        type: 'phrase',
        boost: weights.phraseBoost,
      },
    });
  }

  // ── Filters ─────────────────────────────────────────────────────────────
  if (filters.categoryId) {
    // Category filter supports child category IDs (passed as array by caller)
    filterClauses.push({ term: { categoryId: filters.categoryId } });
  }

  if (filters.condition && filters.condition.length > 0) {
    filterClauses.push({ terms: { condition: filters.condition } });
  }

  if (filters.minPrice !== undefined) {
    filterClauses.push({ range: { priceCents: { gte: filters.minPrice } } });
  }

  if (filters.maxPrice !== undefined) {
    filterClauses.push({ range: { priceCents: { lte: filters.maxPrice } } });
  }

  if (filters.freeShipping) {
    filterClauses.push({ term: { freeShipping: true } });
  }

  if (filters.brand) {
    filterClauses.push({ term: { 'brand.keyword': filters.brand } });
  }

  if (filters.localPickup) {
    filterClauses.push({
      terms: { fulfillmentType: ['LOCAL_ONLY', 'SHIP_AND_LOCAL'] },
    });
  }

  // ── Assemble bool query ─────────────────────────────────────────────────
  const boolQuery: Record<string, unknown> = {
    filter: filterClauses,
  };

  if (must.length > 0) {
    boolQuery.must = must;
  } else {
    // Browse mode — no text query
    boolQuery.must = [{ match_all: {} }];
  }

  if (should.length > 0) {
    boolQuery.should = should;
    boolQuery.minimum_should_match = 0;
  }

  // ── Wrap with function_score for promoted boost ─────────────────────────
  let query: Record<string, unknown>;
  if (weights.promotedBoost > 0) {
    query = {
      function_score: {
        query: { bool: boolQuery },
        functions: [
          {
            field_value_factor: {
              field: 'boostPercent',
              factor: 0.01 * weights.promotedBoost,
              modifier: 'ln1p',
              missing: 0,
            },
          },
        ],
        boost_mode: 'sum',
        score_mode: 'sum',
      },
    };
  } else {
    query = { bool: boolQuery };
  }

  // ── Sort ────────────────────────────────────────────────────────────────
  const sort = buildSort(filters.sort, hasQuery ?? false);

  // ── Aggregations (facets) ───────────────────────────────────────────────
  const aggs: Record<string, unknown> = {};
  for (const field of FACET_FIELDS) {
    const aggName = field.replace('.keyword', '');
    aggs[aggName] = { terms: { field, size: 50 } };
  }

  // ── Highlight ───────────────────────────────────────────────────────────
  const highlight = hasQuery
    ? { fields: { title: { number_of_fragments: 0 } } }
    : undefined;

  return { query, sort, from, size: limit, aggs, highlight };
}

/**
 * Build category-aware query with child category IDs.
 */
export function buildCategoryFilterClause(
  categoryId: string,
  childCategoryIds: string[],
): Record<string, unknown> {
  const allIds = [categoryId, ...childCategoryIds];
  return { terms: { categoryId: allIds } };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSort(
  sort: SearchFilters['sort'],
  hasTextQuery: boolean,
): Array<Record<string, unknown>> {
  switch (sort) {
    case 'newest':
      return [{ activatedAt: { order: 'desc' } }];
    case 'price_asc':
      return [{ priceCents: { order: 'asc' } }];
    case 'price_desc':
      return [{ priceCents: { order: 'desc' } }];
    case 'relevance':
    default:
      if (hasTextQuery) {
        // Score first, then seller quality, then freshness
        return [
          { _score: { order: 'desc' } },
          { sellerScore: { order: 'desc' } },
          { activatedAt: { order: 'desc' } },
        ];
      }
      // No text query — sort by newest
      return [{ activatedAt: { order: 'desc' } }];
  }
}
