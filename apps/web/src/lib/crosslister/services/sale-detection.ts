/**
 * Sale detection service — processes detected off-platform sales regardless of source.
 * Source: F5-S1 install prompt §1.1; Lister Canonical §12 (sale detection, emergency delists,
 * double-sell); §21 (Centrifugo events: sale.detected, delist.completed)
 *
 * Decision #31: No fees on off-platform sales. Data is informational only.
 * Double-sell tracking: uses audit_event (no new schema column needed, per install prompt §1.6).
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { listing, channelProjection, auditEvent } from '@twicely/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { notify } from '@twicely/notifications/service';
import { publishToChannel, sellerChannel } from '@twicely/realtime/centrifugo-publisher';
import { emergencyDelistQueue } from '../queue/emergency-delist-queue';
import { postOffPlatformSale } from '@twicely/finance/post-off-platform-sale';
import { formatCentsToDollars } from '@twicely/finance/format';
import type { ExternalChannel } from '../types';

export interface DetectedSale {
  /** Twicely canonical listing ID */
  listingId: string;
  /** channel_projection PK that sold */
  projectionId: string;
  /** Which channel the sale was detected on */
  channel: ExternalChannel;
  /** Platform's order/transaction ID */
  externalOrderId: string;
  /** Sale price in cents */
  salePriceCents: number;
  /** Platform's fee in cents (informational only — Decision #31) */
  platformFeeCents: number;
  /** External buyer identifier (optional) */
  buyerUsername?: string;
  /** When the sale occurred on the external platform */
  soldAt: Date;
}

/**
 * Find the channel that originally sold this listing (for double-sell notifications).
 * Looks for a SOLD channel projection. Returns 'UNKNOWN' if none found.
 */
async function findOriginalSoldChannel(listingId: string): Promise<string> {
  const [soldProj] = await db
    .select({ channel: channelProjection.channel })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.listingId, listingId),
        eq(channelProjection.status, 'SOLD'),
      ),
    )
    .limit(1);

  return soldProj?.channel ?? 'UNKNOWN';
}

/**
 * Process a detected off-platform sale.
 * Idempotent — safe to call multiple times with the same projectionId.
 *
 * Flow:
 * 1. Idempotency check via projection status
 * 2. Double-sell check (if listing already SOLD)
 * 3. Mark listing SOLD (soldAt, soldPriceCents)
 * 4. Update selling projection to SOLD
 * 5. Create emergency delist jobs for all other ACTIVE projections
 * 6. Record audit event for SALE_DETECTED
 * 7. Notify seller via Centrifugo + in-app notification
 */
export async function handleDetectedSale(sale: DetectedSale): Promise<void> {
  const { listingId, projectionId, channel, externalOrderId, salePriceCents, soldAt } = sale;

  logger.info('[saleDetection] Processing detected sale', { listingId, channel, externalOrderId });

  // Step 1: Idempotency — check if projection is already SOLD
  const [proj] = await db
    .select({ id: channelProjection.id, status: channelProjection.status })
    .from(channelProjection)
    .where(eq(channelProjection.id, projectionId))
    .limit(1);

  if (!proj) {
    logger.warn('[saleDetection] Projection not found — skipping', { projectionId });
    return;
  }

  if (proj.status === 'SOLD') {
    logger.info('[saleDetection] Projection already SOLD — idempotent skip', { projectionId });
    return;
  }

  // Step 2: Double-sell check — if the canonical listing is already SOLD
  const [listingRow] = await db
    .select({
      id: listing.id,
      status: listing.status,
      ownerUserId: listing.ownerUserId,
      title: listing.title,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    logger.warn('[saleDetection] Listing not found — skipping', { listingId });
    return;
  }

  if (listingRow.status === 'SOLD') {
    logger.warn('[saleDetection] Double-sell detected!', { listingId, channel, externalOrderId });

    // Find the channel from the first sale for notification context
    const originalChannel = await findOriginalSoldChannel(listingId);

    // Record POTENTIAL_DOUBLE_SELL via audit event (install prompt §1.6 Option A)
    await db.insert(auditEvent).values({
      actorType: 'SYSTEM',
      actorId: null,
      action: 'DOUBLE_SELL_DETECTED',
      subject: 'listing',
      subjectId: listingId,
      severity: 'HIGH',
      detailsJson: {
        channel1: originalChannel,
        channel2: channel,
        externalOrderId,
        salePriceCents,
      } as Record<string, unknown>,
    });

    // Notify seller — do NOT create new delist jobs (already running from first sale)
    const title = listingRow.title ?? 'your item';
    await notify(listingRow.ownerUserId, 'crosslister.double_sell', {
      itemTitle: title,
      channel1: originalChannel,
      channel2: channel,
    });

    return;
  }

  // Step 3: Mark canonical listing as SOLD
  // soldAt and soldPriceCents already exist on the listing table (schema §5.1).
  await db.update(listing).set({
    status: 'SOLD',
    soldAt,
    soldPriceCents: salePriceCents,
    updatedAt: new Date(),
  }).where(eq(listing.id, listingId));

  // Step 4: Mark the selling projection as SOLD
  await db.update(channelProjection).set({
    status: 'SOLD',
    updatedAt: new Date(),
  }).where(eq(channelProjection.id, projectionId));

  // Step 4.5: Post off-platform sale to financial ledger (informational — Decision #31)
  // Twicely-native sales already have ORDER_PAYMENT_CAPTURED via the commerce engine.
  // channel on DetectedSale is always ExternalChannel (TWICELY sales don't go through here).
  await postOffPlatformSale({
    userId: listingRow.ownerUserId,
    listingId,
    channel,
    externalOrderId,
    salePriceCents,
    platformFeeCents: sale.platformFeeCents,
    soldAt,
  });

  // Step 5: Fetch all other ACTIVE projections for this listing
  const activeProjections = await db
    .select({
      id: channelProjection.id,
      channel: channelProjection.channel,
    })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.listingId, listingId),
        eq(channelProjection.status, 'ACTIVE'),
        ne(channelProjection.id, projectionId),
      ),
    );

  // Create emergency delist jobs for each active projection (priority 0 = highest)
  const delistingChannels: string[] = [];
  for (const activeProjRow of activeProjections) {
    await emergencyDelistQueue.add('emergency-delist', {
      projectionId: activeProjRow.id,
      listingId,
      channel: activeProjRow.channel,
      reason: 'SALE_DETECTED',
      sourceChannel: channel,
      sourceSaleId: externalOrderId,
    }, {
      priority: 0,
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 2000 },
    });
    delistingChannels.push(activeProjRow.channel);
  }

  logger.info('[saleDetection] Emergency delist jobs created', {
    listingId,
    count: activeProjections.length,
    channels: delistingChannels,
  });

  // Step 6: Record SALE_DETECTED audit event
  await db.insert(auditEvent).values({
    actorType: 'SYSTEM',
    actorId: null,
    action: 'SALE_DETECTED',
    subject: 'listing',
    subjectId: listingId,
    severity: 'LOW',
    detailsJson: {
      channel,
      externalOrderId,
      salePriceCents,
      delistingChannels,
    } as Record<string, unknown>,
  });

  // Step 7: Notify seller
  const itemTitle = listingRow.title ?? 'your item';
  const salePriceFormatted = formatCentsToDollars(salePriceCents);
  const delistingPlatformsText = delistingChannels.join(', ') || 'no other platforms';

  // In-app notification
  await notify(listingRow.ownerUserId, 'crosslister.sale_detected', {
    itemTitle,
    channel,
    salePriceFormatted,
    delistingPlatforms: delistingPlatformsText,
  });

  // Centrifugo real-time event: sale.detected on private-user.{sellerId}
  await publishToChannel(sellerChannel(listingRow.ownerUserId), {
    event: 'sale.detected',
    listingId,
    channel,
    salePriceCents,
    delistingPlatforms: delistingChannels,
  });

  logger.info('[saleDetection] Sale processing complete', { listingId, channel, externalOrderId });
}
