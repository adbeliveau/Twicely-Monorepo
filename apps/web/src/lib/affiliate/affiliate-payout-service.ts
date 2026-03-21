import { db } from '@twicely/db';
import { affiliate, affiliateCommission, affiliatePayout, ledgerEntry } from '@twicely/db/schema';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { notify } from '@twicely/notifications/service';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { stripe } from '@twicely/stripe/server';
import { createId } from '@paralleldrive/cuid2';

export interface AffiliatePayoutsResult {
  payoutCount: number;
  totalPaidCents: number;
  failedCount: number;
}

function getPrevMonthPeriod(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  return { periodStart, periodEnd };
}

/**
 * Executes monthly payouts for all eligible affiliates.
 *
 * Eligibility (ALL must be true):
 *   - affiliate.status = 'ACTIVE'
 *   - affiliate.availableBalanceCents >= minPayoutCents
 *   - affiliate.payoutMethod is not null
 *   - affiliate.taxInfoProvided = true
 *   - For stripe_connect: affiliate.stripeConnectAccountId is not null
 *
 * On success: creates affiliatePayout COMPLETED, marks commissions PAID,
 * zeroes availableBalanceCents, increments totalPaidCents, inserts ledgerEntry.
 *
 * On failure: marks affiliatePayout FAILED, leaves balance and commissions unchanged.
 * Continues to next affiliate on any individual failure.
 */
export async function executeAffiliatePayouts(): Promise<AffiliatePayoutsResult> {
  const minPayoutCents = await getPlatformSetting<number>('affiliate.minPayoutCents', 2500);
  const { periodStart, periodEnd } = getPrevMonthPeriod();

  const eligibleAffiliates = await db
    .select()
    .from(affiliate)
    .where(
      and(
        eq(affiliate.status, 'ACTIVE'),
        gte(affiliate.availableBalanceCents, minPayoutCents),
        isNotNull(affiliate.payoutMethod),
        eq(affiliate.taxInfoProvided, true)
      )
    );

  let payoutCount = 0;
  let totalPaidCents = 0;
  let failedCount = 0;

  for (const aff of eligibleAffiliates) {
    if (aff.payoutMethod === 'paypal') {
      logger.warn('[executeAffiliatePayouts] PayPal payouts not implemented — skipping affiliate', {
        affiliateId: aff.id,
      });
      continue;
    }

    if (aff.payoutMethod !== 'stripe_connect') {
      logger.warn('[executeAffiliatePayouts] Unknown payout method — skipping affiliate', {
        affiliateId: aff.id,
        payoutMethod: aff.payoutMethod,
      });
      continue;
    }

    if (!aff.stripeConnectAccountId) {
      logger.warn('[executeAffiliatePayouts] No Stripe Connect account — skipping affiliate', {
        affiliateId: aff.id,
      });
      continue;
    }

    try {
      // Row-level lock: re-fetch with FOR UPDATE to prevent double-payout
      const result = await db.transaction(async (tx) => {
        const [lockedAff] = await tx
          .select()
          .from(affiliate)
          .where(eq(affiliate.id, aff.id))
          .for('update')
          .limit(1);

        if (!lockedAff || lockedAff.availableBalanceCents < minPayoutCents) {
          return null; // Balance changed or below minimum
        }

        if (!lockedAff.stripeConnectAccountId) {
          return null;
        }

        const payoutAmountCents = lockedAff.availableBalanceCents;

        // Idempotency: check no PROCESSING payout exists for this period
        const [existingPayout] = await tx
          .select({ id: affiliatePayout.id })
          .from(affiliatePayout)
          .where(
            and(
              eq(affiliatePayout.affiliateId, aff.id),
              eq(affiliatePayout.status, 'PROCESSING'),
              eq(affiliatePayout.periodStart, periodStart),
            ),
          )
          .limit(1);

        if (existingPayout) {
          return null; // Already processing
        }

        // Fetch PAYABLE commissions
        const payableCommissions = await tx
          .select({ id: affiliateCommission.id })
          .from(affiliateCommission)
          .where(
            and(
              eq(affiliateCommission.affiliateId, aff.id),
              eq(affiliateCommission.status, 'PAYABLE'),
            ),
          );

        const commissionIds = payableCommissions.map((c) => c.id);

        // Create payout record (PROCESSING)
        const payoutId = createId();
        await tx.insert(affiliatePayout).values({
          id: payoutId,
          affiliateId: aff.id,
          amountCents: payoutAmountCents,
          method: 'stripe_connect',
          status: 'PROCESSING',
          periodStart,
          periodEnd,
        });

        // Stripe transfer (inside tx so rollback cleans up on DB error)
        const transfer = await stripe.transfers.create({
          amount: payoutAmountCents,
          currency: 'usd',
          destination: lockedAff.stripeConnectAccountId,
          metadata: { affiliateId: aff.id, payoutId },
        });

        const now = new Date();

        // Mark payout COMPLETED
        await tx
          .update(affiliatePayout)
          .set({ status: 'COMPLETED', externalPayoutId: transfer.id, completedAt: now })
          .where(eq(affiliatePayout.id, payoutId));

        // Mark commissions PAID
        if (commissionIds.length > 0) {
          await tx
            .update(affiliateCommission)
            .set({ status: 'PAID', paidAt: now })
            .where(
              and(
                eq(affiliateCommission.affiliateId, aff.id),
                eq(affiliateCommission.status, 'PAYABLE'),
              ),
            );
        }

        // Zero out available balance, increment totalPaidCents
        await tx
          .update(affiliate)
          .set({
            availableBalanceCents: 0,
            totalPaidCents: sql`${affiliate.totalPaidCents} + ${payoutAmountCents}`,
            updatedAt: now,
          })
          .where(eq(affiliate.id, aff.id));

        // Insert ledger entry
        await tx.insert(ledgerEntry).values({
          type: 'AFFILIATE_COMMISSION_PAYOUT',
          status: 'POSTED',
          amountCents: -payoutAmountCents,
          currency: 'USD',
          userId: null,
          stripeTransferId: transfer.id,
          postedAt: now,
          memo: `Affiliate commission payout: ${aff.id}`,
          reasonCode: 'affiliate_monthly_payout',
        });

        return { payoutId, payoutAmountCents, transferId: transfer.id, commissionCount: commissionIds.length };
      });

      if (!result) {
        continue; // Skipped (balance changed, already processing, or missing account)
      }

      payoutCount++;
      totalPaidCents += result.payoutAmountCents;

      const amountFormatted = `$${(result.payoutAmountCents / 100).toFixed(2)}`;
      void notify(aff.userId, 'affiliate.payout_sent', {
        amountFormatted,
        payoutMethod: 'Stripe Connect',
      });

      logger.info('[executeAffiliatePayouts] Payout completed', {
        affiliateId: aff.id,
        payoutId: result.payoutId,
        amountCents: result.payoutAmountCents,
        transferId: result.transferId,
        commissionCount: result.commissionCount,
      });
    } catch (err) {
      const failedReason = err instanceof Error ? err.message : String(err);
      failedCount++;

      const amountFormatted = `$${(aff.availableBalanceCents / 100).toFixed(2)}`;
      void notify(aff.userId, 'affiliate.payout_failed', {
        amountFormatted,
        failedReason,
      });

      logger.error('[executeAffiliatePayouts] Payout failed for affiliate', {
        affiliateId: aff.id,
        error: failedReason,
      });
    }
  }

  logger.info('[executeAffiliatePayouts] Batch complete', {
    payoutCount,
    totalPaidCents,
    failedCount,
  });

  return { payoutCount, totalPaidCents, failedCount };
}
