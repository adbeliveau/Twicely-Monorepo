/**
 * Automation action metering service.
 * Counts monthly automation actions and enforces the plan limit.
 * Source: F6.1 install prompt §C.1; Pricing Canonical Section 8.
 *
 * Metering approach: each automation action creates a crossJob with
 * payload.automationEngine set to the action type. Meter counts these rows
 * for the current calendar month.
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { crossJob } from '@twicely/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';
import { AUTOMATION_ACTIONS_DEFAULT } from '../automation/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MeterCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the start of the current calendar month in UTC.
 */
function getCurrentMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Count automation actions used by a seller since monthStart.
 * Counts crossJob rows WHERE payload contains automationEngine marker.
 */
export async function getAutomationActionCount(
  sellerId: string,
  monthStart: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
    })
    .from(crossJob)
    .where(
      and(
        eq(crossJob.sellerId, sellerId),
        gte(crossJob.createdAt, monthStart),
        sql`${crossJob.payload}->>'automationEngine' IS NOT NULL`,
      ),
    );

  return row?.total ?? 0;
}

/**
 * Check whether a seller can perform an automation action this month.
 * Reads the limit from platform_settings — never hardcoded.
 */
export async function canPerformAutomationAction(
  sellerId: string,
): Promise<MeterCheckResult> {
  const monthStart = getCurrentMonthStart();

  const [used, limit] = await Promise.all([
    getAutomationActionCount(sellerId, monthStart),
    getPlatformSetting<number>('automation.actionsPerMonth', AUTOMATION_ACTIONS_DEFAULT),
  ]);

  const remaining = Math.max(0, limit - used);
  const allowed = used < limit;

  if (!allowed) {
    logger.warn('[automationMeter] Monthly action limit reached', {
      sellerId,
      used,
      limit,
    });
  }

  return { allowed, used, limit, remaining };
}

/**
 * Record an automation action by creating a crossJob entry.
 * The crossJob serves as both the work item and the metering record.
 * This function is called by the engines BEFORE dispatching to the worker
 * to ensure the action is counted even if execution fails.
 *
 * Note: the actual crossJob is created by each engine. This function is
 * a lightweight wrapper to log the meter increment for observability.
 */
export async function recordAutomationAction(
  sellerId: string,
  actionType: 'AUTO_RELIST' | 'PRICE_DROP' | 'OFFER_TO_LIKERS' | 'POSH_SHARE',
  listingId: string,
  channel: string,
): Promise<void> {
  logger.info('[automationMeter] Action recorded', {
    sellerId,
    actionType,
    listingId,
    channel,
  });
}
