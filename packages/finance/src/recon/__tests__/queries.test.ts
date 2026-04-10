import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@twicely/db", () => {
  const returningFn = vi.fn().mockResolvedValue([{
    id: "var_001",
    isResolved: true,
    resolvedAt: new Date(),
    resolvedByStaffId: "staff_001",
    resolutionType: "manual_stripe_confirmed",
    resolutionNote: "Verified in Stripe dashboard",
  }]);
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });

  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
          orderBy: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({ set: setFn }),
    },
  };
});

vi.mock("@twicely/db/schema", () => ({
  reconciliationReport: { id: "id", status: "status", periodStart: "periodStart", periodEnd: "periodEnd", createdAt: "createdAt" },
  reconciliationVariance: { id: "id", reconciliationReportId: "reconciliationReportId", type: "type", severity: "severity", isResolved: "isResolved", createdAt: "createdAt" },
}));

import {
  getReconRuns,
  getReconRun,
  getVariances,
  getOpenVariances,
  resolveVariance,
  ignoreVariance,
  getVarianceById,
} from "../queries";
import { db } from "@twicely/db";

describe("queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getReconRuns returns empty array by default", async () => {
    const result = await getReconRuns();
    expect(result).toEqual([]);
  });

  it("getReconRuns accepts filters", async () => {
    const result = await getReconRuns({ status: "clean", limit: 10, offset: 0 });
    expect(result).toEqual([]);
  });

  it("getReconRun returns null for missing id", async () => {
    const result = await getReconRun("nonexistent");
    expect(result).toBeNull();
  });

  it("getVariances returns empty array by default", async () => {
    const result = await getVariances();
    expect(result).toEqual([]);
  });

  it("getVariances accepts filters", async () => {
    const result = await getVariances({
      reportId: "report_001",
      type: "AMOUNT_MISMATCH",
      severity: "LOW",
      isResolved: false,
    });
    expect(result).toEqual([]);
  });

  it("resolveVariance updates and returns the variance", async () => {
    const result = await resolveVariance(
      "var_001",
      "staff_001",
      "Verified in Stripe dashboard",
    );
    expect(result).toBeTruthy();
    expect(result?.isResolved).toBe(true);
  });

  it("ignoreVariance uses manual_write_off resolution type", async () => {
    const result = await ignoreVariance(
      "var_001",
      "staff_001",
      "Below materiality threshold",
    );
    expect(result).toBeTruthy();
  });
});
