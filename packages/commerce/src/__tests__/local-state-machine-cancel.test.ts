import { describe, it, expect } from 'vitest';
import { canTransition } from '../local-state-machine';

/**
 * Cancellation-specific state machine transition tests (G2.11).
 *
 * Note: BOTH_CHECKED_IN -> CANCELED is valid in the state machine for
 * system/admin paths. User-initiated cancellation blocks this at the
 * action layer (status allowlist), not the state machine. See A8 spec note.
 */

describe('canTransition — cancellation paths', () => {
  it('SCHEDULED can transition to CANCELED', () => {
    expect(canTransition('SCHEDULED', 'CANCELED')).toBe(true);
  });

  it('SELLER_CHECKED_IN can transition to CANCELED', () => {
    expect(canTransition('SELLER_CHECKED_IN', 'CANCELED')).toBe(true);
  });

  it('BUYER_CHECKED_IN can transition to CANCELED', () => {
    expect(canTransition('BUYER_CHECKED_IN', 'CANCELED')).toBe(true);
  });

  it('RESCHEDULE_PENDING can transition to CANCELED', () => {
    expect(canTransition('RESCHEDULE_PENDING', 'CANCELED')).toBe(true);
  });

  it('BOTH_CHECKED_IN can transition to CANCELED (system/admin path — blocked in action layer for users)', () => {
    // State machine allows this for auto-cancel and admin use.
    // User-initiated cancel from BOTH_CHECKED_IN is blocked by the action's
    // CANCELLABLE_STATUSES allowlist, not the state machine.
    expect(canTransition('BOTH_CHECKED_IN', 'CANCELED')).toBe(true);
  });

  it('COMPLETED cannot transition to CANCELED (terminal)', () => {
    expect(canTransition('COMPLETED', 'CANCELED')).toBe(false);
  });

  it('CANCELED cannot transition to CANCELED (already terminal)', () => {
    expect(canTransition('CANCELED', 'CANCELED')).toBe(false);
  });

  it('NO_SHOW cannot transition to CANCELED (terminal)', () => {
    expect(canTransition('NO_SHOW', 'CANCELED')).toBe(false);
  });

  it('ADJUSTMENT_PENDING can transition to CANCELED (fraud system path per §A12)', () => {
    // Added in R8 fix: fraud detection (§A12) must be able to cancel from any active status.
    // User-initiated cancel from ADJUSTMENT_PENDING is blocked at the action layer.
    expect(canTransition('ADJUSTMENT_PENDING', 'CANCELED')).toBe(true);
  });

  it('RECEIPT_CONFIRMED can transition to CANCELED (fraud system path per §A12)', () => {
    // Added in R8 fix: fraud detection (§A12) must be able to cancel from any active status.
    // Normal user path is RECEIPT_CONFIRMED → DISPUTED → CANCELED (admin resolution).
    expect(canTransition('RECEIPT_CONFIRMED', 'CANCELED')).toBe(true);
  });
});
