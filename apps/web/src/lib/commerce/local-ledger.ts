/**
 * Local Transaction Ledger Entries (G2.4, updated per Decision #118)
 *
 * Creates ledger entries when a local transaction receipt is confirmed.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL.md §8 and Finance Engine §4:
 * - ORDER_PAYMENT_CAPTURED: credit to seller (gross sale amount)
 * - LOCAL_TRANSACTION_FEE: debit to seller (progressive TF brackets, same as shipped)
 * - ORDER_STRIPE_PROCESSING_FEE: debit to seller (Stripe processing fee)
 *
 * Per Decision #118: Local sales use same progressive TF brackets as shipped orders.
 * Local sales do NOT count toward monthly GMV for bracket progression.
 * $0.50 minimum TF applies (same as shipped orders).
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { ledgerEntry, order, orderPayment } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueLocalEscrowRelease } from '@twicely/jobs/local-escrow-release';
import { markListingSoldForLocalTransaction } from '@twicely/commerce/local-reserve';
import { calculateLocalTfFromBrackets } from '@twicely/commerce/local-fee';
import { getSellerMonthlyGmv } from '@twicely/commerce/order-gmv';
import { logger } from '@twicely/logger';
import { formatCentsToDollars } from '@twicely/finance/format';

export interface CreateLocalTransactionLedgerEntriesInput {
  orderId: string;
  sellerId: string;
  salePriceCents: number;
  localTfCents: number;
  stripeFeeCents: number;
}

/**
 * Create three ledger entries for a completed local transaction:
 * 1. ORDER_PAYMENT_CAPTURED — credit to seller (salePriceCents)
 * 2. LOCAL_TRANSACTION_FEE — debit from seller (localTfCents)
 * 3. ORDER_STRIPE_PROCESSING_FEE — debit from seller (stripeFeeCents)
 *
 * All entries are linked by orderId and owned by sellerId.
 * Entries are POSTED immediately (no escrow hold at ledger level).
 */
export async function createLocalTransactionLedgerEntries(
  input: CreateLocalTransactionLedgerEntriesInput
): Promise<void> {
  const { orderId, sellerId, salePriceCents, localTfCents, stripeFeeCents } = input;

  const now = new Date();

  await db.transaction(async (tx) => {
    // 1. ORDER_PAYMENT_CAPTURED — positive (seller receives payment)
    await tx.insert(ledgerEntry).values({
      type: 'ORDER_PAYMENT_CAPTURED',
      status: 'POSTED',
      amountCents: salePriceCents,
      userId: sellerId,
      orderId,
      reasonCode: `local:${orderId}:capture`,
      memo: `Local pickup payment captured for order ${orderId}`,
      postedAt: now,
      createdAt: now,
    });

    // 2. LOCAL_TRANSACTION_FEE — negative (progressive TF brackets, same as shipped per Decision #118)
    await tx.insert(ledgerEntry).values({
      type: 'LOCAL_TRANSACTION_FEE',
      status: 'POSTED',
      amountCents: -localTfCents,
      userId: sellerId,
      orderId,
      reasonCode: `local:${orderId}:tf`,
      memo: `Local transaction fee for order ${orderId}`,
      postedAt: now,
      createdAt: now,
    });

    // 3. ORDER_STRIPE_PROCESSING_FEE — negative (Stripe processing fee)
    await tx.insert(ledgerEntry).values({
      type: 'ORDER_STRIPE_PROCESSING_FEE',
      status: 'POSTED',
      amountCents: -stripeFeeCents,
      userId: sellerId,
      orderId,
      reasonCode: `local:${orderId}:stripe`,
      memo: `Payment processing fee for order ${orderId}`,
      postedAt: now,
      createdAt: now,
    });
  });

  logger.info('[local-ledger] Created ledger entries for local transaction', {
    orderId,
    sellerId,
    salePriceCents,
    localTfCents,
    stripeFeeCents,
  });
}

// ─── Price Adjustment Ledger Entry ────────────────────────────────────────────

export interface CreatePriceAdjustmentLedgerEntryInput {
  orderId: string;
  sellerId: string;
  originalPriceCents: number;
  adjustedPriceCents: number;
}

/**
 * Create a LOCAL_PRICE_ADJUSTMENT ledger entry when a buyer accepts
 * a meetup price reduction. The delta is recorded as a negative (debit)
 * amount against the seller's pending earnings.
 *
 * TF remains calculated on the original price — this entry only records
 * the delta between original and adjusted price.
 */
export async function createPriceAdjustmentLedgerEntry(
  input: CreatePriceAdjustmentLedgerEntryInput,
): Promise<void> {
  const { orderId, sellerId, originalPriceCents, adjustedPriceCents } = input;

  const deltaCents = originalPriceCents - adjustedPriceCents;
  const now = new Date();

  await db.insert(ledgerEntry).values({
    type: 'LOCAL_PRICE_ADJUSTMENT',
    status: 'POSTED',
    amountCents: -deltaCents,
    userId: sellerId,
    orderId,
    reasonCode: `local:${orderId}:price-adjustment`,
    memo: `Local price adjustment: ${formatCentsToDollars(deltaCents)} reduction on order ${orderId}`,
    postedAt: now,
    createdAt: now,
  });

  logger.info('[local-ledger] Created price adjustment ledger entry', {
    orderId,
    sellerId,
    originalPriceCents,
    adjustedPriceCents,
    deltaCents,
  });
}

// ─── Cancel Refund Ledger Entry ──────────────────────────────────────────────

/**
 * Create a REFUND_FULL ledger entry when a local transaction is canceled
 * and a Stripe refund is issued. Records the refund for reconciliation.
 *
 * Called from local-cancel.ts after stripe.refunds.create() succeeds.
 */
export async function createLocalCancelRefundLedgerEntry(
  orderId: string,
  sellerId: string,
): Promise<void> {
  const [ord] = await db
    .select({ itemSubtotalCents: order.itemSubtotalCents })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!ord?.itemSubtotalCents) return;

  const now = new Date();
  await db.insert(ledgerEntry).values({
    type: 'REFUND_FULL',
    status: 'POSTED',
    amountCents: -ord.itemSubtotalCents,
    userId: sellerId,
    orderId,
    reasonCode: `local:${orderId}:cancel-refund`,
    memo: `Full refund for canceled local transaction (order ${orderId})`,
    postedAt: now,
    createdAt: now,
  });

  logger.info('[local-ledger] Created cancel refund ledger entry', {
    orderId,
    sellerId,
    amountCents: ord.itemSubtotalCents,
  });
}

// ─── Post-Confirmation Effects ──────────────────────────────────────────────

/**
 * Shared side effects after a local transaction receipt is confirmed.
 *
 * 1. Mark order as DELIVERED
 * 2. Read sale price + Stripe fee
 * 3. Calculate local TF (progressive TF brackets, same as shipped, per Decision #118)
 * 4. Create ledger entries
 * 5. Enqueue escrow release
 *
 * Used by both online and offline confirmation flows.
 */
export async function postConfirmationEffects(
  localTransactionId: string,
  orderId: string,
  sellerId: string,
  now: Date,
): Promise<void> {
  await db
    .update(order)
    .set({ status: 'DELIVERED', deliveredAt: now, updatedAt: now })
    .where(eq(order.id, orderId));

  await markListingSoldForLocalTransaction(orderId);

  const [ord] = await db
    .select({ itemSubtotalCents: order.itemSubtotalCents })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  const [payment] = await db
    .select({ stripeFeesCents: orderPayment.stripeFeesCents })
    .from(orderPayment)
    .where(eq(orderPayment.orderId, orderId))
    .limit(1);

  const salePriceCents = ord?.itemSubtotalCents ?? 0;
  const sellerMonthlyGmv = await getSellerMonthlyGmv(sellerId);
  const tfResult = await calculateLocalTfFromBrackets(sellerMonthlyGmv, salePriceCents);
  const localTfCents = tfResult.tfCents;
  const stripeFeeCents = payment?.stripeFeesCents ?? 0;

  await createLocalTransactionLedgerEntries({
    orderId,
    sellerId,
    salePriceCents,
    localTfCents,
    stripeFeeCents,
  });

  await enqueueLocalEscrowRelease(localTransactionId, orderId);
}
