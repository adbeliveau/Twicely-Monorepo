/**
 * Priority constants, backoff configs, and queue names for the crosslister queue.
 * Source: F3.1 install prompt §3.2, §5 (Functional — Priority)
 *
 * Priority: lower number = higher priority (BullMQ convention).
 */

/** Queue name for outbound publish jobs. */
export const LISTER_PUBLISH_QUEUE = 'lister-publish';

/** Queue name for automation jobs (auto-relist, price drop, offer-to-likers, Posh sharing). */
export const LISTER_AUTOMATION_QUEUE = 'lister-automation';

/** Queue name for the polling pipeline (Lister Canonical §13.4 — Adaptive Polling Engine). */
export const LISTER_POLLING_QUEUE = 'lister-polling';

/** Priority for CREATE/PUBLISH jobs (crosslist a new listing). */
export const PRIORITY_CREATE = 300;

/** Priority for SYNC/UPDATE jobs (sync overrides to live listing). */
export const PRIORITY_SYNC = 500;

/** Priority for DELIST jobs (highest priority — seller intent to remove). */
export const PRIORITY_DELIST = 100;

/** Maximum retry attempts for PUBLISH/CREATE and DELIST jobs. */
export const MAX_ATTEMPTS_PUBLISH = 3;

/** Maximum retry attempts for SYNC/UPDATE jobs. */
export const MAX_ATTEMPTS_SYNC = 3;

/** Backoff config for PUBLISH/CREATE jobs: 30s, 120s, 300s (exponential). */
export const BACKOFF_PUBLISH = {
  type: 'exponential' as const,
  delay: 30_000,
};

/** Backoff config for SYNC/UPDATE jobs: 60s, 300s, 900s (exponential). */
export const BACKOFF_SYNC = {
  type: 'exponential' as const,
  delay: 60_000,
};

/** Keep last 1000 completed jobs for debugging. */
export const REMOVE_ON_COMPLETE = { count: 1000 };

/** Keep last 5000 failed jobs for admin inspection. */
export const REMOVE_ON_FAIL = { count: 5000 };

/** Worker concurrency for the lister:publish queue. */
export const WORKER_CONCURRENCY = 10;

/** Sliding window duration for rate limiting (1 hour in ms). */
export const RATE_LIMIT_WINDOW_MS = 3_600_000;
