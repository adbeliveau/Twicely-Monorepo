/**
 * Offer-to-Likers Engine (F6.1)
 *
 * Sends automated discounted offers to interested buyers on platforms
 * that support the feature (eBay, Poshmark, Mercari, Depop).
 * Source: F6.1 install prompt §D.3; Lister Canonical Section 17.1;
 * Decision Rationale #68.
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
import { eq, and, lt, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { canPerformAutomationAction } from '../services/automation-meter';
import { getConnector } from '../connector-registry';
import type { ExternalChannel } from '../types';
import { AUTOMATION_JOB_PRIORITY, AUTOMATION_ENGINE, OFFER_COOLDOWN_DAYS, AUTOMATION_MAX_ATTEMPTS } from './constants';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SellerOfferSettings {
  userId: string;
  offerDiscountPercent: number;
  offerMinDaysListed: number;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * Run the offer-to-likers engine for all eligible sellers.
 * Called by the automation scheduler at 10:00 UTC daily.
 */
export async function runOfferToLikersEngine(): Promise<void> {
  logger.info('[offerToLikersEngine] Starting run');

  const sellers = await db
    .select({
      userId: sellerProfile.userId,
      offerDiscountPercent: automationSetting.offerDiscountPercent,
      offerMinDaysListed: automationSetting.offerMinDaysListed,
    })
    .from(sellerProfile)
    .innerJoin(automationSetting, eq(automationSetting.sellerId, sellerProfile.userId))
    .where(
      and(
        eq(sellerProfile.hasAutomation, true),
        eq(automationSetting.offerToLikersEnabled, true),
      ),
    );

  logger.info('[offerToLikersEngine] Found eligible sellers', { count: sellers.length });

  for (const seller of sellers) {
    await processSellerOffers(seller);
  }

  logger.info('[offerToLikersEngine] Run complete');
}

async function processSellerOffers(seller: SellerOfferSettings): Promise<void> {
  const { userId, offerDiscountPercent, offerMinDaysListed } = seller;

  const meter = await canPerformAutomationAction(userId);
  if (!meter.allowed) {
    logger.warn('[offerToLikersEngine] Seller at action limit — skipping', { userId });
    return;
  }

  const minListedCutoff = new Date(Date.now() - offerMinDaysListed * 24 * 60 * 60 * 1000);
  const cooldownCutoff = new Date(Date.now() - OFFER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  // Find ACTIVE projections older than minDaysListed
  const projections = await db
    .select({
      id: channelProjection.id,
      listingId: channelProjection.listingId,
      accountId: channelProjection.accountId,
      channel: channelProjection.channel,
    })
    .from(channelProjection)
    .innerJoin(listing, eq(listing.id, channelProjection.listingId))
    .where(
      and(
        eq(channelProjection.sellerId, userId),
        eq(channelProjection.status, 'ACTIVE'),
        lt(channelProjection.createdAt, minListedCutoff),
        eq(listing.status, 'ACTIVE'),
        sql`${listing.priceCents} > 0`,
      ),
    )
    .limit(100);

  if (projections.length === 0) return;

  let actionsCreated = 0;

  for (const proj of projections) {
    const currentMeter = await canPerformAutomationAction(userId);
    if (!currentMeter.allowed) break;

    // Check platform automation feature flag
    const platformEnabled = await getPlatformSetting<boolean>(
      `automation.${proj.channel.toLowerCase()}.enabled`,
      true,
    );
    if (!platformEnabled) continue;

    // Check ConnectorCapabilities.canMakeOffers
    let canMakeOffers = false;
    try {
      const connector = getConnector(proj.channel as ExternalChannel);
      canMakeOffers = connector.capabilities.canMakeOffers;
    } catch {
      canMakeOffers = false;
    }
    if (!canMakeOffers) continue;

    // Enforce 7-day cooldown between offers for same projection
    const [lastOffer] = await db
      .select({ id: crossJob.id, createdAt: crossJob.createdAt })
      .from(crossJob)
      .where(
        and(
          eq(crossJob.sellerId, userId),
          sql`${crossJob.payload}->>'automationEngine' = ${AUTOMATION_ENGINE.OFFER_TO_LIKERS}`,
          sql`${crossJob.payload}->>'projectionId' = ${proj.id}`,
        ),
      )
      .orderBy(sql`${crossJob.createdAt} DESC`)
      .limit(1);

    if (lastOffer && new Date(lastOffer.createdAt).getTime() > cooldownCutoff.getTime()) {
      continue;
    }

    // Get listing price for offer calculation
    const [listingRow] = await db
      .select({ priceCents: listing.priceCents })
      .from(listing)
      .where(eq(listing.id, proj.listingId))
      .limit(1);

    if (!listingRow || listingRow.priceCents === null || listingRow.priceCents <= 0) continue;

    // Calculate offer price (integer cents)
    const offerPriceCents = Math.round(listingRow.priceCents * (100 - offerDiscountPercent) / 100);

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const idempotencyKey = `offer-to-likers:${proj.id}:${monthKey}`;

    await db.insert(crossJob).values({
      sellerId: userId,
      projectionId: proj.id,
      accountId: proj.accountId,
      jobType: 'SYNC',
      priority: AUTOMATION_JOB_PRIORITY,
      idempotencyKey,
      status: 'PENDING',
      maxAttempts: AUTOMATION_MAX_ATTEMPTS,
      payload: {
        automationEngine: AUTOMATION_ENGINE.OFFER_TO_LIKERS,
        projectionId: proj.id,
        listingId: proj.listingId,
        channel: proj.channel,
        offerPriceCents,
        discountPercent: offerDiscountPercent,
      },
    });

    actionsCreated++;
  }

  if (actionsCreated > 0) {
    logger.info('[offerToLikersEngine] Created offer jobs', { userId, actionsCreated });
  }
}
