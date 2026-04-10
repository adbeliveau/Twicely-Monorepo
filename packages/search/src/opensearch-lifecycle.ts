/**
 * OpenSearch index lifecycle — versioned indices + alias management.
 * Supports safe reindex, alias swap, and rollback.
 */

import { getOpenSearchClient } from './opensearch-client';
import {
  LISTINGS_READ_ALIAS,
  LISTINGS_WRITE_ALIAS,
  LISTINGS_INDEX_PREFIX,
  LISTINGS_INDEX_SETTINGS,
  LISTINGS_INDEX_MAPPINGS,
} from './opensearch-mapping';

export interface IndexInfo {
  name: string;
  docCount: number;
  sizeBytes: number;
  createdAt: string;
  isReadActive: boolean;
  isWriteActive: boolean;
}

/**
 * Create a new versioned physical index with the listings mapping.
 * Returns the physical index name (e.g. `twicely_listings_v2_20260410153000`).
 */
export async function createVersionedIndex(version: number): Promise<string> {
  const client = getOpenSearchClient();
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const indexName = `${LISTINGS_INDEX_PREFIX}${version}_${timestamp}`;

  await client.indices.create({
    index: indexName,
    body: {
      settings: LISTINGS_INDEX_SETTINGS,
      mappings: LISTINGS_INDEX_MAPPINGS,
    },
  });

  return indexName;
}

/**
 * Atomically swap the read alias to point to a new index.
 * Removes the alias from any previous index in a single request.
 */
export async function swapReadAlias(newIndexName: string): Promise<void> {
  const client = getOpenSearchClient();

  // Find which index currently holds the read alias
  const currentAliases = await getAliasTargets(LISTINGS_READ_ALIAS);

  const actions: Array<Record<string, { index: string; alias: string }>> = [];

  // Remove alias from all current targets
  for (const oldIndex of currentAliases) {
    actions.push({ remove: { index: oldIndex, alias: LISTINGS_READ_ALIAS } });
  }

  // Add alias to the new index
  actions.push({ add: { index: newIndexName, alias: LISTINGS_READ_ALIAS } });

  await client.indices.updateAliases({ body: { actions } });
}

/**
 * Swap the write alias to a target index (used during reindex backfill).
 */
export async function swapWriteAlias(newIndexName: string): Promise<void> {
  const client = getOpenSearchClient();

  const currentAliases = await getAliasTargets(LISTINGS_WRITE_ALIAS);

  const actions: Array<Record<string, { index: string; alias: string }>> = [];
  for (const oldIndex of currentAliases) {
    actions.push({ remove: { index: oldIndex, alias: LISTINGS_WRITE_ALIAS } });
  }
  actions.push({ add: { index: newIndexName, alias: LISTINGS_WRITE_ALIAS } });

  await client.indices.updateAliases({ body: { actions } });
}

/**
 * Roll back the read alias to a previous index.
 */
export async function rollbackAlias(previousIndexName: string): Promise<void> {
  await swapReadAlias(previousIndexName);
}

/**
 * Get the physical index name currently pointed to by the read alias.
 */
export async function getActiveIndex(): Promise<string | null> {
  const targets = await getAliasTargets(LISTINGS_READ_ALIAS);
  return targets[0] ?? null;
}

/**
 * List all physical indices matching the listings prefix.
 */
export async function listPhysicalIndices(): Promise<IndexInfo[]> {
  const client = getOpenSearchClient();

  const { body: catResult } = await client.cat.indices({
    index: `${LISTINGS_INDEX_PREFIX}*`,
    format: 'json',
    h: 'index,docs.count,store.size,creation.date.string',
  });

  const readTargets = await getAliasTargets(LISTINGS_READ_ALIAS);
  const writeTargets = await getAliasTargets(LISTINGS_WRITE_ALIAS);

  const indices = Array.isArray(catResult) ? catResult : [];

  return indices.map((entry: Record<string, string>) => ({
    name: entry.index ?? '',
    docCount: parseInt(entry['docs.count'] ?? '0', 10),
    sizeBytes: parseSizeString(entry['store.size'] ?? '0b'),
    createdAt: entry['creation.date.string'] ?? '',
    isReadActive: readTargets.includes(entry.index ?? ''),
    isWriteActive: writeTargets.includes(entry.index ?? ''),
  }));
}

/**
 * Delete old physical indices, keeping the most recent `keepCount`.
 * Never deletes indices that are currently aliased.
 */
export async function deleteOldIndices(keepCount: number): Promise<string[]> {
  const client = getOpenSearchClient();
  const all = await listPhysicalIndices();

  // Sort by name desc (newest first — timestamp in name ensures this)
  const sorted = [...all].sort((a, b) => b.name.localeCompare(a.name));

  const toDelete: string[] = [];
  let kept = 0;
  for (const idx of sorted) {
    if (idx.isReadActive || idx.isWriteActive) continue; // Never delete aliased
    if (kept < keepCount) {
      kept++;
      continue;
    }
    toDelete.push(idx.name);
  }

  for (const name of toDelete) {
    await client.indices.delete({ index: name });
  }

  return toDelete;
}

/**
 * Bootstrap: create the initial index and attach both aliases.
 * Safe to call on startup — no-ops if the read alias already exists.
 */
export async function ensureIndex(): Promise<void> {
  const active = await getActiveIndex();
  if (active) return; // Already bootstrapped

  const indexName = await createVersionedIndex(1);
  await swapReadAlias(indexName);
  await swapWriteAlias(indexName);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAliasTargets(alias: string): Promise<string[]> {
  const client = getOpenSearchClient();
  try {
    const { body } = await client.indices.getAlias({ name: alias });
    return Object.keys(body ?? {});
  } catch {
    // Alias doesn't exist yet
    return [];
  }
}

function parseSizeString(size: string): number {
  const match = size.match(/^([\d.]+)(\w+)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]!);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4,
  };
  return Math.round(val * (multipliers[unit] ?? 1));
}
