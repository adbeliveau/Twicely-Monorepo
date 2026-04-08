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
import { runAutoRelistEngine } from '@twicely/crosslister/automation/auto-relist-engine';
import { runPriceDropEngine } from '@twicely/crosslister/automation/price-drop-engine';
import { runOfferToLikersEngine } from '@twicely/crosslister/automation/offer-to-likers-engine';
import { runPoshShareEngine } from '@twicely/crosslister/automation/posh-share-engine';
import { runPoshFollowEngine } from '@twicely/crosslister/automation/posh-follow-engine';
import { loadCrosslisterQueueSettings } from '@twicely/crosslister/services/queue-settings-loader';

/**
 * Run the automation tick for the current UTC hour.
 * Dispatches the appropriate engines based on the current time.
 * Called once per tick by the worker-init interval.
 *
 * Schedule (UTC, configurable via platform_settings):
 *   crosslister.automation.autoRelistHourUTC      (default 03:00)
 *   crosslister.automation.priceDropHourUTC       (default 04:00)
 *   crosslister.automation.offerToLikersHourUTC   (default 10:00)
 *   Posh share/follow run every tick — engines self-limit per seller per day
 */
export async function runAutomationTick(): Promise<void> {
  const now = new Date();
  const hour = now.getUTCHours();

  // Load fire-hour settings (cached 5 min in queue-settings-loader)
  const settings = await loadCrosslisterQueueSettings();

  logger.info('[automationScheduler] Tick', {
    hour,
    autoRelistHour: settings.automationAutoRelistHourUTC,
    priceDropHour: settings.automationPriceDropHourUTC,
    offerToLikersHour: settings.automationOfferToLikersHourUTC,
  });

  // Run time-specific engines
  if (hour === settings.automationAutoRelistHourUTC) {
    await runAutoRelistEngine().catch((err) => {
      logger.error('[automationScheduler] autoRelistEngine failed', { error: String(err) });
    });
  }

  if (hour === settings.automationPriceDropHourUTC) {
    await runPriceDropEngine().catch((err) => {
      logger.error('[automationScheduler] priceDropEngine failed', { error: String(err) });
    });
  }

  if (hour === settings.automationOfferToLikersHourUTC) {
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
