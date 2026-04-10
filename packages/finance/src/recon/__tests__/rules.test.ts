import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyVarianceSeverity, shouldAutoResolve } from "../rules";
import type { Variance } from "../types";

vi.mock("@twicely/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "rule_001" }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "rule_001" }]),
        }),
      }),
    }),
  },
}));

vi.mock("@twicely/db/schema", () => ({
  reconRule: { id: "id", name: "name", varianceType: "varianceType", autoResolveBelow: "autoResolveBelow" },
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn().mockReturnValue("mock-cuid"),
}));

describe("classifyVarianceSeverity", () => {
  function makeVariance(overrides: Partial<Variance> = {}): Variance {
    return {
      type: "AMOUNT_MISMATCH",
      varianceAmountCents: 50,
      ...overrides,
    };
  }

  it("classifies TIMING_DIFFERENCE as LOW regardless of amount", () => {
    expect(classifyVarianceSeverity(
      makeVariance({ type: "TIMING_DIFFERENCE", varianceAmountCents: 999999 }),
    )).toBe("LOW");
  });

  it("classifies AMOUNT_MISMATCH < $1 as LOW", () => {
    expect(classifyVarianceSeverity(
      makeVariance({ type: "AMOUNT_MISMATCH", varianceAmountCents: 50 }),
    )).toBe("LOW");
  });

  it("classifies AMOUNT_MISMATCH $1-$100 as MEDIUM", () => {
    expect(classifyVarianceSeverity(
      makeVariance({ type: "AMOUNT_MISMATCH", varianceAmountCents: 500 }),
    )).toBe("MEDIUM");
  });

  it("classifies ORPHANED_LEDGER_ENTRY as CRITICAL", () => {
    expect(classifyVarianceSeverity(
      makeVariance({ type: "ORPHANED_LEDGER_ENTRY", varianceAmountCents: 10 }),
    )).toBe("CRITICAL");
  });

  it("classifies DUPLICATE_STRIPE_EVENT as HIGH", () => {
    expect(classifyVarianceSeverity(
      makeVariance({ type: "DUPLICATE_STRIPE_EVENT", varianceAmountCents: 0 }),
    )).toBe("HIGH");
  });

  it("classifies >= $100 variance as HIGH", () => {
    expect(classifyVarianceSeverity(
      makeVariance({ type: "UNMATCHED_STRIPE_EVENT", varianceAmountCents: 15000 }),
    )).toBe("HIGH");
  });

  it("classifies UNMATCHED_STRIPE_EVENT < $100 as MEDIUM", () => {
    expect(classifyVarianceSeverity(
      makeVariance({ type: "UNMATCHED_STRIPE_EVENT", varianceAmountCents: 5000 }),
    )).toBe("MEDIUM");
  });
});

describe("shouldAutoResolve", () => {
  it("auto-resolves TIMING_DIFFERENCE", () => {
    expect(shouldAutoResolve(
      { type: "TIMING_DIFFERENCE", varianceAmountCents: 999999 },
      100,
    )).toBe(true);
  });

  it("auto-resolves AMOUNT_MISMATCH below threshold", () => {
    expect(shouldAutoResolve(
      { type: "AMOUNT_MISMATCH", varianceAmountCents: 50 },
      100,
    )).toBe(true);
  });

  it("does not auto-resolve AMOUNT_MISMATCH at or above threshold", () => {
    expect(shouldAutoResolve(
      { type: "AMOUNT_MISMATCH", varianceAmountCents: 100 },
      100,
    )).toBe(false);
  });

  it("does not auto-resolve UNMATCHED_STRIPE_EVENT", () => {
    expect(shouldAutoResolve(
      { type: "UNMATCHED_STRIPE_EVENT", varianceAmountCents: 10 },
      100,
    )).toBe(false);
  });

  it("does not auto-resolve ORPHANED_LEDGER_ENTRY", () => {
    expect(shouldAutoResolve(
      { type: "ORPHANED_LEDGER_ENTRY", varianceAmountCents: 10 },
      100,
    )).toBe(false);
  });

  it("does not auto-resolve DUPLICATE_STRIPE_EVENT", () => {
    expect(shouldAutoResolve(
      { type: "DUPLICATE_STRIPE_EVENT", varianceAmountCents: 0 },
      100,
    )).toBe(false);
  });
});

describe("rule CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getReconRules returns rules from db", async () => {
    const { getReconRules } = await import("../rules");
    const rules = await getReconRules();
    expect(rules).toEqual([]);
  });

  it("upsertReconRule inserts new rule", async () => {
    const { upsertReconRule } = await import("../rules");
    const rule = await upsertReconRule({
      name: "Test Rule",
      varianceType: "AMOUNT_MISMATCH",
      thresholdCents: 500,
      autoResolveBelow: 100,
    });
    expect(rule).toBeTruthy();
  });

  it("upsertReconRule updates existing rule", async () => {
    const { upsertReconRule } = await import("../rules");
    const rule = await upsertReconRule({
      id: "rule_001",
      name: "Updated Rule",
      varianceType: "AMOUNT_MISMATCH",
      thresholdCents: 1000,
      autoResolveBelow: 200,
    });
    expect(rule).toBeTruthy();
  });

  it("getAutoResolveThreshold returns 0 when no rule found", async () => {
    const { getAutoResolveThreshold } = await import("../rules");
    const threshold = await getAutoResolveThreshold("AMOUNT_MISMATCH");
    expect(threshold).toBe(0);
  });
});
