/**
 * Finance Reconciliation Types
 *
 * All types for the reconciliation engine: variance detection,
 * run tracking, and resolution lifecycle.
 * Canonical 31 Section 4-5.
 */

// --- Variance Types ---------------------------------------------------------

export const VARIANCE_TYPES = [
  'UNMATCHED_STRIPE_EVENT',
  'ORPHANED_LEDGER_ENTRY',
  'AMOUNT_MISMATCH',
  'DUPLICATE_STRIPE_EVENT',
  'TIMING_DIFFERENCE',
] as const;

export type VarianceType = (typeof VARIANCE_TYPES)[number];

// --- Severity ---------------------------------------------------------------

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITIES)[number];

// --- Reconciliation Status --------------------------------------------------

export const RECON_STATUSES = ['running', 'clean', 'discrepancies', 'failed'] as const;
export type ReconStatus = (typeof RECON_STATUSES)[number];

// --- Resolution Types -------------------------------------------------------

export const RESOLUTION_TYPES = [
  'auto_timing',
  'auto_rounding',
  'manual_ledger_correction',
  'manual_stripe_confirmed',
  'manual_webhook_replay',
  'manual_write_off',
] as const;
export type ResolutionType = (typeof RESOLUTION_TYPES)[number];

// --- Data Records -----------------------------------------------------------

export interface StripeEventRecord {
  id: string;
  type: string;
  amountCents: number;
  occurredAt: Date;
  objectId: string;
  metadata?: Record<string, string>;
}

export interface LedgerEntryRecord {
  id: string;
  type: string;
  amountCents: number;
  stripeEventId: string | null;
  orderId: string | null;
  userId: string | null;
  createdAt: Date;
}

export interface StripeEventLogRecord {
  id: string;
  stripeEventId: string;
  eventType: string;
  processingStatus: string;
  createdAt: Date;
}

// --- Variance (intermediate) ------------------------------------------------

export interface Variance {
  type: VarianceType;
  severity?: Severity;
  stripeEventId?: string;
  stripeObjectType?: string;
  ledgerEntryId?: string;
  stripeAmountCents?: number;
  ledgerAmountCents?: number;
  varianceAmountCents: number;
  orderId?: string;
  userId?: string;
}

// --- Run Input / Output -----------------------------------------------------

export interface ReconRunInput {
  date?: Date;
  staffId?: string;
  lookbackHours?: number;
}

export interface ReconciliationResult {
  reportId: string;
  status: ReconStatus;
  totalEntriesChecked: number;
  matchedCount: number;
  varianceCount: number;
  varianceTotalCents: number;
  stripeTotalCents: number;
  ledgerTotalCents: number;
  variances: Variance[];
}

// --- Check Results ----------------------------------------------------------

export interface ReconCheckResult {
  checkName: string;
  passed: boolean;
  variancesFound: Variance[];
  stripeTotalCents: number;
  ledgerTotalCents: number;
  matchedCount: number;
  checkedCount: number;
}

// --- Summary JSON structure -------------------------------------------------

export interface ReconSummaryJson {
  stripeTotalCents: number;
  ledgerTotalCents: number;
  matchedCount: number;
  varianceTotalCents: number;
}

export interface ReconDiscrepanciesJson {
  UNMATCHED_STRIPE_EVENT?: number;
  ORPHANED_LEDGER_ENTRY?: number;
  AMOUNT_MISMATCH?: number;
  DUPLICATE_STRIPE_EVENT?: number;
  TIMING_DIFFERENCE?: number;
}

// --- Filters ----------------------------------------------------------------

export interface ReconRunFilters {
  status?: ReconStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface VarianceFilters {
  reportId?: string;
  type?: VarianceType;
  severity?: Severity;
  isResolved?: boolean;
  limit?: number;
  offset?: number;
}
