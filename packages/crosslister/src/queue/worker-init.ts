/**
 * Worker lifecycle initialization — starts the lister:publish BullMQ worker
 * on application startup. Imported by src/instrumentation.ts.
 *
 * Decision #62 (Railway): Workers run in-process alongside Next.js.
 * A dedicated worker process is a future optimization.
 * Source: F3.1 install prompt §3.11
 */

import { listerWorker } from './lister-worker';
import { automationWorker } from './automation-worker';
import { startSchedulerLoop, stopSchedulerLoop } from './scheduler-loop';
import { runPollSchedulerTick } from '../polling/poll-scheduler';
import { runAutomationTick } from '../automation/automation-scheduler';
import { loadCrosslisterQueueSettings } from '../services/queue-settings-loader';
import { logger } from '@twicely/logger';
import { registerShippingQuoteDeadlineJob } from '@twicely/jobs/shipping-quote-deadline';
import { registerExpireFreeListerJob } from '@twicely/jobs/expire-free-lister-tier';
import { registerCronJobs } from '@twicely/jobs/cron-jobs';
import { registerShutdown } from '@twicely/jobs/shutdown-registry';

let initialized = false;

// Fallback intervals if loadCrosslisterQueueSettings fails on startup.
// Normally read from platform_settings.
const FALLBACK_POLLING_TICK_MS = 60_000;
const FALLBACK_AUTOMATION_TICK_MS = 3_600_000; // 1 hour

export async function initListerWorker(): Promise<void> {
  if (initialized) return;
  initialized = true;

  listerWorker.on('completed', (job) => {
    logger.info('[listerWorker] Job completed', { jobId: job.id, crossJobId: job.data.crossJobId });
  });

  listerWorker.on('failed', (job, err) => {
    logger.error('[listerWorker] Job failed', { jobId: job?.id, error: String(err) });
  });

  automationWorker.on('completed', (job) => {
    logger.info('[automationWorker] Job completed', { jobId: job.id, crossJobId: job.data.crossJobId });
  });

  automationWorker.on('failed', (job, err) => {
    logger.error('[automationWorker] Job failed', { jobId: job?.id, error: String(err) });
  });

  // Register BullMQ repeatable jobs (shipping quote deadline, free lister expiry, platform cron)
  void registerShippingQuoteDeadlineJob();
  void registerExpireFreeListerJob();
  void registerCronJobs();

  // Load tick intervals from settings (cached). To change at runtime,
  // update the corresponding platform_setting and restart the worker.
  let pollingTickMs = FALLBACK_POLLING_TICK_MS;
  let automationTickMs = FALLBACK_AUTOMATION_TICK_MS;
  try {
    const settings = await loadCrosslisterQueueSettings();
    pollingTickMs = settings.pollingTickIntervalMs;
    automationTickMs = settings.automationTickIntervalMs;
  } catch (err) {
    logger.warn('[listerWorker] Failed to load tick intervals from settings, using fallbacks', {
      fallbackPolling: FALLBACK_POLLING_TICK_MS,
      fallbackAutomation: FALLBACK_AUTOMATION_TICK_MS,
      error: String(err),
    });
  }

  // Start the scheduler dispatch loop (gates: rate limit, fairness, circuit breaker)
  await startSchedulerLoop();

  // Start the poll scheduler tick (adaptive polling engine — §13)
  // Tick interval: crosslister.polling.tickIntervalMs (default 60000)
  const pollSchedulerInterval = setInterval(() => { void runPollSchedulerTick(); }, pollingTickMs);

  // Start the automation scheduler tick (hourly — runs appropriate engines by UTC hour)
  // Tick interval: crosslister.automation.tickIntervalMs (default 3600000)
  const automationInterval = setInterval(() => { void runAutomationTick(); }, automationTickMs);

  // Register non-worker cleanup with centralized shutdown registry.
  registerShutdown(() => {
    clearInterval(pollSchedulerInterval);
    clearInterval(automationInterval);
    stopSchedulerLoop();
  });

  logger.info('[listerWorker] Initialized', {
    pollingTickMs,
    automationTickMs,
    note: 'publish(10) + automation(5) + scheduler + poll + cron(4) + deadline + expiry',
  });
}
