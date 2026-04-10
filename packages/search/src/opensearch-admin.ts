/**
 * OpenSearch admin queries — cluster health, index stats, synonyms.
 * Used by /cfg/search/* admin pages.
 */

import { getOpenSearchClient } from './opensearch-client';
import { LISTINGS_READ_ALIAS, LISTINGS_INDEX_PREFIX } from './opensearch-mapping';

export interface ClusterHealth {
  status: 'green' | 'yellow' | 'red';
  numberOfNodes: number;
  activeShards: number;
  relocatingShards: number;
  unassignedShards: number;
  pendingTasks: number;
}

export interface IndexStats {
  indexName: string;
  docCount: number;
  sizeBytes: number;
  searchQueryTotal: number;
  searchQueryTimeMs: number;
  indexingTotal: number;
  indexingTimeMs: number;
}

export interface SynonymSet {
  id: string;
  terms: string[];
}

/** Get OpenSearch cluster health. */
export async function getClusterHealth(): Promise<ClusterHealth> {
  const client = getOpenSearchClient();
  const { body } = await client.cluster.health({});

  return {
    status: body.status as ClusterHealth['status'],
    numberOfNodes: body.number_of_nodes ?? 0,
    activeShards: body.active_shards ?? 0,
    relocatingShards: body.relocating_shards ?? 0,
    unassignedShards: body.unassigned_shards ?? 0,
    pendingTasks: body.number_of_pending_tasks ?? 0,
  };
}

/** Get stats for all listings indices. */
export async function getIndexStats(): Promise<IndexStats[]> {
  const client = getOpenSearchClient();

  try {
    const { body } = await client.indices.stats({
      index: `${LISTINGS_INDEX_PREFIX}*`,
      metric: 'docs,store,search,indexing',
    });

    const indices = body.indices ?? {};
    return Object.entries(indices).map(([name, data]) => {
      const stats = (data as Record<string, unknown>).total as Record<string, Record<string, number>> | undefined;
      return {
        indexName: name,
        docCount: stats?.docs?.count ?? 0,
        sizeBytes: stats?.store?.size_in_bytes ?? 0,
        searchQueryTotal: stats?.search?.query_total ?? 0,
        searchQueryTimeMs: stats?.search?.query_time_in_millis ?? 0,
        indexingTotal: stats?.indexing?.index_total ?? 0,
        indexingTimeMs: stats?.indexing?.index_time_in_millis ?? 0,
      };
    });
  } catch {
    // No indices exist yet
    return [];
  }
}

/** Get synonym sets from the active listings index. */
export async function getSynonyms(): Promise<SynonymSet[]> {
  const client = getOpenSearchClient();

  try {
    const { body } = await client.indices.getSettings({
      index: LISTINGS_READ_ALIAS,
      flat_settings: true,
    });

    // Synonyms are stored as an analyzer filter — extract them
    const indices = body ?? {};
    const firstIndex = Object.values(indices)[0] as Record<string, unknown> | undefined;
    const settings = firstIndex?.settings as Record<string, string> | undefined;

    const synonymFilter = settings?.['index.analysis.filter.synonym_filter.synonyms'];
    if (!synonymFilter) return [];

    // Parse comma-separated synonym lines: "sneakers,trainers,kicks"
    const lines = Array.isArray(synonymFilter) ? synonymFilter : [synonymFilter];
    return lines.map((line, i) => ({
      id: `syn-${i}`,
      terms: String(line).split(',').map((t) => t.trim()),
    }));
  } catch {
    return [];
  }
}

/** Apply synonym sets by closing/opening the index and updating settings. */
export async function applySynonyms(
  indexName: string,
  synonymSets: Array<{ terms: string[] }>,
): Promise<void> {
  const client = getOpenSearchClient();

  const synonymLines = synonymSets.map((set) => set.terms.join(','));

  // Close → update → open (required for analyzer changes)
  await client.indices.close({ index: indexName });

  try {
    await client.indices.putSettings({
      index: indexName,
      body: {
        analysis: {
          filter: {
            synonym_filter: {
              type: 'synonym',
              synonyms: synonymLines,
            },
          },
        },
      },
    });
  } finally {
    await client.indices.open({ index: indexName });
  }
}

/** Force refresh an index to make all pending writes searchable. */
export async function refreshIndex(indexName?: string): Promise<void> {
  const client = getOpenSearchClient();
  await client.indices.refresh({
    index: indexName ?? LISTINGS_READ_ALIAS,
  });
}

/** Get document count for the active read alias. */
export async function getDocCount(): Promise<number> {
  const client = getOpenSearchClient();
  try {
    const { body } = await client.count({ index: LISTINGS_READ_ALIAS });
    return body.count ?? 0;
  } catch {
    return 0;
  }
}
