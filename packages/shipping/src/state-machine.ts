/**
 * @twicely/shipping — Shipment state machine
 *
 * Enforces valid status transitions for shipments.
 * Invalid transitions are rejected (return false).
 * Terminal states have no outbound transitions.
 */

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:             ['LABEL_CREATED'],
  LABEL_CREATED:       ['PICKED_UP', 'VOIDED'],
  PICKED_UP:           ['IN_TRANSIT', 'DELIVERED'],
  IN_TRANSIT:          ['OUT_FOR_DELIVERY', 'DELIVERED', 'LOST', 'DAMAGED_IN_TRANSIT', 'RETURN_TO_SENDER'],
  OUT_FOR_DELIVERY:    ['DELIVERED', 'FAILED'],
  FAILED:              ['OUT_FOR_DELIVERY', 'RETURN_TO_SENDER'],
  // Terminal states: DELIVERED, LOST, DAMAGED_IN_TRANSIT, RETURN_TO_SENDER, VOIDED
};

const LABEL_VALID_TRANSITIONS: Record<string, string[]> = {
  PURCHASED:    ['PRINTED', 'USED', 'VOID_PENDING', 'EXPIRED', 'ERROR'],
  PRINTED:      ['USED', 'VOID_PENDING', 'EXPIRED', 'ERROR'],
  USED:         ['ERROR'],
  VOID_PENDING: ['VOIDED', 'ERROR'],
  VOIDED:       ['REFUNDED'],
  // Terminal: REFUNDED, EXPIRED, ERROR (from terminal)
};

/**
 * Check if a shipment status transition is valid.
 */
export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if a label status transition is valid.
 */
export function isValidLabelTransition(from: string, to: string): boolean {
  return LABEL_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get all terminal shipment statuses (no outbound transitions).
 */
export function getTerminalStatuses(): string[] {
  return ['DELIVERED', 'LOST', 'DAMAGED_IN_TRANSIT', 'RETURN_TO_SENDER', 'VOIDED'];
}

/**
 * Get all terminal label statuses.
 */
export function getTerminalLabelStatuses(): string[] {
  return ['REFUNDED', 'EXPIRED', 'ERROR'];
}

/**
 * Get valid next statuses for a given shipment status.
 */
export function getNextStatuses(currentStatus: string): string[] {
  return VALID_TRANSITIONS[currentStatus] ?? [];
}

/**
 * Get valid next statuses for a given label status.
 */
export function getNextLabelStatuses(currentStatus: string): string[] {
  return LABEL_VALID_TRANSITIONS[currentStatus] ?? [];
}
