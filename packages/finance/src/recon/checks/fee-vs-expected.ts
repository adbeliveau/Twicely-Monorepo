/**
 * Fee vs. Expected Reconciliation Check
 *
 * Verifies transaction fees collected match expected TF based on
 * bracket rates and GMV. Integer cents throughout.
 */

import type { Variance, ReconCheckResult } from '../types';

export interface OrderFeeRecord {
  orderId: string;
  orderTotalCents: number;
  tfFeeCents: number;
  expectedTfBps: number;
}

/**
 * For each order with a TF, verify the fee matches the expected
 * bracket-based calculation.
 */
export function checkFeeVsExpected(input: {
  orderFees: OrderFeeRecord[];
}): ReconCheckResult {
  const variances: Variance[] = [];
  let matchedCount = 0;

  for (const record of input.orderFees) {
    // Expected TF = orderTotal * (bps / 10000), rounded to nearest cent
    const expectedFeeCents = Math.round(
      (record.orderTotalCents * record.expectedTfBps) / 10000,
    );

    const diff = Math.abs(record.tfFeeCents) - Math.abs(expectedFeeCents);

    if (Math.abs(diff) > 0) {
      variances.push({
        type: 'AMOUNT_MISMATCH',
        orderId: record.orderId,
        stripeAmountCents: record.tfFeeCents,
        ledgerAmountCents: expectedFeeCents,
        varianceAmountCents: Math.abs(diff),
      });
    } else {
      matchedCount++;
    }
  }

  const stripeTotalCents = input.orderFees.reduce((s, r) => s + Math.abs(r.tfFeeCents), 0);
  const ledgerTotalCents = input.orderFees.reduce((s, r) => {
    const expected = Math.round((r.orderTotalCents * r.expectedTfBps) / 10000);
    return s + Math.abs(expected);
  }, 0);

  return {
    checkName: 'fee-vs-expected',
    passed: variances.length === 0,
    variancesFound: variances,
    stripeTotalCents,
    ledgerTotalCents,
    matchedCount,
    checkedCount: input.orderFees.length,
  };
}
