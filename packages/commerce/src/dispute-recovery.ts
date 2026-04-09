/**
 * Post-Release Claim Recovery Waterfall (Decision #92)
 *
 * When a buyer wins a dispute AFTER the seller has already received their
 * payout (or the payout is en route), the platform must attempt to claw back
 * the refunded amount from the seller before absorbing the loss.
 *
 * Decision #92 specifies a three-step waterfall:
 *
 *   1. Deduct from `seller_balance.availableCents` (cleared escrow, not yet
 *      paid out — easiest to recover, no Stripe API call needed)
 *   2. Deduct from `seller_balance.reservedCents` (funds held back as buffer)
 *   3. Platform absorbs whatever remains (PLATFORM_ABSORBED_COST ledger entry)
 *
 * Each step writes a ledger entry so the recovery is fully auditable.
 *
 * This is called from `resolveDispute()` BEFORE the Stripe refund is issued
 * to the buyer, so the platform's net loss is minimized.
 *
 * Audit reference: 2026-04-07 — `mk-buyer-protection` audit found Decision #92
 *                  was unimplemented. This file is the implementation.
 */

import { db } from '@twicely/db';
import { sellerBalance, ledgerEntry } from '@twicely/db/schema';
import { eq, sql } from 'drizzle-orm';

export interface WaterfallInput {
  sellerId: string;
  amountCents: number;
  disputeId: string;
  /** Optional reference order ID — recorded on the ledger entry. */
  orderId?: string;
}

export interface WaterfallResult {
  recoveredFromAvailableCents: number;
  recoveredFromReservedCents: number;
  platformAbsorbedCents: number;
  /** Sum of all three buckets — should equal input.amountCents. */
  totalCents: number;
}

/**
 * Run the Decision #92 recovery waterfall against a seller.
 *
 * Atomic — all reads + writes happen in a single transaction. If the seller
 * row doesn't exist (PERSONAL seller with no balance row), the entire amount
 * is platform-absorbed.
 *
 * @param input.sellerId   — the seller userId
 * @param input.amountCents — total amount to recover (positive integer cents)
 * @param input.disputeId   — dispute ID for audit/reference
 * @param input.orderId     — optional order ID for ledger linkage
 */
export async function recoverFromSellerWaterfall(
  input: WaterfallInput
): Promise<WaterfallResult> {
  const { sellerId, amountCents, disputeId, orderId } = input;

  if (amountCents <= 0) {
    return {
      recoveredFromAvailableCents: 0,
      recoveredFromReservedCents: 0,
      platformAbsorbedCents: 0,
      totalCents: 0,
    };
  }

  return await db.transaction(async (tx) => {
    // Lock the seller_balance row for update — prevents concurrent recoveries
    // from racing. If no row exists (e.g. PERSONAL seller never received any
    // funds), the entire amount becomes platform absorption.
    const [balanceRow] = await tx
      .select({
        userId: sellerBalance.userId,
        availableCents: sellerBalance.availableCents,
        reservedCents: sellerBalance.reservedCents,
      })
      .from(sellerBalance)
      .where(eq(sellerBalance.userId, sellerId))
      .for('update')
      .limit(1);

    let remaining = amountCents;
    let fromAvailable = 0;
    let fromReserved = 0;

    if (balanceRow) {
      // Step 1: deduct from availableCents
      if (balanceRow.availableCents > 0 && remaining > 0) {
        fromAvailable = Math.min(balanceRow.availableCents, remaining);
        remaining -= fromAvailable;
      }

      // Step 2: deduct from reservedCents
      if (balanceRow.reservedCents > 0 && remaining > 0) {
        fromReserved = Math.min(balanceRow.reservedCents, remaining);
        remaining -= fromReserved;
      }

      // Apply the deductions to seller_balance in one update
      if (fromAvailable > 0 || fromReserved > 0) {
        await tx
          .update(sellerBalance)
          .set({
            availableCents: sql`${sellerBalance.availableCents} - ${fromAvailable}`,
            reservedCents: sql`${sellerBalance.reservedCents} - ${fromReserved}`,
            updatedAt: new Date(),
          })
          .where(eq(sellerBalance.userId, sellerId));
      }
    }

    // Step 3: whatever's left is platform absorption
    const platformAbsorbed = remaining;

    // Write ledger entries for each non-zero step (audit trail per Decision #92)
    const now = new Date();
    const memo = `Buyer protection recovery — dispute ${disputeId}`;

    if (fromAvailable > 0) {
      await tx.insert(ledgerEntry).values({
        type: 'RESERVE_HOLD',
        status: 'POSTED',
        amountCents: -fromAvailable, // negative = debit from seller
        userId: sellerId,
        ...(orderId ? { orderId } : {}),
        memo: `${memo} (step 1: from available)`,
        idempotencyKey: `dispute_recovery:${disputeId}:seller_available`,
        postedAt: now,
      });
    }

    if (fromReserved > 0) {
      await tx.insert(ledgerEntry).values({
        type: 'RESERVE_HOLD',
        status: 'POSTED',
        amountCents: -fromReserved, // negative = debit from seller
        userId: sellerId,
        ...(orderId ? { orderId } : {}),
        memo: `${memo} (step 2: from reserved)`,
        idempotencyKey: `dispute_recovery:${disputeId}:seller_reserved`,
        postedAt: now,
      });
    }

    if (platformAbsorbed > 0) {
      await tx.insert(ledgerEntry).values({
        type: 'PLATFORM_ABSORBED_COST',
        status: 'POSTED',
        amountCents: platformAbsorbed,
        userId: sellerId, // attributed to seller for reporting; actual cost is platform
        ...(orderId ? { orderId } : {}),
        memo: `${memo} (step 3: platform absorption)`,
        idempotencyKey: `dispute_recovery:${disputeId}:platform_absorb`,
        postedAt: now,
      });
    }

    return {
      recoveredFromAvailableCents: fromAvailable,
      recoveredFromReservedCents: fromReserved,
      platformAbsorbedCents: platformAbsorbed,
      totalCents: fromAvailable + fromReserved + platformAbsorbed,
    };
  });
}
