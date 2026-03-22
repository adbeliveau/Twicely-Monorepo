/**
 * Worker lifecycle initialization — starts the lister:publish BullMQ worker
 * on application startup. Imported by src/instrumentation.ts.
 *
 * Decision #62 (Railway): Workers run in-process alongside Next.js.
 * A dedicated worker process is a future optimization.
 * Source: F3.1 install prompt §3.11
 */

import { listerWorker } from '@twicely/crosslister/queue/lister-worker';
import { automationWorker } from '@twicely/crosslister/queue/automation-worker';
import { startSchedulerLoop, stopSchedulerLoop } from '@twicely/crosslister/queue/scheduler-loop';
import { runPollSchedulerTick } from '../polling/poll-scheduler';
import { runAutomationTick } from '../automation/automation-scheduler';
import { logger } from '@twicely/logger';
import { AUTOMATION_TICK_INTERVAL_MS } from '../automation/constants';
import { registerShippingQuoteDeadlineJob, shippingQuoteDeadlineWorker } from '@twicely/jobs/shipping-quote-deadline';
import { registerExpireFreeListerJob, expireFreeListerWorker } from '@twicely/jobs/expire-free-lister-tier';
import { registerCronJobs, cronWorker } from '@twicely/jobs/cron-jobs';

let initialized = false;

export function initListerWorker(): void {
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

  // Start the scheduler dispatch loop (gates: rate limit, fairness, circuit breaker)
  startSchedulerLoop();

  // Start the poll scheduler tick (adaptive polling engine — §13)
  const pollSchedulerInterval = setInterval(() => { void runPollSchedulerTick(); }, 60_000);

  // Start the automation scheduler tick (hourly — runs appropriate engines by UTC hour)
  const automationInterval = setInterval(() => { void runAutomationTick(); }, AUTOMATION_TICK_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = () => {
    clearInterval(pollSchedulerInterval);
    clearInterval(automationInterval);
    stopSchedulerLoop();
    void listerWorker.close();
    void automationWorker.close();
    void shippingQuoteDeadlineWorker.close();
    void expireFreeListerWorker.close();
    void cronWorker.close();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('[listerWorker] Initialized: publish(10) + automation(5) + scheduler + poll + cron(4) + deadline + expiry');
}
