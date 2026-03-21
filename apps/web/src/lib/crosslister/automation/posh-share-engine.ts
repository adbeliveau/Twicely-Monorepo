/**
 * Posh Sharing Engine (F6.1)
 *
 * Creates SYNC crossJob entries for Poshmark closet sharing.
 * Risk-controlled: circuit breaker integration + daily action limits.
 * Source: F6.1 install prompt §D.4; Lister Canonical Section 16 (Mode 3), 17.1.
 *
 * V1: Jobs are created and fail gracefully with logging ("not yet implemented").
 * Actual Poshmark session automation is implemented as the connector matures.
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import {
  sellerProfile,
  automationSetting,
  channelProjection,
  crosslisterAccount,
  crossJob,
} from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { canPerformAutomationAction } from '../services/automation-meter';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { canPerformAutomation } from './automation-circuit-breaker';
import {
  AUTOMATION_JOB_PRIORITY,
  AUTOMATION_ENGINE,
  POSH_DAILY_LIMIT_SETTING,
  POSH_DAILY_LIMIT_DEFAULT,
  AUTOMATION_MAX_ATTEMPTS,
} from './constants';

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * Run the Posh sharing engine for all eligible sellers.
 * Runs on every automation tick (hourly).
 * Each engine run self-limits by seller daily cap.
 */
export async function runPoshShareEngine(): Promise<void> {
  logger.info('[poshShareEngine] Starting run');

  const sellers = await db
    .select({
      userId: sellerProfile.userId,
      poshShareTimesPerDay: automationSetting.poshShareTimesPerDay,
    })
    .from(sellerProfile)
    .innerJoin(automationSetting, eq(automationSetting.sellerId, sellerProfile.userId))
    .where(
      and(
        eq(sellerProfile.hasAutomation, true),
        eq(automationSetting.poshShareEnabled, true),
      ),
    );

  logger.info('[poshShareEngine] Found eligible sellers', { count: sellers.length });

  const dailyLimit = await getPlatformSetting<number>(POSH_DAILY_LIMIT_SETTING, POSH_DAILY_LIMIT_DEFAULT);

  for (const seller of sellers) {
    await processSellerSharing(seller.userId, seller.poshShareTimesPerDay, dailyLimit);
  }

  logger.info('[poshShareEngine] Run complete');
}

async function processSellerSharing(
  userId: string,
  timesPerDay: number,
  dailyLimit: number,
): Promise<void> {
  // 0. Check platform feature flag
  const platformEnabled = await getPlatformSetting<boolean>(
    'automation.poshmark.enabled',
    true,
  );
  if (!platformEnabled) {
    logger.info('[poshShareEngine] Poshmark automation disabled — skipping', { userId });
    return;
  }

  // 1. Verify seller has an ACTIVE Poshmark account
  const [poshAccount] = await db
    .select({ id: crosslisterAccount.id })
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.sellerId, userId),
        eq(crosslisterAccount.channel, 'POSHMARK'),
        eq(crosslisterAccount.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  if (!poshAccount) {
    logger.warn('[poshShareEngine] No active Poshmark account — skipping', { userId });
    return;
  }

  // 1b. Circuit breaker check
  const circuitOk = await canPerformAutomation(userId);
  if (!circuitOk) {
    logger.warn('[poshShareEngine] Seller paused by circuit breaker', { userId });
    return;
  }

  // 2. Check automation meter
  const meter = await canPerformAutomationAction(userId);
  if (!meter.allowed) {
    logger.warn('[poshShareEngine] Seller at action limit — skipping', { userId });
    return;
  }

  // 3. Count jobs already created today (rate control per daily limit)
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [todayCount] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(crossJob)
    .where(
      and(
        eq(crossJob.sellerId, userId),
        sql`${crossJob.payload}->>'automationEngine' = ${AUTOMATION_ENGINE.POSH_SHARE}`,
        sql`${crossJob.createdAt} >= ${dayStart}`,
      ),
    );

  const sharesCreatedToday = todayCount?.total ?? 0;
  const remainingDailySlots = Math.min(dailyLimit, timesPerDay) - sharesCreatedToday;

  if (remainingDailySlots <= 0) return;

  // 4. Find all ACTIVE Poshmark projections for this seller
  const projections = await db
    .select({
      id: channelProjection.id,
      listingId: channelProjection.listingId,
    })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.sellerId, userId),
        eq(channelProjection.channel, 'POSHMARK'),
        eq(channelProjection.status, 'ACTIVE'),
      ),
    )
    .limit(remainingDailySlots);

  if (projections.length === 0) return;

  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  let actionsCreated = 0;

  for (const proj of projections) {
    const currentMeter = await canPerformAutomationAction(userId);
    if (!currentMeter.allowed) break;

    const tsKey = Date.now() + actionsCreated;
    const idempotencyKey = `posh-share:${proj.id}:${monthKey}:${tsKey}`;

    await db.insert(crossJob).values({
      sellerId: userId,
      projectionId: proj.id,
      accountId: poshAccount.id,
      jobType: 'SYNC',
      priority: AUTOMATION_JOB_PRIORITY,
      idempotencyKey,
      status: 'PENDING',
      maxAttempts: AUTOMATION_MAX_ATTEMPTS,
      payload: {
        automationEngine: AUTOMATION_ENGINE.POSH_SHARE,
        projectionId: proj.id,
        listingId: proj.listingId,
        channel: 'POSHMARK',
      },
    });

    actionsCreated++;
  }

  if (actionsCreated > 0) {
    logger.info('[poshShareEngine] Created share jobs', { userId, actionsCreated });
  }
}
