import { describe, it, expect } from "vitest";
import { checkStripeVsLedger } from "../checks/stripe-vs-ledger";
import type { StripeEventRecord, LedgerEntryRecord, StripeEventLogRecord } from "../types";

function makeStripeEvent(overrides: Partial<StripeEventRecord> = {}): StripeEventRecord {
  return {
    id: "evt_001",
    type: "charge.succeeded",
    amountCents: 5000,
    occurredAt: new Date("2026-01-15T10:00:00Z"),
    objectId: "ch_001",
    ...overrides,
  };
}

function makeLedgerEntry(overrides: Partial<LedgerEntryRecord> = {}): LedgerEntryRecord {
  return {
    id: "le_001",
    type: "ORDER_PAYMENT_CAPTURED",
    amountCents: 5000,
    stripeEventId: "evt_001",
    orderId: "order_001",
    userId: "user_001",
    createdAt: new Date("2026-01-15T10:00:00Z"),
    ...overrides,
  };
}

function makeEventLog(overrides: Partial<StripeEventLogRecord> = {}): StripeEventLogRecord {
  return {
    id: "sel_001",
    stripeEventId: "evt_001",
    eventType: "charge.succeeded",
    processingStatus: "processed",
    createdAt: new Date("2026-01-15T10:00:00Z"),
    ...overrides,
  };
}

describe("checkStripeVsLedger", () => {
  it("returns 0 variances when data matches perfectly", () => {
    const result = checkStripeVsLedger({
      stripeEvents: [makeStripeEvent()],
      ledgerEntries: [makeLedgerEntry()],
      stripeEventLogs: [makeEventLog()],
    });
    expect(result.passed).toBe(true);
    expect(result.variancesFound).toHaveLength(0);
    expect(result.matchedCount).toBe(1);
  });

  it("detects UNMATCHED_STRIPE_EVENT when ledger entry is missing", () => {
    const result = checkStripeVsLedger({
      stripeEvents: [makeStripeEvent()],
      ledgerEntries: [],
      stripeEventLogs: [makeEventLog()],
    });
    expect(result.passed).toBe(false);
    expect(result.variancesFound).toHaveLength(1);
    expect(result.variancesFound[0].type).toBe("UNMATCHED_STRIPE_EVENT");
    expect(result.variancesFound[0].varianceAmountCents).toBe(5000);
  });

  it("detects ORPHANED_LEDGER_ENTRY when stripe event is missing", () => {
    const result = checkStripeVsLedger({
      stripeEvents: [],
      ledgerEntries: [makeLedgerEntry()],
      stripeEventLogs: [],
    });
    expect(result.passed).toBe(false);
    expect(result.variancesFound).toHaveLength(1);
    expect(result.variancesFound[0].type).toBe("ORPHANED_LEDGER_ENTRY");
    expect(result.variancesFound[0].ledgerEntryId).toBe("le_001");
  });

  it("detects AMOUNT_MISMATCH when amounts differ", () => {
    const result = checkStripeVsLedger({
      stripeEvents: [makeStripeEvent({ amountCents: 5000 })],
      ledgerEntries: [makeLedgerEntry({ amountCents: 4900 })],
      stripeEventLogs: [makeEventLog()],
    });
    expect(result.passed).toBe(false);
    expect(result.variancesFound).toHaveLength(1);
    expect(result.variancesFound[0].type).toBe("AMOUNT_MISMATCH");
    expect(result.variancesFound[0].varianceAmountCents).toBe(100);
  });

  it("detects DUPLICATE_STRIPE_EVENT", () => {
    const result = checkStripeVsLedger({
      stripeEvents: [makeStripeEvent()],
      ledgerEntries: [makeLedgerEntry()],
      stripeEventLogs: [
        makeEventLog({ id: "sel_001" }),
        makeEventLog({ id: "sel_002" }),
      ],
    });
    // Matched correctly + duplicate detected
    const duplicates = result.variancesFound.filter((v) => v.type === "DUPLICATE_STRIPE_EVENT");
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].stripeEventId).toBe("evt_001");
  });

  it("handles multiple stripe events and ledger entries", () => {
    const result = checkStripeVsLedger({
      stripeEvents: [
        makeStripeEvent({ id: "evt_001", amountCents: 5000 }),
        makeStripeEvent({ id: "evt_002", amountCents: 3000 }),
      ],
      ledgerEntries: [
        makeLedgerEntry({ id: "le_001", stripeEventId: "evt_001", amountCents: 5000 }),
        makeLedgerEntry({ id: "le_002", stripeEventId: "evt_002", amountCents: 3000 }),
      ],
      stripeEventLogs: [
        makeEventLog({ id: "sel_001", stripeEventId: "evt_001" }),
        makeEventLog({ id: "sel_002", stripeEventId: "evt_002" }),
      ],
    });
    expect(result.passed).toBe(true);
    expect(result.matchedCount).toBe(2);
  });

  it("calculates correct totals", () => {
    const result = checkStripeVsLedger({
      stripeEvents: [makeStripeEvent({ amountCents: 5000 })],
      ledgerEntries: [makeLedgerEntry({ amountCents: 5000 })],
      stripeEventLogs: [makeEventLog()],
    });
    expect(result.stripeTotalCents).toBe(5000);
    expect(result.ledgerTotalCents).toBe(5000);
    expect(result.checkedCount).toBe(2);
  });
});
