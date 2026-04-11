/**
 * v3.2 Platform Settings — Search Engine (Decision #143)
 *
 * OpenSearch engine configuration, relevance weights, reindex params,
 * and infrastructure connection settings.
 */

import type { PlatformSettingSeed } from './v32-platform-settings';

export const V32_PLATFORM_SETTINGS_SEARCH: PlatformSettingSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH ENGINE CONFIG
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'search.engine', value: 'typesense', type: 'string', category: 'search', description: 'Active search engine: typesense | opensearch | postgres' },
  { key: 'search.opensearch.dualWrite', value: false, type: 'boolean', category: 'search', description: 'Write to both Typesense and OpenSearch simultaneously' },
  { key: 'search.opensearch.numberOfShards', value: 1, type: 'number', category: 'search', description: 'OpenSearch index shard count (adjust for scale)' },
  { key: 'search.opensearch.numberOfReplicas', value: 0, type: 'number', category: 'search', description: 'OpenSearch replica count (0 for dev, 1+ for prod)' },
  { key: 'search.opensearch.fuzziness', value: 'AUTO', type: 'string', category: 'search', description: 'OpenSearch fuzziness mode (AUTO, 0, 1, 2)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // REINDEX CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'search.reindex.batchSize', value: 500, type: 'number', category: 'search', description: 'Batch size for full reindex job' },
  { key: 'search.reindex.concurrency', value: 3, type: 'number', category: 'search', description: 'Concurrent bulk upsert batches during reindex' },

  // ═══════════════════════════════════════════════════════════════════════════
  // RELEVANCE WEIGHTS (used by opensearch-query-builder)
  // Note: discovery.search.titleWeight and discovery.search.descriptionWeight
  //       already exist in v32-platform-settings-extended.ts
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'discovery.search.brandWeight', value: 5, type: 'number', category: 'discovery', description: 'Weight for brand matches in OpenSearch ranking' },
  { key: 'discovery.search.tagsWeight', value: 2, type: 'number', category: 'discovery', description: 'Weight for tags matches in OpenSearch ranking' },
  { key: 'discovery.search.categoryWeight', value: 4, type: 'number', category: 'discovery', description: 'Weight for category name matches in OpenSearch ranking' },
  { key: 'discovery.search.phraseBoost', value: 2.0, type: 'number', category: 'discovery', description: 'Boost factor for exact phrase matches' },
  { key: 'discovery.search.sellerTrustBoost', value: 2, type: 'number', category: 'discovery', description: 'Boost factor for trusted seller listings' },
  { key: 'discovery.search.freshnessBoost', value: 2, type: 'number', category: 'discovery', description: 'Boost factor for recently listed items' },
  { key: 'discovery.search.promotedBoost', value: 4, type: 'number', category: 'discovery', description: 'Boost factor for promoted/boosted listings (D2.4)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // GEO-PROXIMITY SEARCH (Decision #144)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'discovery.geo.enabled', value: true, type: 'boolean', category: 'discovery', description: 'Master kill switch for geo-proximity search features' },
  { key: 'discovery.geo.defaultRadiusMiles', value: 25, type: 'number', category: 'discovery', description: 'Default search radius in miles when location is active' },
  { key: 'discovery.geo.maxRadiusMiles', value: 100, type: 'number', category: 'discovery', description: 'Maximum selectable search radius in miles' },
  { key: 'discovery.geo.radiusOptions', value: '5,10,25,50,100', type: 'string', category: 'discovery', description: 'Comma-separated radius options for UI dropdown' },
  { key: 'discovery.geo.proximityBoost', value: 3.0, type: 'number', category: 'discovery', description: 'Weight for proximity Gaussian decay function in relevance scoring' },
  { key: 'discovery.geo.decayScale', value: '25mi', type: 'string', category: 'discovery', description: 'Distance at which proximity score decays to 50%' },
  { key: 'discovery.geo.decayOffset', value: '5mi', type: 'string', category: 'discovery', description: 'Distance within which proximity score is 1.0 (no decay)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'infrastructure.opensearch.url', value: 'http://127.0.0.1:9200', type: 'string', category: 'infrastructure', description: 'OpenSearch cluster URL' },
];
