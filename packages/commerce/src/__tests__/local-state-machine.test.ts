import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getValidTransitions,
  isTerminalStatus,
} from '../local-state-machine';

describe('canTransition', () => {
  it('allows BOTH_CHECKED_IN → ADJUSTMENT_PENDING', () => {
    expect(canTransition('BOTH_CHECKED_IN', 'ADJUSTMENT_PENDING')).toBe(true);
  });

  it('allows ADJUSTMENT_PENDING → BOTH_CHECKED_IN', () => {
    expect(canTransition('ADJUSTMENT_PENDING', 'BOTH_CHECKED_IN')).toBe(true);
  });

  it('allows ADJUSTMENT_PENDING → RECEIPT_CONFIRMED', () => {
    expect(canTransition('ADJUSTMENT_PENDING', 'RECEIPT_CONFIRMED')).toBe(true);
  });

  it('allows ADJUSTMENT_PENDING → CANCELED (fraud system cancel per §A12)', () => {
    // Fraud detection must be able to cancel from any active status (§A12).
    // User-initiated cancel from ADJUSTMENT_PENDING is blocked at the action layer.
    expect(canTransition('ADJUSTMENT_PENDING', 'CANCELED')).toBe(true);
  });

  it('denies ADJUSTMENT_PENDING → NO_SHOW', () => {
    expect(canTransition('ADJUSTMENT_PENDING', 'NO_SHOW')).toBe(false);
  });

  it('denies SCHEDULED → ADJUSTMENT_PENDING', () => {
    expect(canTransition('SCHEDULED', 'ADJUSTMENT_PENDING')).toBe(false);
  });

  it('allows SCHEDULED → SELLER_CHECKED_IN', () => {
    expect(canTransition('SCHEDULED', 'SELLER_CHECKED_IN')).toBe(true);
  });

  it('allows SCHEDULED → BUYER_CHECKED_IN', () => {
    expect(canTransition('SCHEDULED', 'BUYER_CHECKED_IN')).toBe(true);
  });

  it('allows SCHEDULED → CANCELED', () => {
    expect(canTransition('SCHEDULED', 'CANCELED')).toBe(true);
  });

  it('allows SELLER_CHECKED_IN → BOTH_CHECKED_IN', () => {
    expect(canTransition('SELLER_CHECKED_IN', 'BOTH_CHECKED_IN')).toBe(true);
  });

  it('allows BUYER_CHECKED_IN → BOTH_CHECKED_IN', () => {
    expect(canTransition('BUYER_CHECKED_IN', 'BOTH_CHECKED_IN')).toBe(true);
  });

  it('allows BOTH_CHECKED_IN → RECEIPT_CONFIRMED', () => {
    expect(canTransition('BOTH_CHECKED_IN', 'RECEIPT_CONFIRMED')).toBe(true);
  });

  it('allows RECEIPT_CONFIRMED → COMPLETED', () => {
    expect(canTransition('RECEIPT_CONFIRMED', 'COMPLETED')).toBe(true);
  });

  it('allows RECEIPT_CONFIRMED → DISPUTED', () => {
    expect(canTransition('RECEIPT_CONFIRMED', 'DISPUTED')).toBe(true);
  });

  it('allows DISPUTED → COMPLETED (admin resolution)', () => {
    expect(canTransition('DISPUTED', 'COMPLETED')).toBe(true);
  });

  it('allows DISPUTED → CANCELED (admin resolution)', () => {
    expect(canTransition('DISPUTED', 'CANCELED')).toBe(true);
  });

  it('denies COMPLETED → CANCELED (terminal state)', () => {
    expect(canTransition('COMPLETED', 'CANCELED')).toBe(false);
  });

  it('denies CANCELED → SCHEDULED (terminal state)', () => {
    expect(canTransition('CANCELED', 'SCHEDULED')).toBe(false);
  });

  it('denies NO_SHOW → COMPLETED (terminal state)', () => {
    expect(canTransition('NO_SHOW', 'COMPLETED')).toBe(false);
  });

  it('allows SCHEDULED → COMPLETED (cash local sale direct completion — §A0)', () => {
    // Cash sales skip check-in and QR steps entirely; seller manually marks complete.
    // SafeTrade path still requires BOTH_CHECKED_IN → RECEIPT_CONFIRMED → COMPLETED.
    expect(canTransition('SCHEDULED', 'COMPLETED')).toBe(true);
  });

  it('returns false for unknown from-status', () => {
    expect(canTransition('UNKNOWN', 'SCHEDULED')).toBe(false);
  });

  it('returns false for unknown to-status', () => {
    expect(canTransition('SCHEDULED', 'NONEXISTENT')).toBe(false);
  });

  // RESCHEDULE_PENDING transitions (G2.10)
  it('allows SCHEDULED → RESCHEDULE_PENDING', () => {
    expect(canTransition('SCHEDULED', 'RESCHEDULE_PENDING')).toBe(true);
  });

  it('allows SELLER_CHECKED_IN → RESCHEDULE_PENDING', () => {
    expect(canTransition('SELLER_CHECKED_IN', 'RESCHEDULE_PENDING')).toBe(true);
  });

  it('allows BUYER_CHECKED_IN → RESCHEDULE_PENDING', () => {
    expect(canTransition('BUYER_CHECKED_IN', 'RESCHEDULE_PENDING')).toBe(true);
  });

  it('denies BOTH_CHECKED_IN → RESCHEDULE_PENDING', () => {
    expect(canTransition('BOTH_CHECKED_IN', 'RESCHEDULE_PENDING')).toBe(false);
  });

  it('allows RESCHEDULE_PENDING → SCHEDULED', () => {
    expect(canTransition('RESCHEDULE_PENDING', 'SCHEDULED')).toBe(true);
  });

  it('allows RESCHEDULE_PENDING → CANCELED', () => {
    expect(canTransition('RESCHEDULE_PENDING', 'CANCELED')).toBe(true);
  });

  it('denies RESCHEDULE_PENDING → SELLER_CHECKED_IN', () => {
    expect(canTransition('RESCHEDULE_PENDING', 'SELLER_CHECKED_IN')).toBe(false);
  });

  it('denies RESCHEDULE_PENDING → BUYER_CHECKED_IN', () => {
    expect(canTransition('RESCHEDULE_PENDING', 'BUYER_CHECKED_IN')).toBe(false);
  });

  it('denies RESCHEDULE_PENDING → RECEIPT_CONFIRMED', () => {
    expect(canTransition('RESCHEDULE_PENDING', 'RECEIPT_CONFIRMED')).toBe(false);
  });

  // Fraud detection system cancellation paths (§A12)
  it('allows ADJUSTMENT_PENDING → CANCELED (fraud system cancel)', () => {
    expect(canTransition('ADJUSTMENT_PENDING', 'CANCELED')).toBe(true);
  });

  it('allows RECEIPT_CONFIRMED → CANCELED (fraud system cancel)', () => {
    expect(canTransition('RECEIPT_CONFIRMED', 'CANCELED')).toBe(true);
  });
});

describe('getValidTransitions', () => {
  it('returns all valid transitions for SCHEDULED', () => {
    const transitions = getValidTransitions('SCHEDULED');
    expect(transitions).toContain('SELLER_CHECKED_IN');
    expect(transitions).toContain('BUYER_CHECKED_IN');
    expect(transitions).toContain('BOTH_CHECKED_IN');
    expect(transitions).toContain('CANCELED');
  });

  it('returns empty array for COMPLETED (terminal)', () => {
    expect(getValidTransitions('COMPLETED')).toEqual([]);
  });

  it('returns empty array for unknown status', () => {
    expect(getValidTransitions('UNKNOWN')).toEqual([]);
  });
});

describe('isTerminalStatus', () => {
  it('identifies COMPLETED as terminal', () => {
    expect(isTerminalStatus('COMPLETED')).toBe(true);
  });

  it('identifies CANCELED as terminal', () => {
    expect(isTerminalStatus('CANCELED')).toBe(true);
  });

  it('identifies NO_SHOW as terminal', () => {
    expect(isTerminalStatus('NO_SHOW')).toBe(true);
  });

  it('identifies SCHEDULED as non-terminal', () => {
    expect(isTerminalStatus('SCHEDULED')).toBe(false);
  });

  it('returns false for unknown status', () => {
    expect(isTerminalStatus('UNKNOWN')).toBe(false);
  });
});
