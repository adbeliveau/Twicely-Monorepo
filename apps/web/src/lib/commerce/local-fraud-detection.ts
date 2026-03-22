/**
 * Local Fraud Detection Service (G2.15)
 *
 * Re-exports all detection signals. Implementations live in:
 *   - local-fraud-signal1.ts  (Signal 1: same listing sold)
 *   - local-fraud-signal3.ts  (Signal 3: no-show relist)
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A12
 */

export type { DetectSameListingSoldResult } from '@twicely/commerce/local-fraud-signal1';
export { detectSameListingSold, ACTIVE_LOCAL_STATUSES } from '@twicely/commerce/local-fraud-signal1';
export { checkNoshowRelist } from '@twicely/commerce/local-fraud-signal3';

// ─── Signal 2: pHash Duplicate (DEFERRED) ────────────────────────────────────

/**
 * pHash duplicate detection — DEFERRED.
 * Requires listing-to-listing pHash comparison pipeline not yet built.
 * G2.15: pHash duplicate detection deferred — requires listing pHash comparison pipeline.
 */
export function checkPhashDuplicate(): { duplicate: false } {
  return { duplicate: false };
}
