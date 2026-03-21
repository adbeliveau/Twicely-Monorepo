/**
 * Local Scheduling Service (G2.9)
 *
 * Helpers for the meetup time proposal/acceptance flow.
 * Validates proposed times against lead-time bounds read from platform_settings.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A6
 */

import type { LocalTransactionRow } from '@/lib/queries/local-transaction';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

/** Terminal statuses — no scheduling actions allowed */
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELED', 'NO_SHOW'] as const;

type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

function isTerminalStatus(status: string): status is TerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a proposed meetup time against lead-time constraints.
 * Reads min/max scheduling bounds from platform_settings.
 *
 * @param proposedAt - The date/time proposed for the meetup
 * @returns `{ valid: true }` or `{ valid: false, error: string }`
 */
export async function validateProposedTime(
  proposedAt: Date,
): Promise<{ valid: boolean; error?: string }> {
  const minLeadTimeHours = await getPlatformSetting<number>('commerce.local.schedulingMinLeadTimeHours', 1);
  const maxLeadTimeDays = await getPlatformSetting<number>('commerce.local.schedulingMaxLeadTimeDays', 30);

  const now = new Date();

  const minDate = new Date(now);
  minDate.setHours(minDate.getHours() + minLeadTimeHours);

  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + maxLeadTimeDays);

  if (proposedAt <= now) {
    return { valid: false, error: 'Proposed time must be in the future' };
  }

  if (proposedAt < minDate) {
    return {
      valid: false,
      error: `Proposed time must be at least ${minLeadTimeHours} hour from now`,
    };
  }

  if (proposedAt > maxDate) {
    return {
      valid: false,
      error: `Proposed time must be within ${maxLeadTimeDays} days from now`,
    };
  }

  return { valid: true };
}

// ─── Status Helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if both parties have confirmed a meetup time.
 */
export function isSchedulingComplete(tx: LocalTransactionRow): boolean {
  return tx.scheduledAtConfirmedAt !== null;
}

/**
 * Returns true if either party can still propose a meetup time.
 * Requires scheduling not complete AND transaction not in terminal status.
 */
export function canProposeMeetupTime(tx: LocalTransactionRow): boolean {
  if (isSchedulingComplete(tx)) {
    return false;
  }
  if (isTerminalStatus(tx.status)) {
    return false;
  }
  return true;
}

// ─── Reschedule Eligibility ───────────────────────────────────────────────────

/**
 * Statuses from which reschedule is allowed.
 * Per Addendum A7: SCHEDULED, SELLER_CHECKED_IN, BUYER_CHECKED_IN.
 * NOT available from BOTH_CHECKED_IN or later.
 */
const RESCHEDULE_ELIGIBLE_STATUSES = ['SCHEDULED', 'SELLER_CHECKED_IN', 'BUYER_CHECKED_IN'] as const;

/**
 * Returns true if either party can request a reschedule.
 * Requires scheduling confirmed AND status is eligible AND no pending reschedule.
 */
export function canRequestReschedule(tx: LocalTransactionRow): boolean {
  if (isTerminalStatus(tx.status)) return false;
  if (tx.scheduledAtConfirmedAt === null) return false;
  if (tx.status === 'RESCHEDULE_PENDING') return false;
  return (RESCHEDULE_ELIGIBLE_STATUSES as readonly string[]).includes(tx.status);
}
