/**
 * Finance Reconciliation Queries
 * Drizzle queries for reconciliation runs, variances, and resolution.
 * Canonical 31 Section 9.2.
 */

import { db } from "@twicely/db";
import {
  reconciliationReport,
  reconciliationVariance,
} from "@twicely/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";

import type { ReconRunFilters, VarianceFilters } from "./types";

export async function getReconRuns(filters: ReconRunFilters = {}) {
  let query = db
    .select()
    .from(reconciliationReport)
    .orderBy(desc(reconciliationReport.createdAt))
    .$dynamic();

  if (filters.status) {
    query = query.where(eq(reconciliationReport.status, filters.status));
  }
  if (filters.fromDate) {
    query = query.where(gte(reconciliationReport.periodStart, filters.fromDate));
  }
  if (filters.toDate) {
    query = query.where(lte(reconciliationReport.periodEnd, filters.toDate));
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  return query.limit(limit).offset(offset);
}

export async function getReconRun(id: string) {
  const [report] = await db
    .select()
    .from(reconciliationReport)
    .where(eq(reconciliationReport.id, id))
    .limit(1);
  return report ?? null;
}

export async function getVariances(filters: VarianceFilters = {}) {
  let query = db
    .select()
    .from(reconciliationVariance)
    .orderBy(desc(reconciliationVariance.createdAt))
    .$dynamic();

  if (filters.reportId) {
    query = query.where(eq(reconciliationVariance.reconciliationReportId, filters.reportId));
  }
  if (filters.type) {
    query = query.where(eq(reconciliationVariance.type, filters.type));
  }
  if (filters.severity) {
    query = query.where(eq(reconciliationVariance.severity, filters.severity));
  }
  if (filters.isResolved !== undefined) {
    query = query.where(eq(reconciliationVariance.isResolved, filters.isResolved));
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  return query.limit(limit).offset(offset);
}

export async function getOpenVariances() {
  return db
    .select()
    .from(reconciliationVariance)
    .where(eq(reconciliationVariance.isResolved, false))
    .orderBy(desc(reconciliationVariance.createdAt));
}

export async function resolveVariance(
  id: string,
  staffId: string,
  note: string,
  resolutionType: string = "manual_stripe_confirmed",
) {
  const [updated] = await db
    .update(reconciliationVariance)
    .set({
      isResolved: true,
      resolvedAt: new Date(),
      resolvedByStaffId: staffId,
      resolutionType,
      resolutionNote: note,
    })
    .where(and(
      eq(reconciliationVariance.id, id),
      eq(reconciliationVariance.isResolved, false),
    ))
    .returning();
  return updated ?? null;
}

export async function ignoreVariance(
  id: string,
  staffId: string,
  reason: string,
) {
  return resolveVariance(id, staffId, reason, "manual_write_off");
}

export async function getVarianceById(id: string) {
  const [variance] = await db
    .select()
    .from(reconciliationVariance)
    .where(eq(reconciliationVariance.id, id))
    .limit(1);
  return variance ?? null;
}
