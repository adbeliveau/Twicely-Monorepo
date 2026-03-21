/**
 * Pseudonymization Utility — G8.1
 *
 * Generates one-way pseudonyms for GDPR right-to-erasure execution.
 * Per Feature Lock-in section 37 and Decision #110.
 *
 * Rules:
 * - Pseudonym format: deleted_user_[SHA256(userId + salt)] where salt is a
 *   random 32-byte value generated fresh per deletion. Salt is NOT stored.
 * - One-way: no reverse mapping is stored or derivable.
 * - Financial records (order, ledger_entry, payout) are pseudonymized,
 *   never hard-deleted. They are retained 7 years per Decision #110.
 */

import { createHash, randomBytes } from 'crypto';
import { db } from '@twicely/db';
import {
  order,
  payout,
  message,
  affiliate,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';

/**
 * Generate a pseudonym for a given userId.
 * Salt is ephemeral — generated fresh and NEVER stored.
 * Format: deleted_user_[64 hex chars (SHA256)]
 */
export function generatePseudonym(userId: string): string {
  const salt = randomBytes(32).toString('hex');
  const hash = createHash('sha256')
    .update(userId + salt)
    .digest('hex');
  return `deleted_user_${hash}`;
}

/**
 * Pseudonymize order records where userId appears as buyer or seller.
 * Financial records are NEVER deleted per Decision #110.
 */
export async function pseudonymizeOrders(
  userId: string,
  pseudonym: string
): Promise<number> {
  const result = await db
    .update(order)
    .set({ buyerId: pseudonym })
    .where(eq(order.buyerId, userId));

  const sellerResult = await db
    .update(order)
    .set({ sellerId: pseudonym })
    .where(eq(order.sellerId, userId));

  const count =
    (result.count ?? 0) + (sellerResult.count ?? 0);
  logger.info('[pseudonymize] orders pseudonymized', { userId, count });
  return count;
}

/**
 * Pseudonymize ledger entries.
 * Ledger immutability is overridden here per GDPR legal carve-out.
 * The actor reference (userId FK) is the only field mutated.
 */
export async function pseudonymizeLedgerEntries(
  userId: string,
  pseudonym: string
): Promise<number> {
  // Use raw SQL to bypass any application-level immutability guards
  const result = await db.execute(
    sql`UPDATE ledger_entry SET user_id = ${pseudonym} WHERE user_id = ${userId}`
  );
  const count = result.count ?? 0;
  logger.info('[pseudonymize] ledger entries pseudonymized', { userId, count });
  return count;
}

/**
 * Pseudonymize payout records.
 */
export async function pseudonymizePayouts(
  userId: string,
  pseudonym: string
): Promise<number> {
  const result = await db
    .update(payout)
    .set({ userId: pseudonym })
    .where(eq(payout.userId, userId));
  const count = result.count ?? 0;
  logger.info('[pseudonymize] payouts pseudonymized', { userId, count });
  return count;
}

/**
 * Pseudonymize message sender references.
 */
export async function pseudonymizeMessages(
  userId: string,
  pseudonym: string
): Promise<number> {
  const result = await db
    .update(message)
    .set({ senderUserId: pseudonym })
    .where(eq(message.senderUserId, userId));
  const count = result.count ?? 0;
  logger.info('[pseudonymize] messages pseudonymized', { userId, count });
  return count;
}

/**
 * Pseudonymize audit event actor references.
 * Audit events have INSERT-only application constraint; this is the
 * system-level GDPR exception path.
 */
export async function pseudonymizeAuditEvents(
  userId: string,
  pseudonym: string
): Promise<number> {
  const result = await db.execute(
    sql`UPDATE audit_event SET actor_id = ${pseudonym} WHERE actor_id = ${userId}`
  );
  const count = result.count ?? 0;
  logger.info('[pseudonymize] audit events pseudonymized', { userId, count });
  return count;
}

/**
 * Pseudonymize affiliate-related records if the user was an affiliate.
 * Commissions and payouts reference affiliateId (not userId directly),
 * so we update the affiliate record's userId reference.
 */
export async function pseudonymizeAffiliateRecords(
  userId: string,
  pseudonym: string
): Promise<number> {
  // affiliate.userId is the FK — set it to pseudonym
  const result = await db
    .update(affiliate)
    .set({ userId: pseudonym })
    .where(eq(affiliate.userId, userId));
  const count = result.count ?? 0;
  logger.info('[pseudonymize] affiliate records pseudonymized', { userId, count });
  return count;
}
