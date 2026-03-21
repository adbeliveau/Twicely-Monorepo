/**
 * Reconciliation queries for admin /fin/recon page.
 * Returns graceful defaults when reconciliation data doesn't exist yet
 * (BullMQ reconciliation job may not be fully wired).
 */

export type ReconStatus = 'CLEAN' | 'DISCREPANCIES' | 'FAILED' | 'NEVER_RUN';

export interface ReconciliationSummary {
  status: ReconStatus;
  lastRunAt: Date | null;
  entriesChecked: number;
  discrepanciesFound: number;
  autoResolved: number;
  pendingManualReview: number;
}

export type DiscrepancySeverity = 'LOW' | 'HIGH' | 'CRITICAL';
export type DiscrepancyStatus = 'PENDING' | 'RESOLVED' | 'AUTO_RESOLVED';

export interface Discrepancy {
  id: string;
  type: string;
  severity: DiscrepancySeverity;
  status: DiscrepancyStatus;
  expectedAmountCents: number;
  actualAmountCents: number;
  differenceCents: number;
  stripeEventId: string | null;
  ledgerEntryId: string | null;
  sellerName: string | null;
  createdAt: Date;
}

export interface DiscrepancyFilters {
  severity?: DiscrepancySeverity;
  status?: DiscrepancyStatus;
  page?: number;
  pageSize?: number;
}

export interface DiscrepancyListResult {
  discrepancies: Discrepancy[];
  total: number;
}

export interface ReconHistoryEntry {
  id: string;
  date: Date;
  status: ReconStatus;
  entriesChecked: number;
  issuesFound: number;
}

export interface BalanceComparison {
  stripeBalanceCents: number;
  platformLiabilityCents: number;
  differenceCents: number;
  lastUpdated: Date | null;
}

// --- Query implementations ---
// These return empty/default data when the reconciliation engine hasn't run yet.
// When the BullMQ reconciliation job is built (Phase G), these will read from
// the reconciliation_reports and related tables.

export async function getReconciliationSummary(): Promise<ReconciliationSummary> {
  return {
    status: 'NEVER_RUN',
    lastRunAt: null,
    entriesChecked: 0,
    discrepanciesFound: 0,
    autoResolved: 0,
    pendingManualReview: 0,
  };
}

export async function getDiscrepancies(
  _filters: DiscrepancyFilters = {},
): Promise<DiscrepancyListResult> {
  return {
    discrepancies: [],
    total: 0,
  };
}

export async function getReconciliationHistory(
  _limit = 10,
): Promise<ReconHistoryEntry[]> {
  return [];
}

export async function getBalanceComparison(): Promise<BalanceComparison> {
  return {
    stripeBalanceCents: 0,
    platformLiabilityCents: 0,
    differenceCents: 0,
    lastUpdated: null,
  };
}
