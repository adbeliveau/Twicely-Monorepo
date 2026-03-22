/**
 * Smart Price Drop Engine (F6.1)
 *
 * Finds active listings eligible for a scheduled price reduction
 * and creates UPDATE crossJob entries for the automation worker.
 * Source: F6.1 install prompt §D.2; Lister Canonical Section 17.1.
 *
 * Floor enforcement: tracks baseline price in the crossJob payload chain.
 * On each drop: payload.originalPriceCents records the price at first drop.
 * Subsequent drops are capped by: originalPriceCents * floorPercent / 100.
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import {
  sellerProfile,
  automationSetting,
  channelProjection,
  crossJob,
  listing,
} from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { canPerformAutomationAction } from '../services/automation-meter';
import { AUTOMATION_JOB_PRIORITY, AUTOMATION_ENGINE, AUTOMATION_MAX_ATTEMPTS } from '@twicely/crosslister/automation/constants';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SellerDropSettings {
  userId: string;
  priceDropPercent: number;
  priceDropIntervalDays: number;
  priceDropFloorPercent: number;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * Run the smart price drop engine for all eligible sellers.
 * Called by the automation scheduler at 04:00 UTC daily.
 */
export async function runPriceDropEngine(): Promise<void> {
  logger.info('[priceDropEngine] Starting run');

  const sellers = await db
    .select({
      userId: sellerProfile.userId,
      priceDropPercent: automationSetting.priceDropPercent,
      priceDropIntervalDays: automationSetting.priceDropIntervalDays,
      priceDropFloorPercent: automationSetting.priceDropFloorPercent,
    })
    .from(sellerProfile)
    .innerJoin(automationSetting, eq(automationSetting.sellerId, sellerProfile.userId))
    .where(
      and(
        eq(sellerProfile.hasAutomation, true),
        eq(automationSetting.priceDropEnabled, true),
      ),
    );

  logger.info('[priceDropEngine] Found eligible sellers', { count: sellers.length });

  for (const seller of sellers) {
    await processSellerPriceDrop(seller);
  }

  logger.info('[priceDropEngine] Run complete');
}

async function processSellerPriceDrop(seller: SellerDropSettings): Promise<void> {
  const { userId, priceDropPercent, priceDropIntervalDays, priceDropFloorPercent } = seller;

  const meter = await canPerformAutomationAction(userId);
  if (!meter.allowed) {
    logger.warn('[priceDropEngine] Seller at action limit — skipping', { userId });
    return;
  }

  const intervalMs = priceDropIntervalDays * 24 * 60 * 60 * 1000;
  const intervalCutoff = new Date(Date.now() - intervalMs);
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  // Find ACTIVE listings with at least one ACTIVE projection
  const listings = await db
    .selectDistinct({
      listingId: listing.id,
      priceCents: listing.priceCents,
    })
    .from(listing)
    .innerJoin(channelProjection, eq(channelProjection.listingId, listing.id))
    .where(
      and(
        eq(listing.ownerUserId, userId),
        eq(listing.status, 'ACTIVE'),
        eq(channelProjection.status, 'ACTIVE'),
        sql`${listing.priceCents} > 0`,
      ),
    )
    .limit(100);

  if (listings.length === 0) return;

  let actionsCreated = 0;

  for (const item of listings) {
    const currentMeter = await canPerformAutomationAction(userId);
    if (!currentMeter.allowed) break;

    const idempotencyKey = `price-drop:${item.listingId}:${monthKey}`;

    // Check if a price drop job already ran for this listing this month
    const [lastDrop] = await db
      .select({
        id: crossJob.id,
        createdAt: crossJob.createdAt,
        payload: crossJob.payload,
      })
      .from(crossJob)
      .where(
        and(
          eq(crossJob.sellerId, userId),
          sql`${crossJob.payload}->>'automationEngine' = ${AUTOMATION_ENGINE.PRICE_DROP}`,
          sql`${crossJob.payload}->>'listingId' = ${item.listingId}`,
        ),
      )
      .orderBy(sql`${crossJob.createdAt} DESC`)
      .limit(1);

    // Respect interval: skip if dropped more recently than interval
    if (lastDrop && new Date(lastDrop.createdAt).getTime() > intervalCutoff.getTime()) {
      continue;
    }

    // Skip if idempotency key already exists for this month
    const [existingMonthly] = await db
      .select({ id: crossJob.id })
      .from(crossJob)
      .where(eq(crossJob.idempotencyKey, idempotencyKey))
      .limit(1);
    if (existingMonthly) continue;

    // Skip if listing price is null (shouldn't happen given sql filter, but guard for TypeScript)
    if (item.priceCents === null) continue;

    // Determine original price for floor enforcement
    const payloadData = lastDrop?.payload as Record<string, unknown> | null;
    const originalPriceCents: number =
      typeof payloadData?.originalPriceCents === 'number'
        ? payloadData.originalPriceCents
        : item.priceCents;

    const floorPriceCents = Math.ceil((originalPriceCents * priceDropFloorPercent) / 100);

    // Calculate new price (integer cents)
    const newPriceCents = Math.round(item.priceCents * (100 - priceDropPercent) / 100);

    // Enforce floor
    if (item.priceCents <= floorPriceCents) {
      // Already at or below floor — skip
      continue;
    }

    const finalPriceCents = Math.max(newPriceCents, floorPriceCents);

    // Find all ACTIVE projections for this listing
    const projections = await db
      .select({
        id: channelProjection.id,
        accountId: channelProjection.accountId,
        channel: channelProjection.channel,
      })
      .from(channelProjection)
      .where(
        and(
          eq(channelProjection.listingId, item.listingId),
          eq(channelProjection.sellerId, userId),
          eq(channelProjection.status, 'ACTIVE'),
        ),
      );

    // Update canonical listing price
    await db
      .update(listing)
      .set({ priceCents: finalPriceCents, updatedAt: now })
      .where(eq(listing.id, item.listingId));

    // Create one UPDATE job per projection
    for (const proj of projections) {
      const platformEnabled = await getPlatformSetting<boolean>(
        `automation.${proj.channel.toLowerCase()}.enabled`,
        true,
      );
      if (!platformEnabled) continue;

      const projKey = `price-drop:${proj.id}:${monthKey}`;

      await db.insert(crossJob).values({
        sellerId: userId,
        projectionId: proj.id,
        accountId: proj.accountId,
        jobType: 'UPDATE',
        priority: AUTOMATION_JOB_PRIORITY,
        idempotencyKey: projKey,
        status: 'PENDING',
        maxAttempts: AUTOMATION_MAX_ATTEMPTS,
        payload: {
          automationEngine: AUTOMATION_ENGINE.PRICE_DROP,
          projectionId: proj.id,
          listingId: item.listingId,
          channel: proj.channel,
          newPriceCents: finalPriceCents,
          oldPriceCents: item.priceCents,
          originalPriceCents,
        },
      });
    }

    actionsCreated++;
  }

  if (actionsCreated > 0) {
    logger.info('[priceDropEngine] Created price drop jobs', { userId, actionsCreated });
  }
}
