import { describe, it, expect } from "vitest";
import { checkPayoutVsCalculated } from "../checks/payout-vs-calculated";
import type { PayoutRecord, SellerLedgerSummary } from "../checks/payout-vs-calculated";

function makePayout(overrides: Partial<PayoutRecord> = {}): PayoutRecord {
  return {
    id: "po_001",
    userId: "user_001",
    amountCents: 4000,
    status: "COMPLETED",
    stripeTransferId: "tr_001",
    ...overrides,
  };
}

function makeSummary(overrides: Partial<SellerLedgerSummary> = {}): SellerLedgerSummary {
  return {
    userId: "user_001",
    totalSalesCents: 5000,
    totalFeesCents: 500,
    totalRefundsCents: 0,
    totalPayoutsCents: 4000,
    totalAdjustmentsCents: -500,
    ...overrides,
  };
}

describe("checkPayoutVsCalculated", () => {
  it("returns 0 variances when payout matches calculated earnings", () => {
    // Expected = 5000 - 500 - 0 + (-500) = 4000
    const result = checkPayoutVsCalculated({
      payouts: [makePayout({ amountCents: 4000 })],
      sellerSummaries: [makeSummary()],
    });
    expect(result.passed).toBe(true);
    expect(result.variancesFound).toHaveLength(0);
    expect(result.matchedCount).toBe(1);
  });

  it("detects AMOUNT_MISMATCH when payout differs from calculated", () => {
    const result = checkPayoutVsCalculated({
      payouts: [makePayout({ amountCents: 3500 })],
      sellerSummaries: [makeSummary()],
    });
    expect(result.passed).toBe(false);
    expect(result.variancesFound).toHaveLength(1);
    expect(result.variancesFound[0].type).toBe("AMOUNT_MISMATCH");
    expect(result.variancesFound[0].varianceAmountCents).toBe(500);
  });

  it("flags orphan when payout has no seller summary", () => {
    const result = checkPayoutVsCalculated({
      payouts: [makePayout({ userId: "unknown_user" })],
      sellerSummaries: [],
    });
    expect(result.passed).toBe(false);
    expect(result.variancesFound).toHaveLength(1);
    expect(result.variancesFound[0].type).toBe("ORPHANED_LEDGER_ENTRY");
  });

  it("skips non-COMPLETED payouts", () => {
    const result = checkPayoutVsCalculated({
      payouts: [makePayout({ status: "PENDING" })],
      sellerSummaries: [makeSummary()],
    });
    expect(result.passed).toBe(true);
    expect(result.variancesFound).toHaveLength(0);
  });

  it("aggregates multiple payouts per user correctly", () => {
    // Two payouts totaling 4000 = expected
    const result = checkPayoutVsCalculated({
      payouts: [
        makePayout({ id: "po_001", amountCents: 2000 }),
        makePayout({ id: "po_002", amountCents: 2000 }),
      ],
      sellerSummaries: [makeSummary()],
    });
    expect(result.passed).toBe(true);
    expect(result.matchedCount).toBe(1);
  });
});
