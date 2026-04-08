/**
 * Local Price Adjustment Service (G2.6 Addendum A3)
 *
 * Handles seller-initiated price reductions at the meetup when a flaw is
 * discovered. Buyer must accept or decline before receipt confirmation
 * can proceed.
 *
 * Rules (per Local Canonical Addendum §A3):
 * - Only allowed from BOTH_CHECKED_IN status
 * - Maximum discount read from platform_settings (commerce.local.maxAdjustmentPercent)
 * - Only one adjustment per transaction
 * - On accept: new confirmation codes are generated (old ones invalidated)
 * - On decline: adjustedPriceCents cleared, status returns to BOTH_CHECKED_IN
 * - TF always calculated on original price, NOT the adjusted price
 */

import { db } from '@twicely/db';
import { localTransaction, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { generateTokenPair } from './local-token';
import { canTransition } from './local-state-machine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidateAdjustmentResult {
  valid: boolean;
  error?: string;
  maxAdjustmentPercent?: number;
  floorCents?: number;
}

export interface AcceptAdjustmentResult {
  success: boolean;
  sellerToken?: string;
  buyerToken?: string;
  sellerOfflineCode?: string;
  buyerOfflineCode?: string;
  error?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a proposed price adjustment against platform rules.
 * Checks the max discount limit from platform_settings.
 */
export async function validateAdjustment(
  orderId: string,
  _localTransactionId: string,
  adjustedPriceCents: number,
): Promise<ValidateAdjustmentResult> {
  const [ord] = await db
    .select({ itemSubtotalCents: order.itemSubtotalCents })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!ord) {
    return { valid: false, error: 'Order not found' };
  }

  const originalPriceCents = ord.itemSubtotalCents;
  const maxAdjustmentPercent = await getPlatformSetting<number>(
    'commerce.local.maxAdjustmentPercent',
    33,
  );

  // Price must be less than original (a reduction)
  if (adjustedPriceCents >= originalPriceCents) {
    return {
      valid: false,
      error: 'Adjusted price must be less than the original price',
      maxAdjustmentPercent,
    };
  }

  // Price must be at least 1 cent
  if (adjustedPriceCents < 1) {
    return {
      valid: false,
      error: 'Adjusted price must be at least $0.01',
      maxAdjustmentPercent,
    };
  }

  // Calculate floor: original price minus max allowed discount
  const maxDiscountCents = Math.floor(originalPriceCents * maxAdjustmentPercent / 100);
  const floorCents = originalPriceCents - maxDiscountCents;

  if (adjustedPriceCents < floorCents) {
    return {
      valid: false,
      error: `Price reduction cannot exceed ${maxAdjustmentPercent}% of the original price`,
      maxAdjustmentPercent,
      floorCents,
    };
  }

  return { valid: true, maxAdjustmentPercent, floorCents };
}

// ─── Initiate ────────────────────────────────────────────────────────────────

/**
 * Seller initiates a price adjustment: sets adjustedPriceCents, adjustmentReason,
 * adjustmentInitiatedAt, and transitions status to ADJUSTMENT_PENDING.
 */
export async function initiatePriceAdjustment(
  localTransactionId: string,
  adjustedPriceCents: number,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();

  try {
    // Fetch current status and validate the transition before writing
    const [tx] = await db
      .select({ id: localTransaction.id, status: localTransaction.status })
      .from(localTransaction)
      .where(eq(localTransaction.id, localTransactionId))
      .limit(1);

    if (!tx) {
      return { success: false, error: 'Transaction not found' };
    }

    if (!canTransition(tx.status, 'ADJUSTMENT_PENDING')) {
      return {
        success: false,
        error: `Cannot transition from ${tx.status} to ADJUSTMENT_PENDING`,
      };
    }

    const [updated] = await db
      .update(localTransaction)
      .set({
        status: 'ADJUSTMENT_PENDING',
        adjustedPriceCents,
        adjustmentReason: reason,
        adjustmentInitiatedAt: now,
        updatedAt: now,
      })
      .where(eq(localTransaction.id, localTransactionId))
      .returning({ id: localTransaction.id });

    if (!updated) {
      return { success: false, error: 'Transaction not found' };
    }

    logger.info('[local-price-adjustment] Price adjustment initiated', {
      localTransactionId,
      adjustedPriceCents,
    });

    return { success: true };
  } catch (error) {
    logger.error('[local-price-adjustment] Failed to initiate adjustment', {
      localTransactionId,
      error: String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate adjustment',
    };
  }
}

// ─── Accept ───────────────────────────────────────────────────────────────────

/**
 * Buyer accepts the price adjustment: sets acceptedAt, generates new dual tokens
 * (overwriting old ones with adjusted amount), and returns status to BOTH_CHECKED_IN.
 */
export async function acceptPriceAdjustment(
  localTransactionId: string,
): Promise<AcceptAdjustmentResult> {
  const now = new Date();

  // Fetch transaction to get IDs and adjusted amount for token generation
  const [tx] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, localTransactionId))
    .limit(1);

  if (!tx) {
    return { success: false, error: 'Transaction not found' };
  }

  if (!canTransition(tx.status, 'BOTH_CHECKED_IN')) {
    return {
      success: false,
      error: `Cannot transition from ${tx.status} to BOTH_CHECKED_IN`,
    };
  }

  const tokenExpiryHours = await getPlatformSetting<number>('commerce.local.tokenExpiryHours', 48);
  // scheduledAt is nullable (G2.9) — fall back to 30 days from now if not yet set
  const baseDate = tx.scheduledAt ?? new Date();
  const expiresAt = new Date(baseDate);
  expiresAt.setHours(expiresAt.getHours() + tokenExpiryHours);

  const amountCents = tx.adjustedPriceCents ?? 0;

  const newTokens = generateTokenPair({
    transactionId: localTransactionId,
    amountCents,
    buyerId: tx.buyerId,
    sellerId: tx.sellerId,
    expiresAt,
  });

  try {
    const [updated] = await db
      .update(localTransaction)
      .set({
        status: 'BOTH_CHECKED_IN',
        sellerConfirmationCode: newTokens.sellerToken,
        sellerOfflineCode: newTokens.sellerOfflineCode,
        buyerConfirmationCode: newTokens.buyerToken,
        buyerOfflineCode: newTokens.buyerOfflineCode,
        adjustmentAcceptedAt: now,
        updatedAt: now,
      })
      .where(eq(localTransaction.id, localTransactionId))
      .returning({ id: localTransaction.id });

    if (!updated) {
      return { success: false, error: 'Transaction not found' };
    }

    logger.info('[local-price-adjustment] Price adjustment accepted, new tokens generated', {
      localTransactionId,
    });

    return {
      success: true,
      sellerToken: newTokens.sellerToken,
      buyerToken: newTokens.buyerToken,
      sellerOfflineCode: newTokens.sellerOfflineCode,
      buyerOfflineCode: newTokens.buyerOfflineCode,
    };
  } catch (error) {
    logger.error('[local-price-adjustment] Failed to accept adjustment', {
      localTransactionId,
      error: String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept adjustment',
    };
  }
}

// ─── Decline ──────────────────────────────────────────────────────────────────

/**
 * Buyer declines the price adjustment: sets declinedAt, clears adjustedPriceCents
 * to null, and returns status to BOTH_CHECKED_IN.
 */
export async function declinePriceAdjustment(
  localTransactionId: string,
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();

  try {
    // Fetch current status and validate the transition before writing
    const [tx] = await db
      .select({ id: localTransaction.id, status: localTransaction.status })
      .from(localTransaction)
      .where(eq(localTransaction.id, localTransactionId))
      .limit(1);

    if (!tx) {
      return { success: false, error: 'Transaction not found' };
    }

    if (!canTransition(tx.status, 'BOTH_CHECKED_IN')) {
      return {
        success: false,
        error: `Cannot transition from ${tx.status} to BOTH_CHECKED_IN`,
      };
    }

    const [updated] = await db
      .update(localTransaction)
      .set({
        status: 'BOTH_CHECKED_IN',
        adjustedPriceCents: null,
        adjustmentDeclinedAt: now,
        updatedAt: now,
      })
      .where(eq(localTransaction.id, localTransactionId))
      .returning({ id: localTransaction.id });

    if (!updated) {
      return { success: false, error: 'Transaction not found' };
    }

    logger.info('[local-price-adjustment] Price adjustment declined', {
      localTransactionId,
    });

    return { success: true };
  } catch (error) {
    logger.error('[local-price-adjustment] Failed to decline adjustment', {
      localTransactionId,
      error: String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to decline adjustment',
    };
  }
}

