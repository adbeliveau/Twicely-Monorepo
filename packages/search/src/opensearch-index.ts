/**
 * OpenSearch document indexing — upsert, delete, bulk, and partial update.
 * Mirrors the API of typesense-index.ts for engine-agnostic usage.
 */

import { getOpenSearchClient } from './opensearch-client';
import { LISTINGS_READ_ALIAS } from './opensearch-mapping';
import type { ListingDocument } from './typesense-index';

export type { ListingDocument };

/** Upsert a single listing document. */
export async function upsertDocument(doc: ListingDocument): Promise<void> {
  const client = getOpenSearchClient();
  await client.index({
    index: LISTINGS_READ_ALIAS,
    id: doc.id,
    body: doc,
    refresh: false,
  });
}

/** Delete a listing document by ID. */
export async function deleteDocument(listingId: string): Promise<void> {
  const client = getOpenSearchClient();
  try {
    await client.delete({
      index: LISTINGS_READ_ALIAS,
      id: listingId,
      refresh: false,
    });
  } catch (err: unknown) {
    // Document may not exist — safe to ignore 404
    if (isNotFoundError(err)) return;
    throw err;
  }
}

/** Bulk upsert an array of listing documents. */
export async function bulkUpsert(
  docs: ListingDocument[],
): Promise<{ success: number; failed: number }> {
  if (docs.length === 0) return { success: 0, failed: 0 };

  const client = getOpenSearchClient();
  const body: Array<Record<string, unknown>> = [];

  for (const doc of docs) {
    body.push({ index: { _index: LISTINGS_READ_ALIAS, _id: doc.id } });
    body.push(doc as unknown as Record<string, unknown>);
  }

  const { body: result } = await client.bulk({ body, refresh: false });

  let success = 0;
  let failed = 0;

  if (result.items) {
    for (const item of result.items) {
      const action = item.index ?? item.create ?? item.update;
      if (action && action.error) {
        failed++;
      } else {
        success++;
      }
    }
  }

  return { success, failed };
}

/** Partial update specific fields on a listing (e.g. sellerScore after recalc). */
export async function partialUpdate(
  listingId: string,
  fields: Partial<ListingDocument>,
): Promise<void> {
  const client = getOpenSearchClient();
  try {
    await client.update({
      index: LISTINGS_READ_ALIAS,
      id: listingId,
      body: { doc: fields },
      refresh: false,
    });
  } catch (err: unknown) {
    if (isNotFoundError(err)) return;
    throw err;
  }
}

/** Bulk partial update — for batch seller score patches. */
export async function bulkPartialUpdate(
  updates: Array<{ id: string; fields: Partial<ListingDocument> }>,
): Promise<{ success: number; failed: number }> {
  if (updates.length === 0) return { success: 0, failed: 0 };

  const client = getOpenSearchClient();
  const body: Array<Record<string, unknown>> = [];

  for (const { id, fields } of updates) {
    body.push({ update: { _index: LISTINGS_READ_ALIAS, _id: id } });
    body.push({ doc: fields });
  }

  const { body: result } = await client.bulk({ body, refresh: false });

  let success = 0;
  let failed = 0;

  if (result.items) {
    for (const item of result.items) {
      const action = item.update;
      if (action && action.error) {
        failed++;
      } else {
        success++;
      }
    }
  }

  return { success, failed };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isNotFoundError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode === 404;
  }
  if (err && typeof err === 'object' && 'meta' in err) {
    const meta = (err as { meta?: { statusCode?: number } }).meta;
    return meta?.statusCode === 404;
  }
  return false;
}
