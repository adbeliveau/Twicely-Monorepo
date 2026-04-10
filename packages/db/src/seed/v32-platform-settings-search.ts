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
  // INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'infrastructure.opensearch.url', value: 'http://127.0.0.1:9200', type: 'string', category: 'infrastructure', description: 'OpenSearch cluster URL' },
];
