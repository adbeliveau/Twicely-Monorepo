import { describe, it, expect } from 'vitest';
import {
  buildListingQuery,
  buildCategoryFilterClause,
  DEFAULT_RELEVANCE_WEIGHTS,
  type RelevanceWeights,
} from '../opensearch-query-builder';
import type { SearchFilters } from '../shared';

describe('buildListingQuery', () => {
  it('builds a match_all query when no text query is provided', () => {
    const result = buildListingQuery({}, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown>>>;
    const boolQuery = inner.function_score.query.bool;
    expect(boolQuery.must).toEqual([{ match_all: {} }]);
  });

  it('builds a multi_match query when q is provided', () => {
    const result = buildListingQuery({ q: 'nike shoes' }, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown[]>>>;
    const boolQuery = inner.function_score.query.bool;
    const must = boolQuery.must as Array<Record<string, unknown>>;
    expect(must).toHaveLength(1);
    const mm = must[0] as { multi_match: { query: string; type: string; fuzziness: string } };
    expect(mm.multi_match.query).toBe('nike shoes');
    expect(mm.multi_match.type).toBe('best_fields');
    expect(mm.multi_match.fuzziness).toBe('AUTO');
  });

  it('adds exact phrase boost in should when q is provided', () => {
    const result = buildListingQuery({ q: 'jordan retro' }, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown[]>>>;
    const boolQuery = inner.function_score.query.bool;
    const should = boolQuery.should as Array<Record<string, unknown>>;
    expect(should).toHaveLength(1);
    const phrase = should[0] as { multi_match: { type: string; boost: number } };
    expect(phrase.multi_match.type).toBe('phrase');
    expect(phrase.multi_match.boost).toBe(DEFAULT_RELEVANCE_WEIGHTS.phraseBoost);
  });

  it('ignores q when it is just whitespace', () => {
    const result = buildListingQuery({ q: '   ' }, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown[]>>>;
    const must = inner.function_score.query.bool.must;
    expect(must).toEqual([{ match_all: {} }]);
  });

  it('ignores q when it is "*"', () => {
    const result = buildListingQuery({ q: '*' }, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown[]>>>;
    const must = inner.function_score.query.bool.must;
    expect(must).toEqual([{ match_all: {} }]);
  });

  it('always filters availableQuantity > 0', () => {
    const result = buildListingQuery({}, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown[]>>>;
    const filters = inner.function_score.query.bool.filter as Array<Record<string, unknown>>;
    expect(filters).toContainEqual({ range: { availableQuantity: { gt: 0 } } });
  });

  it('adds categoryId filter', () => {
    const result = buildListingQuery({ categoryId: 'cat-123' }, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown[]>>>;
    const filters = inner.function_score.query.bool.filter as Array<Record<string, unknown>>;
    expect(filters).toContainEqual({ term: { categoryId: 'cat-123' } });
  });

  it('adds condition terms filter', () => {
    const result = buildListingQuery({ condition: ['NEW_WITH_TAGS', 'LIKE_NEW'] }, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown[]>>>;
    const filters = inner.function_score.query.bool.filter as Array<Record<string, unknown>>;
    expect(filters).toContainEqual({ terms: { condition: ['NEW_WITH_TAGS', 'LIKE_NEW'] } });
  });

  it('adds price range filters', () => {
    const result = buildListingQuery({ minPrice: 1000, maxPrice: 5000 }, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown[]>>>;
    const filters = inner.function_score.query.bool.filter as Array<Record<string, unknown>>;
    expect(filters).toContainEqual({ range: { priceCents: { gte: 1000 } } });
    expect(filters).toContainEqual({ range: { priceCents: { lte: 5000 } } });
  });

  it('adds freeShipping filter', () => {
    const result = buildListingQuery({ freeShipping: true }, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown[]>>>;
    const filters = inner.function_score.query.bool.filter as Array<Record<string, unknown>>;
    expect(filters).toContainEqual({ term: { freeShipping: true } });
  });

  it('adds brand keyword filter', () => {
    const result = buildListingQuery({ brand: 'Nike' }, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown[]>>>;
    const filters = inner.function_score.query.bool.filter as Array<Record<string, unknown>>;
    expect(filters).toContainEqual({ term: { 'brand.keyword': 'Nike' } });
  });

  it('adds localPickup fulfillmentType filter', () => {
    const result = buildListingQuery({ localPickup: true }, 24);
    const inner = result.query as Record<string, Record<string, Record<string, unknown[]>>>;
    const filters = inner.function_score.query.bool.filter as Array<Record<string, unknown>>;
    expect(filters).toContainEqual({
      terms: { fulfillmentType: ['LOCAL_ONLY', 'SHIP_AND_LOCAL'] },
    });
  });

  it('wraps with function_score for promoted boost by default', () => {
    const result = buildListingQuery({}, 24);
    const query = result.query as Record<string, unknown>;
    expect(query).toHaveProperty('function_score');
    const fs = query.function_score as Record<string, unknown>;
    expect(fs.boost_mode).toBe('sum');
    const fns = fs.functions as Array<Record<string, Record<string, unknown>>>;
    expect(fns[0].field_value_factor.field).toBe('boostPercent');
  });

  it('skips function_score when promotedBoost is 0', () => {
    const weights: RelevanceWeights = { ...DEFAULT_RELEVANCE_WEIGHTS, promotedBoost: 0 };
    const result = buildListingQuery({}, 24, weights);
    const query = result.query as Record<string, unknown>;
    expect(query).toHaveProperty('bool');
    expect(query).not.toHaveProperty('function_score');
  });

  it('uses correct pagination', () => {
    const result = buildListingQuery({ page: 3 }, 24);
    expect(result.from).toBe(48); // (3-1) * 24
    expect(result.size).toBe(24);
  });

  it('defaults page to 1', () => {
    const result = buildListingQuery({}, 10);
    expect(result.from).toBe(0);
    expect(result.size).toBe(10);
  });

  it('generates facet aggregations', () => {
    const result = buildListingQuery({}, 24);
    expect(result.aggs).toHaveProperty('condition');
    expect(result.aggs).toHaveProperty('categoryId');
    expect(result.aggs).toHaveProperty('brand');
    expect(result.aggs).toHaveProperty('freeShipping');
    expect(result.aggs).toHaveProperty('fulfillmentType');
    expect(result.aggs).toHaveProperty('sellerPerformanceBand');
  });

  it('includes highlight for text queries', () => {
    const result = buildListingQuery({ q: 'nike' }, 24);
    expect(result.highlight).toBeDefined();
    expect(result.highlight?.fields).toHaveProperty('title');
  });

  it('omits highlight for browse queries', () => {
    const result = buildListingQuery({}, 24);
    expect(result.highlight).toBeUndefined();
  });
});

describe('buildListingQuery — sorting', () => {
  it('sorts by activatedAt desc for newest', () => {
    const result = buildListingQuery({ sort: 'newest' }, 24);
    expect(result.sort).toEqual([{ activatedAt: { order: 'desc' } }]);
  });

  it('sorts by priceCents asc for price_asc', () => {
    const result = buildListingQuery({ sort: 'price_asc' }, 24);
    expect(result.sort).toEqual([{ priceCents: { order: 'asc' } }]);
  });

  it('sorts by priceCents desc for price_desc', () => {
    const result = buildListingQuery({ sort: 'price_desc' }, 24);
    expect(result.sort).toEqual([{ priceCents: { order: 'desc' } }]);
  });

  it('sorts by _score + tiebreakers for relevance with text query', () => {
    const result = buildListingQuery({ q: 'nike', sort: 'relevance' }, 24);
    expect(result.sort).toEqual([
      { _score: { order: 'desc' } },
      { sellerScore: { order: 'desc' } },
      { activatedAt: { order: 'desc' } },
    ]);
  });

  it('sorts by activatedAt desc for relevance without text query', () => {
    const result = buildListingQuery({ sort: 'relevance' }, 24);
    expect(result.sort).toEqual([{ activatedAt: { order: 'desc' } }]);
  });
});

describe('buildCategoryFilterClause', () => {
  it('combines parent and child category IDs', () => {
    const clause = buildCategoryFilterClause('cat-1', ['cat-2', 'cat-3']);
    expect(clause).toEqual({ terms: { categoryId: ['cat-1', 'cat-2', 'cat-3'] } });
  });

  it('works with no child categories', () => {
    const clause = buildCategoryFilterClause('cat-1', []);
    expect(clause).toEqual({ terms: { categoryId: ['cat-1'] } });
  });
});
