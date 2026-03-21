/**
 * Automation add-on constants.
 * All numeric limits are defaults used as fallbacks when platform_settings
 * is unreachable. Authoritative values are always read from platform_settings.
 * Source: Lister Canonical Section 17; Pricing Canonical Section 8.
 */

/** BullMQ job priority for automation jobs (from Lister Canonical Section 8.1). */
export const AUTOMATION_JOB_PRIORITY = 700;

/** BullMQ worker concurrency for the lister:automation queue. */
export const AUTOMATION_WORKER_CONCURRENCY = 5;

/** Fallback monthly action limit if platform_settings is unreachable. */
export const AUTOMATION_ACTIONS_DEFAULT = 2000;

/** Automation scheduler interval in ms (1 hour). */
export const AUTOMATION_TICK_INTERVAL_MS = 3_600_000;

/** UTC hour at which the auto-relist engine fires (03:00 UTC). */
export const AUTO_RELIST_HOUR_UTC = 3;

/** UTC hour at which the price-drop engine fires (04:00 UTC). */
export const PRICE_DROP_HOUR_UTC = 4;

/** UTC hour at which the offer-to-likers engine fires (10:00 UTC). */
export const OFFER_TO_LIKERS_HOUR_UTC = 10;

/** Cooldown period in days between offer-to-likers sends for the same projection. */
export const OFFER_COOLDOWN_DAYS = 7;

/** Automation action type identifiers stored in crossJob payload. */
export const AUTOMATION_ENGINE = {
  AUTO_RELIST: 'AUTO_RELIST',
  PRICE_DROP: 'PRICE_DROP',
  OFFER_TO_LIKERS: 'OFFER_TO_LIKERS',
  POSH_SHARE: 'POSH_SHARE',
  POSH_FOLLOW: 'POSH_FOLLOW',
} as const;

export type AutomationEngine = typeof AUTOMATION_ENGINE[keyof typeof AUTOMATION_ENGINE];

/** Platform setting key for Poshmark daily action limit. */
export const POSH_DAILY_LIMIT_SETTING = 'automation.poshmark.dailyActionLimit';

/** Platform setting key for Poshmark min delay between actions (ms). */
export const POSH_MIN_DELAY_SETTING = 'automation.poshmark.minDelayMs';

/** Platform setting key for Poshmark max delay between actions (ms). */
export const POSH_MAX_DELAY_SETTING = 'automation.poshmark.maxDelayMs';

/** Fallback Poshmark daily action limit per seller. */
export const POSH_DAILY_LIMIT_DEFAULT = 200;

/** Platform setting key for Poshmark daily follow limit. */
export const POSH_DAILY_FOLLOW_LIMIT_SETTING = 'automation.poshmark.dailyFollowLimit';

/** Fallback Poshmark daily follow limit per seller. */
export const POSH_DAILY_FOLLOW_LIMIT_DEFAULT = 50;

/** Max retry attempts for AUTOMATION jobs (Lister Canonical Section 24.2). */
export const AUTOMATION_MAX_ATTEMPTS = 2;

/** Backoff delays in ms for AUTOMATION jobs: 60s first retry, 300s second. */
export const AUTOMATION_BACKOFF_DELAYS = [60_000, 300_000] as const;
