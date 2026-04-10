/**
 * Search listings — delegates to the search engine abstraction layer.
 *
 * This module is the public API for listing search. It routes through
 * search-engine.ts which handles engine selection (OpenSearch/Typesense/Postgres),
 * dual-write, feature flags, and fallback.
 */

import { searchViaEngine } from './search-engine';
import type { SearchFilters, SearchResult } from './shared';

/**
 * Search listings with the active search engine.
 * Supports typo tolerance, faceted filtering, and relevance ranking.
 * Falls back to PostgreSQL ILIKE when the primary engine is down.
 */
export async function searchListings(
  filters: SearchFilters,
  context?: { userId?: string },
): Promise<SearchResult> {
  return searchViaEngine(filters, context);
}
