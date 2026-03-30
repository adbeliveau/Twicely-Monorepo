/**
 * Post informational ledger entries for off-platform sales detected by the crosslister.
 *
 * Source: F5-S2 install prompt §1.2; Finance Engine §5 (posting rules);
 * Decision #31: NO Twicely fees on off-platform sales — entries are INFORMATIONAL ONLY.
 *
 * Two entries are created per sale:
 *   CROSSLISTER_SALE_REVENUE  (+salePriceCents)  — seller received money on external platform
 *   CROSSLISTER_PLATFORM_FEE  (-platformFeeCents) — external platform took a cut
 *
 * Neither entry updates sellerBalance. They exist for cross-platform P&L and tax reporting.
 * Idempotency: reasonCode stores the correlation key; duplicate keys are skipped.
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { ledgerEntry } from '@twicely/db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import type { ExternalChannel } from '@twicely/db/channel-types';

// Correlation key format for revenue entry
function revenueKey(externalOrderId: string): string {
  return `xsale:${externalOrderId}:revenue`;
}

// Correlation key format for fee entry
function feeKey(externalOrderId: string): string {
  return `xsale:${externalOrderId}:fee`;
}

export interface PostOffPlatformSaleParams {
  userId: string;
  listingId: string;
  channel: ExternalChannel;
  externalOrderId: string;
  salePriceCents: number;
  platformFeeCents: number;
  soldAt: Date;
}

/**
 * Post CROSSLISTER_SALE_REVENUE and CROSSLISTER_PLATFORM_FEE ledger entries.
 * Idempotent — safe to call multiple times with the same externalOrderId.
 * Does NOT update sellerBalance (entries are informational only).
 */
export async function postOffPlatformSale(params: PostOffPlatformSaleParams): Promise<void> {
  const {
    userId,
    listingId,
    channel,
    externalOrderId,
    salePriceCents,
    platformFeeCents,
    soldAt,
  } = params;

  const rKey = revenueKey(externalOrderId);
  const fKey = feeKey(externalOrderId);

  // Idempotency check: if revenue entry already exists, both entries were already posted
  const [existing] = await db
    .select({ id: ledgerEntry.id })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, userId),
        eq(ledgerEntry.reasonCode, rKey),
      ),
    )
    .limit(1);

  if (existing) {
    logger.info('[postOffPlatformSale] Entries already posted — idempotent skip', {
      externalOrderId,
      userId,
    });
    return;
  }

  const now = new Date();

  // Post both entries in a single transaction
  await db.transaction(async (tx) => {
    // 1. CROSSLISTER_SALE_REVENUE — positive (informational: seller received money externally)
    await tx.insert(ledgerEntry).values({
      type: 'CROSSLISTER_SALE_REVENUE',
      status: 'POSTED',
      amountCents: salePriceCents,
      userId,
      listingId,
      channel,
      reasonCode: rKey,
      memo: `Off-platform sale on ${channel}: order ${externalOrderId}`,
      postedAt: soldAt,
      createdAt: now,
    });

    // 2. CROSSLISTER_PLATFORM_FEE — negative (informational: platform took a cut)
    await tx.insert(ledgerEntry).values({
      type: 'CROSSLISTER_PLATFORM_FEE',
      status: 'POSTED',
      amountCents: -platformFeeCents,
      userId,
      listingId,
      channel,
      reasonCode: fKey,
      memo: `${channel} platform fee for order ${externalOrderId}`,
      postedAt: soldAt,
      createdAt: now,
    });
  });

  logger.info('[postOffPlatformSale] Posted off-platform sale entries', {
    userId,
    channel,
    externalOrderId,
    salePriceCents,
    platformFeeCents,
  });
}
