/**
 * Sale polling handler — processes poll results from platforms without webhooks.
 * Source: F5-S1 install prompt §1.4; Lister Canonical §13 (adaptive polling engine)
 *
 * For platforms without webhooks (Poshmark, Mercari, Depop), the adaptive polling
 * engine detects sales by comparing current platform state to last known state.
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { channelProjection } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { handleDetectedSale } from '../services/sale-detection';
import { getPlatformFeeRate, calculatePlatformFee } from '../services/platform-fees';
import type { ChannelProjection } from '../db-types';
import type { ExternalChannel } from '../types';

/**
 * Current state of a listing as fetched from an external platform during polling.
 * Normalized from platform-specific formats by the polling engine.
 */
export interface ExternalListingState {
  /** The external listing ID on the platform */
  externalId: string;
  /** Current status on the platform */
  status: 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT' | 'UNKNOWN';
  /** Current price in cents (null if not available) */
  priceCents: number | null;
  /** Platform's buyer identifier if SOLD */
  buyerUsername?: string;
  /** Sale price in cents if SOLD (may differ from listing price) */
  soldPriceCents?: number;
  /** External order/transaction ID if SOLD */
  externalOrderId?: string;
  /** When the status last changed on the platform */
  lastChangedAt?: Date;
}

/**
 * Process a poll result for a single projection.
 * Detects sales (status SOLD) and ended listings (status ENDED).
 *
 * Called by the adaptive polling engine after fetching current state from a platform.
 */
export async function parsePollResult(
  projection: ChannelProjection,
  currentState: ExternalListingState,
): Promise<void> {
  const channel = projection.channel as ExternalChannel;

  // Only process ACTIVE projections — already-SOLD or DELISTED ones don't need polling action
  if (projection.status !== 'ACTIVE') {
    return;
  }

  if (currentState.status === 'SOLD') {
    logger.info('[salePollingHandler] Polled listing detected as SOLD', {
      projectionId: projection.id,
      listingId: projection.listingId,
      channel,
    });

    const salePriceCents = currentState.soldPriceCents ?? currentState.priceCents ?? 0;
    const externalOrderId = currentState.externalOrderId ?? `poll-${channel}-${projection.externalId ?? 'unknown'}-${Date.now()}`;

    const feeRateBps = await getPlatformFeeRate(channel);
    const platformFeeCents = calculatePlatformFee(salePriceCents, feeRateBps);

    await handleDetectedSale({
      listingId: projection.listingId,
      projectionId: projection.id,
      channel,
      externalOrderId,
      salePriceCents,
      platformFeeCents,
      buyerUsername: currentState.buyerUsername,
      soldAt: currentState.lastChangedAt ?? new Date(),
    });

    return;
  }

  if (currentState.status === 'ENDED') {
    logger.info('[salePollingHandler] Polled listing detected as ENDED (not sold)', {
      projectionId: projection.id,
      listingId: projection.listingId,
      channel,
    });

    // Seller ended on platform directly — update projection status, do NOT mark listing SOLD
    await db.update(channelProjection).set({
      status: 'ENDED',
      updatedAt: new Date(),
    }).where(eq(channelProjection.id, projection.id));
  }
}
