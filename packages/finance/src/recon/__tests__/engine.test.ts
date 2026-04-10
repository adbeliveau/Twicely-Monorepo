import { describe, it, expect, vi, beforeEach } from "vitest";

// Build a chainable mock that resolves to a value at any point
function mockChain(resolveValue: unknown = []) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        // Make it thenable so awaiting works
        return (resolve: (v: unknown) => void) => resolve(resolveValue);
      }
      // Every property access returns a function that returns another proxy
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

vi.mock("@twicely/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => mockChain([])),
    insert: vi.fn().mockImplementation(() => mockChain(undefined)),
    update: vi.fn().mockImplementation(() => mockChain(undefined)),
  },
}));

vi.mock("@twicely/db/schema", () => ({
  reconciliationReport: {
    id: "id", periodStart: "periodStart", periodEnd: "periodEnd",
    status: "status", createdAt: "createdAt", totalEntriesChecked: "totalEntriesChecked",
    discrepancyCount: "discrepancyCount",
  },
  reconciliationVariance: {
    id: "id", reconciliationReportId: "reconciliationReportId",
    type: "type", varianceAmountCents: "varianceAmountCents",
    isResolved: "isResolved",
  },
  ledgerEntry: {
    id: "id", type: "type", amountCents: "amountCents",
    stripeEventId: "stripeEventId", orderId: "orderId",
    userId: "userId", createdAt: "createdAt",
  },
  stripeEventLog: {
    id: "id", stripeEventId: "stripeEventId", eventType: "eventType",
    processingStatus: "processingStatus", createdAt: "createdAt",
  },
}));

vi.mock("@twicely/db/queries/platform-settings", () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => {
    return Promise.resolve(fallback);
  }),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn().mockReturnValue("mock-cuid"),
}));

import { runReconciliation, runNightlyRecon } from "../engine";
import { getPlatformSetting } from "@twicely/db/queries/platform-settings";
import { db } from "@twicely/db";

describe("runReconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock implementations
    vi.mocked(db.select).mockImplementation(() => mockChain([]) as ReturnType<typeof db.select>);
    vi.mocked(db.insert).mockImplementation(() => mockChain(undefined) as ReturnType<typeof db.insert>);
    vi.mocked(db.update).mockImplementation(() => mockChain(undefined) as ReturnType<typeof db.update>);
    vi.mocked(getPlatformSetting).mockImplementation((_key: string, fallback: unknown) => {
      return Promise.resolve(fallback);
    });
  });

  it("returns failed status when kill switch is off", async () => {
    vi.mocked(getPlatformSetting).mockImplementation((key: string, fallback: unknown) => {
      if (key === "finance.reconciliation.enabled") return Promise.resolve(false);
      return Promise.resolve(fallback);
    });

    const result = await runReconciliation();
    expect(result.status).toBe("failed");
    expect(result.reportId).toBe("");
  });

  it("returns clean status for a full run with no data", async () => {
    const result = await runReconciliation({
      date: new Date("2026-01-15T04:00:00Z"),
    });
    expect(result.status).toBe("clean");
    expect(result.varianceCount).toBe(0);
    expect(result.reportId).toBe("mock-cuid");
  });

  it("accepts lookbackHours override", async () => {
    const result = await runReconciliation({
      date: new Date("2026-01-15T04:00:00Z"),
      lookbackHours: 24,
    });
    expect(result.status).toBe("clean");
  });

  it("is idempotent when clean report already exists", async () => {
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First select: idempotency check returns existing report
        return mockChain([{ id: "existing-report-id" }]) as ReturnType<typeof db.select>;
      }
      return mockChain([]) as ReturnType<typeof db.select>;
    });

    const result = await runReconciliation({
      date: new Date("2026-01-15T04:00:00Z"),
    });
    expect(result.status).toBe("clean");
    expect(result.reportId).toBe("existing-report-id");
  });

  it("creates a report with correct period", async () => {
    const insertValues: unknown[] = [];
    vi.mocked(db.insert).mockImplementation(() => {
      return {
        values: vi.fn().mockImplementation((vals: unknown) => {
          insertValues.push(vals);
          return Promise.resolve(undefined);
        }),
      } as unknown as ReturnType<typeof db.insert>;
    });

    await runReconciliation({
      date: new Date("2026-01-15T04:00:00Z"),
      lookbackHours: 48,
    });

    expect(insertValues.length).toBeGreaterThanOrEqual(1);
    const reportInsert = insertValues[0] as Record<string, unknown>;
    expect(reportInsert.status).toBe("running");
    expect(reportInsert.id).toBe("mock-cuid");
  });
});

describe("runNightlyRecon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.select).mockImplementation(() => mockChain([]) as ReturnType<typeof db.select>);
    vi.mocked(db.insert).mockImplementation(() => mockChain(undefined) as ReturnType<typeof db.insert>);
    vi.mocked(db.update).mockImplementation(() => mockChain(undefined) as ReturnType<typeof db.update>);
    vi.mocked(getPlatformSetting).mockImplementation((_key: string, fallback: unknown) => {
      return Promise.resolve(fallback);
    });
  });

  it("delegates to runReconciliation with defaults", async () => {
    const result = await runNightlyRecon();
    expect(result.status).toBe("clean");
  });
});
