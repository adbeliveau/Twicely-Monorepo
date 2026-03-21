import { db } from '@twicely/db';
import { affiliate, affiliateCommission } from '@twicely/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';

/**
 * Reverses a commission by invoiceId (for refund/chargeback scenarios).
 *
 * Only reverses commissions with status PENDING or PAYABLE.
 * PAID commissions are never clawed back per §2.3 ("No clawback on already-paid commissions").
 * REVERSED commissions are skipped (idempotent — not matched by the WHERE clause).
 *
 * Updates the affiliate's balance column corresponding to the commission's prior status:
 *   - was PENDING → decrement pendingBalanceCents
 *   - was PAYABLE → decrement availableBalanceCents
 */
export async function reverseAffiliateCommission(
  invoiceId: string,
  reason: string
): Promise<void> {
  const commissions = await db
    .select({
      id: affiliateCommission.id,
      affiliateId: affiliateCommission.affiliateId,
      status: affiliateCommission.status,
      commissionCents: affiliateCommission.commissionCents,
    })
    .from(affiliateCommission)
    .where(
      and(
        eq(affiliateCommission.invoiceId, invoiceId),
        inArray(affiliateCommission.status, ['PENDING', 'PAYABLE'])
      )
    );

  if (commissions.length === 0) {
    logger.info('[reverseAffiliateCommission] No reversible commission found', { invoiceId });
    return;
  }

  const now = new Date();

  for (const commission of commissions) {
    await db.transaction(async (tx) => {
      await tx
        .update(affiliateCommission)
        .set({
          status: 'REVERSED',
          reversedAt: now,
          reversalReason: reason,
        })
        .where(eq(affiliateCommission.id, commission.id));

      if (commission.status === 'PENDING') {
        await tx
          .update(affiliate)
          .set({
            pendingBalanceCents: sql`${affiliate.pendingBalanceCents} - ${commission.commissionCents}`,
            updatedAt: now,
          })
          .where(eq(affiliate.id, commission.affiliateId));
      } else {
        // status was 'PAYABLE'
        await tx
          .update(affiliate)
          .set({
            availableBalanceCents: sql`${affiliate.availableBalanceCents} - ${commission.commissionCents}`,
            updatedAt: now,
          })
          .where(eq(affiliate.id, commission.affiliateId));
      }
    });

    logger.info('[reverseAffiliateCommission] Commission reversed', {
      commissionId: commission.id,
      affiliateId: commission.affiliateId,
      invoiceId,
      priorStatus: commission.status,
      commissionCents: commission.commissionCents,
    });
  }
}
