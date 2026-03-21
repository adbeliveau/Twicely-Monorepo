/**
 * Centrifugo channel architecture for local transactions (G2.7 — stub only).
 * Centrifugo client library integration will be wired in a future step.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A4
 */

// ─── Channel Names ────────────────────────────────────────────────────────────

/**
 * Channel both buyer and seller subscribe to on meetup screen mount.
 * Format: private-local-tx.{transactionId}
 * Uses private- prefix so Centrifugo requires subscription token authorization.
 */
export function localTransactionChannel(transactionId: string): string {
  return `private-local-tx.${transactionId}`;
}

// ─── Event Constants ──────────────────────────────────────────────────────────

export const LOCAL_TX_EVENTS = {
  CONFIRMED: 'local_tx.confirmed',
  ADJUSTMENT_PENDING: 'local_tx.adjustment_pending',
  ADJUSTMENT_ACCEPTED: 'local_tx.adjustment_accepted',
  ADJUSTMENT_DECLINED: 'local_tx.adjustment_declined',
  CANCELED: 'local_tx.canceled',
} as const;

export type LocalTxEvent = typeof LOCAL_TX_EVENTS[keyof typeof LOCAL_TX_EVENTS];
