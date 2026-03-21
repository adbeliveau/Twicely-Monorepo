/**
 * IndexedDB token storage for preloaded local transaction tokens (G2.7).
 *
 * Stores Ed25519 signed tokens in IndexedDB (not localStorage) so both phones
 * are offline-ready before leaving for the meetup.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A4
 */

import { get, set, del } from 'idb-keyval';
import type { PreloadedTokenData } from '@/lib/types/local-token';

export type { PreloadedTokenData };

// ─── Key Helpers ─────────────────────────────────────────────────────────────

function storageKey(transactionId: string): string {
  return `local-tx-tokens-${transactionId}`;
}

// ─── Storage Operations ───────────────────────────────────────────────────────

/**
 * Store preloaded token data to IndexedDB.
 */
export async function storeTokens(
  transactionId: string,
  data: PreloadedTokenData,
): Promise<void> {
  await set(storageKey(transactionId), data);
}

/**
 * Retrieve preloaded token data from IndexedDB.
 * Returns undefined if not found.
 */
export async function getStoredTokens(
  transactionId: string,
): Promise<PreloadedTokenData | undefined> {
  return get<PreloadedTokenData>(storageKey(transactionId));
}

/**
 * Remove stored tokens after successful confirmation.
 */
export async function clearStoredTokens(transactionId: string): Promise<void> {
  await del(storageKey(transactionId));
}
