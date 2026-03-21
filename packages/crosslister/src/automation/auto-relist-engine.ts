/**
 * Auto-Relist Engine (F6.1)
 *
 * Finds stale active listings older than the seller's configured threshold
 * and creates RELIST crossJob entries for the automation worker.
 * Source: F6.1 install prompt §D.1; Lister Canonical Section 17.1.
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import {
  sellerProfile,
  automationSetting,
  channelProjection,
  crossJob,
} from '@twicely/db/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { canPerformAutomationAction } from '../services/automation-meter';
import { getConnector } from '../connector-registry';
import type { ExternalChannel } from '../types';
import { AUTOMATION_JOB_PRIORITY, AUTOMATION_ENGINE, AUTOMATION_MAX_ATTEMPTS } from './constants';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SellerWithSettings {
  userId: string;
  autoRelistDays: number;
  autoRelistChannels: string[];
}

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * Run the auto-relist engine for all eligible sellers.
 * Called by the automation scheduler at 03:00 UTC daily.
 */
export async function runAutoRelistEngine(): Promise<void> {
  logger.info('[autoRelistEngine] Starting run');

  // 1. Find all sellers with automation enabled + autoRelistEnabled
  const sellers = await db
    .select({
      userId: sellerProfile.userId,
      autoRelistDays: automationSetting.autoRelistDays,
      autoRelistChannels: automationSetting.autoRelistChannels,
    })
    .from(sellerProfile)
    .innerJoin(automationSetting, eq(automationSetting.sellerId, sellerProfile.userId))
    .where(
      and(
        eq(sellerProfile.hasAutomation, true),
        eq(automationSetting.autoRelistEnabled, true),
      ),
    );

  logger.info('[autoRelistEngine] Found eligible sellers', { count: sellers.length });

  for (const seller of sellers) {
    await processSellerRelist(seller);
  }

  logger.info('[autoRelistEngine] Run complete');
}

async function processSellerRelist(seller: SellerWithSettings): Promise<void> {
  const { userId, autoRelistDays, autoRelistChannels } = seller;

  // 2. Check meter before doing any work
  const meter = await canPerformAutomationAction(userId);
  if (!meter.allowed) {
    logger.warn('[autoRelistEngine] Seller at action limit — skipping', { userId });
    return;
  }

  const threshold = new Date(Date.now() - autoRelistDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  // 3. Find eligible projections
  const channelFilter = autoRelistChannels.length > 0
    ? autoRelistChannels as ExternalChannel[]
    : null;

  const conditions = [
    eq(channelProjection.sellerId, userId),
    eq(channelProjection.status, 'ACTIVE'),
    lt(channelProjection.createdAt, threshold),
  ];
  if (channelFilter) {
    conditions.push(inArray(channelProjection.channel, channelFilter));
  }

  const projections = await db
    .select({
      id: channelProjection.id,
      listingId: channelProjection.listingId,
      accountId: channelProjection.accountId,
      channel: channelProjection.channel,
    })
    .from(channelProjection)
    .where(and(...conditions))
    .limit(100);

  if (projections.length === 0) return;

  let actionsCreated = 0;

  for (const proj of projections) {
    // Re-check meter for each action
    const currentMeter = await canPerformAutomationAction(userId);
    if (!currentMeter.allowed) break;

    // Check platform automation feature flag
    const platformEnabled = await getPlatformSetting<boolean>(
      `automation.${proj.channel.toLowerCase()}.enabled`,
      true, // default enabled if not seeded
    );
    if (!platformEnabled) continue;

    // Check ConnectorCapabilities
    let canAutoRelist = true;
    try {
      const connector = getConnector(proj.channel as ExternalChannel);
      canAutoRelist = connector.capabilities.canAutoRelist;
    } catch {
      canAutoRelist = false;
    }
    if (!canAutoRelist) continue;

    const idempotencyKey = `auto-relist:${proj.id}:${monthKey}`;

    // Skip if job already exists for this projection this month
    const [existing] = await db
      .select({ id: crossJob.id })
      .from(crossJob)
      .where(eq(crossJob.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing) continue;

    // Create RELIST crossJob
    await db.insert(crossJob).values({
      sellerId: userId,
      projectionId: proj.id,
      accountId: proj.accountId,
      jobType: 'RELIST',
      priority: AUTOMATION_JOB_PRIORITY,
      idempotencyKey,
      status: 'PENDING',
      maxAttempts: AUTOMATION_MAX_ATTEMPTS,
      payload: {
        automationEngine: AUTOMATION_ENGINE.AUTO_RELIST,
        projectionId: proj.id,
        listingId: proj.listingId,
        channel: proj.channel,
      },
    });

    actionsCreated++;
  }

  if (actionsCreated > 0) {
    logger.info('[autoRelistEngine] Created RELIST jobs', { userId, actionsCreated });
  }
}
