/**
 * Payout vs. Calculated Reconciliation Check
 *
 * Verifies payout amounts match calculated seller earnings:
 * sale revenue - transaction fees - processing fees + adjustments.
 * Canonical 31 Section 6.1.
 */

import type { Variance, ReconCheckResult } from '../types';

export interface PayoutRecord {
  id: string;
  userId: string;
  amountCents: number;
  status: string;
  stripeTransferId: string | null;
}

export interface SellerLedgerSummary {
  userId: string;
  totalSalesCents: number;
  totalFeesCents: number;
  totalRefundsCents: number;
  totalPayoutsCents: number;
  totalAdjustmentsCents: number;
}

/**
 * For each completed payout, verify the amount matches the seller's
 * calculated net earnings from ledger entries.
 */
export function checkPayoutVsCalculated(input: {
  payouts: PayoutRecord[];
  sellerSummaries: SellerLedgerSummary[];
}): ReconCheckResult {
  const variances: Variance[] = [];
  let matchedCount = 0;

  const summaryByUser = new Map<string, SellerLedgerSummary>();
  for (const summary of input.sellerSummaries) {
    summaryByUser.set(summary.userId, summary);
  }

  // Group payouts by user
  const payoutsByUser = new Map<string, PayoutRecord[]>();
  for (const payout of input.payouts) {
    if (payout.status !== 'COMPLETED') continue;
    const existing = payoutsByUser.get(payout.userId) ?? [];
    existing.push(payout);
    payoutsByUser.set(payout.userId, existing);
  }

  for (const [userId, userPayouts] of payoutsByUser) {
    const summary = summaryByUser.get(userId);
    if (!summary) {
      // Payouts exist for user with no ledger summary
      for (const payout of userPayouts) {
        variances.push({
          type: 'ORPHANED_LEDGER_ENTRY',
          userId,
          stripeAmountCents: payout.amountCents,
          varianceAmountCents: Math.abs(payout.amountCents),
        });
      }
      continue;
    }

    const totalPaidCents = userPayouts.reduce((s, p) => s + p.amountCents, 0);
    const expectedPayoutCents = summary.totalSalesCents
      - summary.totalFeesCents
      - summary.totalRefundsCents
      + summary.totalAdjustmentsCents;

    const diff = Math.abs(totalPaidCents) - Math.abs(expectedPayoutCents);
    if (Math.abs(diff) > 0) {
      variances.push({
        type: 'AMOUNT_MISMATCH',
        userId,
        stripeAmountCents: totalPaidCents,
        ledgerAmountCents: expectedPayoutCents,
        varianceAmountCents: Math.abs(diff),
      });
    } else {
      matchedCount++;
    }
  }

  const stripeTotalCents = input.payouts
    .filter((p) => p.status === 'COMPLETED')
    .reduce((s, p) => s + Math.abs(p.amountCents), 0);
  const ledgerTotalCents = input.sellerSummaries.reduce(
    (s, su) => s + Math.abs(su.totalSalesCents - su.totalFeesCents - su.totalRefundsCents + su.totalAdjustmentsCents),
    0,
  );

  return {
    checkName: 'payout-vs-calculated',
    passed: variances.length === 0,
    variancesFound: variances,
    stripeTotalCents,
    ledgerTotalCents,
    matchedCount,
    checkedCount: input.payouts.length,
  };
}
