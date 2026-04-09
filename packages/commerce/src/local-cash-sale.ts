/**
 * Local Cash Sale — Financial Center emission
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A16 and §A0:
 *   "Cash local transactions are tracked in the seller's Financial Center
 *    but Twicely does not charge any fee on them."
 *
 * Financial Center log: ✅ for BOTH SafeTrade and Cash (A0 feature table).
 *
 * This module creates a single INFORMATIONAL ledger entry when a seller
 * manually marks a cash local sale as complete. The entry is revenue-only:
 *   - NO sellerBalance update — cash never entered the Twicely payout system
 *   - NO transaction fee — $0 platform fee on cash sales (A16)
 *   - Informational pattern mirrors CROSSLISTER_SALE_REVENUE (Decision #31)
 *
 * Entry type: LOCAL_CASH_SALE_REVENUE — semantically distinct from crosslister
 * revenue; kept separate so FC P&L queries display the canonical A16 nudge:
 * "Cash sale — ${amount} ⚠️ Not covered by Twicely Buyer Protection".
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { ledgerEntry } from '@twicely/db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';

// Correlation key: one entry per localTransactionId (idempotency anchor)
function cashSaleReasonCode(localTransactionId: string): string {
  return `local-cash:${localTransactionId}:revenue`;
}

export interface PostLocalCashSaleParams {
  /** local_transaction.id — used for idempotency and memo context */
  localTransactionId: string;
  /** userId of the seller (ledger entry owner) */
  sellerId: string;
  /** userId of the buyer — may be null for Cash Only listings with no Twicely-buyer row */
  buyerId: string | null;
  /** Gross amount seller received in cash (integer cents, must be > 0) */
  amountCents: number;
  /** listing.id — optional */
  listingId: string | null;
}

export interface PostLocalCashSaleResult {
  ledgerEntryId: string;
}

/**
 * Post an INFORMATIONAL LOCAL_CASH_SALE_REVENUE ledger entry for a completed
 * cash local meetup sale.
 *
 * Idempotent — if an entry already exists for this localTransactionId the
 * existing entry ID is returned without inserting a duplicate.
 *
 * Does NOT update sellerBalance. Cash never flows through Twicely's payout
 * system — this entry is for P&L reporting and tax prep only (Decision #31
 * pattern, applied to cash local sales per A16).
 *
 * @throws {Error} if amountCents is <= 0 (defense-in-depth)
 */
export async function postLocalCashSale(
  params: PostLocalCashSaleParams,
): Promise<PostLocalCashSaleResult> {
  const { localTransactionId, sellerId, buyerId, amountCents, listingId } = params;

  if (amountCents <= 0) {
    throw new Error(
      `[local-cash-sale] amountCents must be > 0, got ${amountCents} for transaction ${localTransactionId}`,
    );
  }

  const rKey = cashSaleReasonCode(localTransactionId);

  // Idempotency check: if the entry was already posted, return the existing ID
  const [existing] = await db
    .select({ id: ledgerEntry.id })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, sellerId),
        eq(ledgerEntry.reasonCode, rKey),
      ),
    )
    .limit(1);

  if (existing) {
    logger.info('[local-cash-sale] Entry already posted — idempotent skip', {
      localTransactionId,
      sellerId,
      existingEntryId: existing.id,
    });
    return { ledgerEntryId: existing.id };
  }

  const now = new Date();

  // Memo encodes cash-sale context (ledgerEntry has no metadataJson column)
  const memoText = buyerId
    ? `Cash local sale for transaction ${localTransactionId} (buyer: ${buyerId})`
    : `Cash local sale for transaction ${localTransactionId} (buyer: external)`;

  const row = {
    type: 'LOCAL_CASH_SALE_REVENUE' as const,
    status: 'POSTED' as const,
    amountCents,
    userId: sellerId,
    reasonCode: rKey,
    idempotencyKey: `local_cash:${localTransactionId}:revenue`,
    memo: memoText,
    postedAt: now,
    createdAt: now,
    // No orderId — cash sales do not create a Twicely order row
    ...(listingId !== null ? { listingId } : {}),
  };

  const [inserted] = await db
    .insert(ledgerEntry)
    .values(row)
    .returning({ id: ledgerEntry.id });

  if (!inserted) {
    throw new Error(
      `[local-cash-sale] DB insert returned no row for transaction ${localTransactionId}`,
    );
  }

  logger.info('[local-cash-sale] Posted LOCAL_CASH_SALE_REVENUE entry', {
    localTransactionId,
    sellerId,
    amountCents,
    ledgerEntryId: inserted.id,
  });

  return { ledgerEntryId: inserted.id };
}
