/**
 * Local Transaction State Machine (G2.4)
 *
 * Defines valid status transitions for local transactions.
 * Used to validate state changes before DB updates.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL.md §4:
 * - SCHEDULED → check-in states → RECEIPT_CONFIRMED → COMPLETED
 * - Terminal states: COMPLETED, CANCELED, NO_SHOW
 * - DISPUTED is resolved by admin only (→ COMPLETED or CANCELED)
 */

const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['SELLER_CHECKED_IN', 'BUYER_CHECKED_IN', 'BOTH_CHECKED_IN', 'RESCHEDULE_PENDING', 'CANCELED'],
  SELLER_CHECKED_IN: ['BOTH_CHECKED_IN', 'RECEIPT_CONFIRMED', 'RESCHEDULE_PENDING', 'NO_SHOW', 'CANCELED'],
  BUYER_CHECKED_IN: ['BOTH_CHECKED_IN', 'RECEIPT_CONFIRMED', 'RESCHEDULE_PENDING', 'NO_SHOW', 'CANCELED'],
  BOTH_CHECKED_IN: ['ADJUSTMENT_PENDING', 'RECEIPT_CONFIRMED', 'NO_SHOW', 'CANCELED'],
  ADJUSTMENT_PENDING: ['BOTH_CHECKED_IN', 'RECEIPT_CONFIRMED'],
  RESCHEDULE_PENDING: ['SCHEDULED', 'CANCELED'],
  RECEIPT_CONFIRMED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],    // terminal
  CANCELED: [],     // terminal
  NO_SHOW: [],      // terminal
  DISPUTED: ['COMPLETED', 'CANCELED'], // resolved by admin
};

/**
 * Check whether a status transition is valid.
 *
 * @param from - Current status
 * @param to - Target status
 * @returns true if the transition is allowed
 */
export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get all valid next statuses from a given status.
 *
 * @param from - Current status
 * @returns Array of allowed next statuses
 */
export function getValidTransitions(from: string): string[] {
  return VALID_TRANSITIONS[from] ?? [];
}

/**
 * Check whether a status is terminal (no further transitions allowed).
 *
 * @param status - Status to check
 * @returns true if status is terminal
 */
export function isTerminalStatus(status: string): boolean {
  const transitions = VALID_TRANSITIONS[status];
  return transitions !== undefined && transitions.length === 0;
}
