/**
 * Automation Scheduler (F6.1)
 *
 * Dispatches the four automation engines on a time-based schedule.
 * Called hourly by the worker-init interval. Each engine self-limits.
 * Source: F6.1 install prompt §E.1.
 *
 * Schedule (UTC):
 *   03:00 — Auto-Relist
 *   04:00 — Smart Price Drops
 *   10:00 — Offer-to-Likers
 *   All hours — Posh Sharing (self-limits per seller per day)
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { logger } from '@twicely/logger';
import { runAutoRelistEngine } from './auto-relist-engine';
import { runPriceDropEngine } from './price-drop-engine';
import { runOfferToLikersEngine } from './offer-to-likers-engine';
import { runPoshShareEngine } from './posh-share-engine';
import { runPoshFollowEngine } from './posh-follow-engine';
import {
  AUTO_RELIST_HOUR_UTC,
  PRICE_DROP_HOUR_UTC,
  OFFER_TO_LIKERS_HOUR_UTC,
} from './constants';

/**
 * Run the automation tick for the current UTC hour.
 * Dispatches the appropriate engines based on the current time.
 * Called once per hour by the worker-init interval.
 */
export async function runAutomationTick(): Promise<void> {
  const now = new Date();
  const hour = now.getUTCHours();

  logger.info('[automationScheduler] Tick', { hour });

  // Run time-specific engines
  if (hour === AUTO_RELIST_HOUR_UTC) {
    await runAutoRelistEngine().catch((err) => {
      logger.error('[automationScheduler] autoRelistEngine failed', { error: String(err) });
    });
  }

  if (hour === PRICE_DROP_HOUR_UTC) {
    await runPriceDropEngine().catch((err) => {
      logger.error('[automationScheduler] priceDropEngine failed', { error: String(err) });
    });
  }

  if (hour === OFFER_TO_LIKERS_HOUR_UTC) {
    await runOfferToLikersEngine().catch((err) => {
      logger.error('[automationScheduler] offerToLikersEngine failed', { error: String(err) });
    });
  }

  // Posh sharing runs every tick — engine self-limits per seller per day
  await runPoshShareEngine().catch((err) => {
    logger.error('[automationScheduler] poshShareEngine failed', { error: String(err) });
  });

  // Posh follow runs every tick — engine self-limits per seller per day
  await runPoshFollowEngine().catch((err) => {
    logger.error('[automationScheduler] poshFollowEngine failed', { error: String(err) });
  });
}
