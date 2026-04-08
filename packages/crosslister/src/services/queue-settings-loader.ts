/**
 * Cached loader for crosslister queue + scheduler + polling settings.
 *
 * The scheduler dispatch loop ticks every ~5 seconds and the poll scheduler
 * ticks per its own interval. Both need ~17 setting values per tick. Reading
 * each from the DB on every tick is expensive, so we cache the full set for
 * 5 minutes.
 *
 * All values come from `platform_settings` under the `crosslister.*` namespace.
 * Hardcoded constants in this file are FALLBACKS only — they fire only if the
 * DB row is missing, which should never happen after the v32 seed runs.
 *
 * Spec: Lister Canonical §8.4 (scheduler), §13.2/§13.4 (polling)
 * Audit reference: 2026-04-07 — moved all hardcoded scheduler/queue constants
 *                  to platform_settings per owner directive.
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

export interface CrosslisterQueueSettings {
  // Scheduler dispatch loop
  schedulerTickIntervalMs: number;
  schedulerBatchPullSize: number;

  // Poll scheduler
  pollingBatchSize: number;
  webhookPrimaryChannels: string[];
  pollingTickIntervalMs: number;

  // BullMQ priorities (lower = higher priority)
  priorityPoll: number;
  priorityCreate: number;
  prioritySync: number;
  priorityDelist: number;

  // BullMQ retry attempts
  maxAttemptsPoll: number;
  maxAttemptsPublish: number;
  maxAttemptsSync: number;

  // BullMQ exponential backoff (initial delay in ms)
  backoffPollMs: number;
  backoffPublishMs: number;
  backoffSyncMs: number;

  // BullMQ retention
  removeOnCompleteCount: number;
  removeOnFailCount: number;

  // Worker concurrency
  workerConcurrency: number;

  // Automation engine internals (auto-relist, price drop, offer-to-likers, posh)
  automationJobPriority: number;
  automationWorkerConcurrency: number;
  automationTickIntervalMs: number;
  automationAutoRelistHourUTC: number;
  automationPriceDropHourUTC: number;
  automationOfferToLikersHourUTC: number;
  automationOfferCooldownDays: number;
  automationMaxAttempts: number;
  automationBackoffMsFirst: number;
  automationBackoffMsSecond: number;
}

let cache: CrosslisterQueueSettings | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load all crosslister queue/scheduler/polling settings.
 * Cached for 5 minutes per process. Returns the cached value if still fresh.
 */
export async function loadCrosslisterQueueSettings(): Promise<CrosslisterQueueSettings> {
  const now = Date.now();
  if (cache && now < cacheExpiresAt) {
    return cache;
  }

  // Parse webhook primary channels (stored as JSON string in platform_settings)
  let webhookPrimaryChannels: string[] = ['EBAY', 'ETSY'];
  try {
    const raw = await getPlatformSetting<string>(
      'crosslister.polling.webhookPrimaryChannels',
      '["EBAY","ETSY"]',
    );
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      webhookPrimaryChannels = parsed;
    }
  } catch {
    // Fallback already set above
  }

  const [
    schedulerTickIntervalMs,
    schedulerBatchPullSize,
    pollingBatchSize,
    pollingTickIntervalMs,
    priorityPoll,
    priorityCreate,
    prioritySync,
    priorityDelist,
    maxAttemptsPoll,
    maxAttemptsPublish,
    maxAttemptsSync,
    backoffPollMs,
    backoffPublishMs,
    backoffSyncMs,
    removeOnCompleteCount,
    removeOnFailCount,
    workerConcurrency,
    automationJobPriority,
    automationWorkerConcurrency,
    automationTickIntervalMs,
    automationAutoRelistHourUTC,
    automationPriceDropHourUTC,
    automationOfferToLikersHourUTC,
    automationOfferCooldownDays,
    automationMaxAttempts,
    automationBackoffMsFirst,
    automationBackoffMsSecond,
  ] = await Promise.all([
    getPlatformSetting<number>('crosslister.scheduler.tickIntervalMs', 5_000),
    getPlatformSetting<number>('crosslister.scheduler.batchPullSize', 50),
    getPlatformSetting<number>('crosslister.polling.batchSize', 100),
    getPlatformSetting<number>('crosslister.polling.tickIntervalMs', 60_000),
    getPlatformSetting<number>('crosslister.queue.priority.poll', 700),
    getPlatformSetting<number>('crosslister.queue.priority.create', 300),
    getPlatformSetting<number>('crosslister.queue.priority.sync', 500),
    getPlatformSetting<number>('crosslister.queue.priority.delist', 100),
    getPlatformSetting<number>('crosslister.queue.maxAttempts.poll', 2),
    getPlatformSetting<number>('crosslister.queue.maxAttempts.publish', 3),
    getPlatformSetting<number>('crosslister.queue.maxAttempts.sync', 3),
    getPlatformSetting<number>('crosslister.queue.backoffMs.poll', 60_000),
    getPlatformSetting<number>('crosslister.queue.backoffMs.publish', 30_000),
    getPlatformSetting<number>('crosslister.queue.backoffMs.sync', 60_000),
    getPlatformSetting<number>('crosslister.queue.removeOnCompleteCount', 1_000),
    getPlatformSetting<number>('crosslister.queue.removeOnFailCount', 5_000),
    getPlatformSetting<number>('crosslister.queue.workerConcurrency', 10),
    getPlatformSetting<number>('crosslister.automation.jobPriority', 700),
    getPlatformSetting<number>('crosslister.automation.workerConcurrency', 5),
    getPlatformSetting<number>('crosslister.automation.tickIntervalMs', 3_600_000),
    getPlatformSetting<number>('crosslister.automation.autoRelistHourUTC', 3),
    getPlatformSetting<number>('crosslister.automation.priceDropHourUTC', 4),
    getPlatformSetting<number>('crosslister.automation.offerToLikersHourUTC', 10),
    getPlatformSetting<number>('crosslister.automation.offerCooldownDays', 7),
    getPlatformSetting<number>('crosslister.automation.maxAttempts', 2),
    getPlatformSetting<number>('crosslister.automation.backoffMs.first', 60_000),
    getPlatformSetting<number>('crosslister.automation.backoffMs.second', 300_000),
  ]);

  cache = {
    schedulerTickIntervalMs,
    schedulerBatchPullSize,
    pollingBatchSize,
    webhookPrimaryChannels,
    pollingTickIntervalMs,
    priorityPoll,
    priorityCreate,
    prioritySync,
    priorityDelist,
    maxAttemptsPoll,
    maxAttemptsPublish,
    maxAttemptsSync,
    backoffPollMs,
    backoffPublishMs,
    backoffSyncMs,
    removeOnCompleteCount,
    removeOnFailCount,
    workerConcurrency,
    automationJobPriority,
    automationWorkerConcurrency,
    automationTickIntervalMs,
    automationAutoRelistHourUTC,
    automationPriceDropHourUTC,
    automationOfferToLikersHourUTC,
    automationOfferCooldownDays,
    automationMaxAttempts,
    automationBackoffMsFirst,
    automationBackoffMsSecond,
  };
  cacheExpiresAt = now + CACHE_TTL_MS;

  return cache;
}

/** Reset the in-process cache (test helper / hot-reload helper). */
export function resetCrosslisterQueueSettingsCache(): void {
  cache = null;
  cacheExpiresAt = 0;
}
