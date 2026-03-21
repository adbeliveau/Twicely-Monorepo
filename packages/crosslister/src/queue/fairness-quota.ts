/**
 * Per-seller fairness quota for the crosslister scheduler.
 * Enforces that no single seller can monopolize BullMQ throughput.
 * Spec: Lister Canonical §8.1
 *
 * Quota resets every QUOTA_WINDOW_MS (1 minute).
 * Base quota is read from platform_settings at runtime (5-minute cache).
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

const QUOTA_WINDOW_MS = 60_000;

interface SellerQuota {
  jobsDispatchedThisWindow: number;
  windowStartsAt: number;
}

const quotaMap = new Map<string, SellerQuota>();

let cachedMaxJobs: number | null = null;
let cacheExpiresAt = 0;

/**
 * Read max jobs per seller per minute from platform settings.
 * Key: crosslister.fairness.maxJobsPerSellerPerMinute
 * Default: 10. Cached for 5 minutes.
 */
export async function getMaxJobsPerSellerPerMinute(): Promise<number> {
  const now = Date.now();
  if (cachedMaxJobs !== null && now < cacheExpiresAt) return cachedMaxJobs;

  const raw = await getPlatformSetting<number>(
    'crosslister.fairness.maxJobsPerSellerPerMinute',
    10,
  );
  const parsed = typeof raw === 'number' && raw > 0 ? Math.floor(raw) : 10;
  cachedMaxJobs = parsed;
  cacheExpiresAt = now + 5 * 60_000;
  return parsed;
}

/**
 * Check if a seller has remaining quota in the current window.
 * Returns true if the seller can dispatch another job.
 */
export function hasQuota(sellerId: string, maxPerWindow: number): boolean {
  const now = Date.now();
  const quota = quotaMap.get(sellerId);

  if (!quota || now >= quota.windowStartsAt + QUOTA_WINDOW_MS) {
    quotaMap.set(sellerId, { jobsDispatchedThisWindow: 0, windowStartsAt: now });
    return true;
  }

  return quota.jobsDispatchedThisWindow < maxPerWindow;
}

/**
 * Record that a job was dispatched for a seller.
 * Call AFTER a job passes all gates and is actually dispatched.
 */
export function recordDispatch(sellerId: string): void {
  const now = Date.now();
  const quota = quotaMap.get(sellerId);
  if (!quota || now >= quota.windowStartsAt + QUOTA_WINDOW_MS) {
    quotaMap.set(sellerId, { jobsDispatchedThisWindow: 1, windowStartsAt: now });
  } else {
    quota.jobsDispatchedThisWindow += 1;
  }
}

/** Reset quota for a specific seller (tests and admin override). */
export function resetQuota(sellerId: string): void {
  quotaMap.delete(sellerId);
}

/** Reset all quota state (tests only). */
export function resetAllQuotas(): void {
  quotaMap.clear();
  cachedMaxJobs = null;
  cacheExpiresAt = 0;
}
