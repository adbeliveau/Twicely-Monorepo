/**
 * Posh Follow/Unfollow Engine (F6-FIX)
 *
 * Grows seller follower base on Poshmark by following relevant users.
 * Part of Mode 3 Poshmark automation (Section 16.3).
 * Enabled when poshShareEnabled is true (same Mode 3 toggle).
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import {
  sellerProfile,
  automationSetting,
  crosslisterAccount,
  crossJob,
} from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { canPerformAutomationAction } from '../services/automation-meter';
import { canPerformAutomation } from './automation-circuit-breaker';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import {
  AUTOMATION_JOB_PRIORITY,
  AUTOMATION_ENGINE,
  AUTOMATION_MAX_ATTEMPTS,
  POSH_DAILY_FOLLOW_LIMIT_SETTING,
  POSH_DAILY_FOLLOW_LIMIT_DEFAULT,
} from './constants';

export async function runPoshFollowEngine(): Promise<void> {
  logger.info('[poshFollowEngine] Starting run');

  // Check platform feature flag
  const platformEnabled = await getPlatformSetting<boolean>(
    'automation.poshmark.enabled',
    true,
  );
  if (!platformEnabled) {
    logger.info('[poshFollowEngine] Poshmark automation disabled — skipping');
    return;
  }

  const sellers = await db
    .select({
      userId: sellerProfile.userId,
    })
    .from(sellerProfile)
    .innerJoin(automationSetting, eq(automationSetting.sellerId, sellerProfile.userId))
    .where(
      and(
        eq(sellerProfile.hasAutomation, true),
        eq(automationSetting.poshShareEnabled, true), // follow/unfollow uses same Mode 3 toggle
      ),
    );

  logger.info('[poshFollowEngine] Found eligible sellers', { count: sellers.length });

  const dailyLimit = await getPlatformSetting<number>(
    POSH_DAILY_FOLLOW_LIMIT_SETTING,
    POSH_DAILY_FOLLOW_LIMIT_DEFAULT,
  );

  for (const seller of sellers) {
    await processSellerFollows(seller.userId, dailyLimit);
  }

  logger.info('[poshFollowEngine] Run complete');
}

async function processSellerFollows(
  userId: string,
  dailyLimit: number,
): Promise<void> {
  // 1. Verify ACTIVE Poshmark account
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

  if (!poshAccount) return;

  // 2. Circuit breaker check
  const circuitOk = await canPerformAutomation(userId);
  if (!circuitOk) {
    logger.warn('[poshFollowEngine] Seller paused by circuit breaker', { userId });
    return;
  }

  // 3. Automation meter check
  const meter = await canPerformAutomationAction(userId);
  if (!meter.allowed) {
    logger.warn('[poshFollowEngine] Seller at action limit — skipping', { userId });
    return;
  }

  // 4. Count follow jobs already created today
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [todayCount] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(crossJob)
    .where(
      and(
        eq(crossJob.sellerId, userId),
        sql`${crossJob.payload}->>'automationEngine' = ${AUTOMATION_ENGINE.POSH_FOLLOW}`,
        sql`${crossJob.createdAt} >= ${dayStart}`,
      ),
    );

  const followsToday = todayCount?.total ?? 0;
  const remainingSlots = dailyLimit - followsToday;
  if (remainingSlots <= 0) return;

  // 5. Create follow jobs (up to remaining daily limit)
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  let actionsCreated = 0;

  for (let i = 0; i < remainingSlots; i++) {
    const currentMeter = await canPerformAutomationAction(userId);
    if (!currentMeter.allowed) break;

    const tsKey = Date.now() + actionsCreated;
    const idempotencyKey = `posh-follow:${poshAccount.id}:${monthKey}:${tsKey}`;

    await db.insert(crossJob).values({
      sellerId: userId,
      accountId: poshAccount.id,
      jobType: 'SYNC',
      priority: AUTOMATION_JOB_PRIORITY,
      idempotencyKey,
      status: 'PENDING',
      maxAttempts: AUTOMATION_MAX_ATTEMPTS,
      payload: {
        automationEngine: AUTOMATION_ENGINE.POSH_FOLLOW,
        channel: 'POSHMARK',
        accountId: poshAccount.id,
      },
    });

    actionsCreated++;
  }

  if (actionsCreated > 0) {
    logger.info('[poshFollowEngine] Created follow jobs', { userId, actionsCreated });
  }
}
