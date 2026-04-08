/**
 * Local Transaction Service (G2.7 — dual-token Ed25519)
 *
 * Creates and manages local pickup transactions with dual-token signing.
 * Generates Ed25519-signed seller and buyer tokens at transaction creation.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A4
 */

import { db } from '@twicely/db';
import { localTransaction, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { generateTokenPair } from './local-token';
import { reserveListingForLocalTransaction } from './local-reserve';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { canTransition } from './local-state-machine';

// Re-export token validation from split module
export {
  validateSellerToken,
  validateBuyerToken,
  validateSellerOfflineCode,
  validateBuyerOfflineCode,
} from './local-code-validation';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateLocalTransactionInput {
  orderId: string;
  buyerId: string;
  sellerId: string;
  meetupLocationId?: string;
}

export interface LocalTransactionResult {
  success: boolean;
  transactionId?: string;
  sellerToken?: string;
  buyerToken?: string;
  sellerOfflineCode?: string;
  buyerOfflineCode?: string;
  error?: string;
}

// ─── Transaction Management ──────────────────────────────────────────────────

/**
 * Create a new local transaction for an order.
 *
 * Per G2.9: scheduledAt is now nullable — the meetup time is set via the
 * mutual agreement flow (proposeMeetupTimeAction / acceptMeetupTimeAction).
 * Tokens are generated with placeholder expiry at creation and regenerated
 * with real expiry when scheduledAt is confirmed (Option A per install prompt §2I).
 *
 * The auto-cancel job is enqueued at scheduling acceptance time, not here.
 * The schedule-nudge job is enqueued here (fires 24hr after creation if no time agreed).
 */
export async function createLocalTransaction(
  input: CreateLocalTransactionInput
): Promise<LocalTransactionResult> {
  const { orderId, buyerId, sellerId, meetupLocationId } = input;

  // Placeholder expiry: maxLeadTimeDays from now (will be regenerated at scheduling confirmation)
  const maxLeadTimeDays = await getPlatformSetting<number>('commerce.local.schedulingMaxLeadTimeDays', 30);
  const placeholderExpiresAt = new Date();
  placeholderExpiresAt.setDate(placeholderExpiresAt.getDate() + maxLeadTimeDays);

  // Fetch real order amount for token payload
  const [ord] = await db
    .select({ itemSubtotalCents: order.itemSubtotalCents })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  const amountCents = ord?.itemSubtotalCents ?? 0;

  const {
    sellerOfflineCode,
    buyerOfflineCode,
  } = generateTokenPair({
    transactionId: '', // placeholder — will be updated after insert
    amountCents,
    buyerId,
    sellerId,
    expiresAt: placeholderExpiresAt,
  });

  // We generate tokens first, then insert. The transactionId is in the payload
  // but the row doesn't exist yet. Re-generate after we have the ID.
  let transactionId: string;

  try {
    const now = Date.now();
    const [transaction] = await db
      .insert(localTransaction)
      .values({
        orderId,
        buyerId,
        sellerId,
        scheduledAt: null,
        meetupLocationId,
        // Temporary placeholder codes — replaced immediately below
        sellerConfirmationCode: `pending-${now}-s`,
        sellerOfflineCode,
        buyerConfirmationCode: `pending-${now}-b`,
        buyerOfflineCode,
        status: 'SCHEDULED',
      })
      .returning({ id: localTransaction.id });

    if (!transaction) {
      return { success: false, error: 'Failed to create local transaction' };
    }

    transactionId = transaction.id;

    // Re-generate tokens with the real transactionId and placeholder expiry
    const finalTokens = generateTokenPair({
      transactionId,
      amountCents,
      buyerId,
      sellerId,
      expiresAt: placeholderExpiresAt,
    });

    await db
      .update(localTransaction)
      .set({
        sellerConfirmationCode: finalTokens.sellerToken,
        sellerOfflineCode: finalTokens.sellerOfflineCode,
        buyerConfirmationCode: finalTokens.buyerToken,
        buyerOfflineCode: finalTokens.buyerOfflineCode,
        updatedAt: new Date(),
      })
      .where(eq(localTransaction.id, transactionId));

    // NOTE: auto-cancel is NOT enqueued here. It is enqueued when both parties
    // confirm the meetup time via acceptMeetupTimeAction (G2.9).
    // The schedule-nudge job (fires if no time agreed 24hr after creation)
    // is enqueued by the caller (checkout flow).

    // Auto-reserve the listing (SafeTrade only — fire-and-forget, do not block on failure)
    void reserveListingForLocalTransaction(orderId).catch((err) => {
      logger.error('[local-transaction] Failed to reserve listing', {
        orderId,
        error: String(err),
      });
    });

    return {
      success: true,
      transactionId,
      sellerToken: finalTokens.sellerToken,
      buyerToken: finalTokens.buyerToken,
      sellerOfflineCode: finalTokens.sellerOfflineCode,
      buyerOfflineCode: finalTokens.buyerOfflineCode,
    };
  } catch (error) {
    logger.error('[local-transaction] Failed to create', { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create local transaction',
    };
  }
}

/**
 * Confirm receipt of a local transaction (buyer received item).
 *
 * Transitions: BOTH_CHECKED_IN → RECEIPT_CONFIRMED
 * (The subsequent RECEIPT_CONFIRMED → COMPLETED transition is applied by the
 * escrow-release / payout completion path once funds are disbursed.)
 *
 * Idempotent: if already RECEIPT_CONFIRMED, returns success without re-updating.
 *
 * @param transactionId - The local transaction ID
 * @param mode - How the confirmation was done
 */
export async function confirmLocalTransaction(
  transactionId: string,
  mode: 'QR_ONLINE' | 'QR_DUAL_OFFLINE' | 'CODE_ONLINE' | 'CODE_DUAL_OFFLINE'
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();

  try {
    const [tx] = await db
      .select({ id: localTransaction.id, status: localTransaction.status })
      .from(localTransaction)
      .where(eq(localTransaction.id, transactionId))
      .limit(1);

    if (!tx) {
      return { success: false, error: 'Transaction not found' };
    }

    // Idempotency: already confirmed is a no-op success
    if (tx.status === 'RECEIPT_CONFIRMED') {
      return { success: true };
    }

    if (!canTransition(tx.status, 'RECEIPT_CONFIRMED')) {
      return {
        success: false,
        error: `Cannot transition from ${tx.status} to RECEIPT_CONFIRMED`,
      };
    }

    const [updated] = await db
      .update(localTransaction)
      .set({
        status: 'RECEIPT_CONFIRMED',
        confirmationMode: mode,
        confirmedAt: now,
        offlineConfirmedAt: (mode === 'QR_DUAL_OFFLINE' || mode === 'CODE_DUAL_OFFLINE') ? now : undefined,
        updatedAt: now,
      })
      .where(eq(localTransaction.id, transactionId))
      .returning({ id: localTransaction.id });

    if (!updated) {
      return { success: false, error: 'Transaction not found' };
    }

    return { success: true };
  } catch (error) {
    logger.error('[local-transaction] Failed to confirm', { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm transaction',
    };
  }
}

/**
 * Record check-in for a party (buyer or seller).
 *
 * Transitions (all gated by canTransition):
 *   SCHEDULED → SELLER_CHECKED_IN  (seller checks in first)
 *   SCHEDULED → BUYER_CHECKED_IN   (buyer checks in first)
 *   SELLER_CHECKED_IN → BOTH_CHECKED_IN  (buyer arrives second)
 *   BUYER_CHECKED_IN  → BOTH_CHECKED_IN  (seller arrives second)
 */
export async function recordCheckIn(
  transactionId: string,
  party: 'BUYER' | 'SELLER'
): Promise<{ success: boolean; bothCheckedIn: boolean; error?: string }> {
  const now = new Date();

  const [transaction] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, transactionId))
    .limit(1);

  if (!transaction) {
    return { success: false, bothCheckedIn: false, error: 'Transaction not found' };
  }

  const sellerCheckedIn = party === 'SELLER' ? true : transaction.sellerCheckedIn;
  const buyerCheckedIn = party === 'BUYER' ? true : transaction.buyerCheckedIn;
  const bothCheckedIn = sellerCheckedIn && buyerCheckedIn;

  // Determine the target status and validate the transition
  const targetStatus = bothCheckedIn
    ? 'BOTH_CHECKED_IN'
    : party === 'SELLER'
      ? 'SELLER_CHECKED_IN'
      : 'BUYER_CHECKED_IN';

  if (!canTransition(transaction.status, targetStatus)) {
    return {
      success: false,
      bothCheckedIn: false,
      error: `Cannot transition from ${transaction.status} to ${targetStatus}`,
    };
  }

  const updates = party === 'BUYER'
    ? { buyerCheckedIn: true, buyerCheckedInAt: now, updatedAt: now }
    : { sellerCheckedIn: true, sellerCheckedInAt: now, updatedAt: now };

  await db
    .update(localTransaction)
    .set(updates)
    .where(eq(localTransaction.id, transactionId));

  await db
    .update(localTransaction)
    .set({ status: targetStatus, updatedAt: now })
    .where(eq(localTransaction.id, transactionId));

  return { success: true, bothCheckedIn };
}
