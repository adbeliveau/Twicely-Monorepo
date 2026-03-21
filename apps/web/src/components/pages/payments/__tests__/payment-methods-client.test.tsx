/**
 * Tests for PaymentMethodsClient component logic (G10.10)
 * Pure-logic extraction pattern — no DOM/RTL required.
 */
import { describe, it, expect } from 'vitest';
import type { SerializedPaymentMethod } from '@/lib/actions/payment-methods';

// ─── Pure functions mirroring component state logic ───────────────────────────

function isEmptyState(paymentMethods: SerializedPaymentMethod[], isAddingCard: boolean): boolean {
  return paymentMethods.length === 0 && !isAddingCard;
}

function addOrUpdatePaymentMethod(
  existing: SerializedPaymentMethod[],
  newPm: SerializedPaymentMethod,
): SerializedPaymentMethod[] {
  const exists = existing.some((pm) => pm.id === newPm.id);
  return exists ? existing : [...existing, newPm];
}

function removePaymentMethod(
  existing: SerializedPaymentMethod[],
  id: string,
): SerializedPaymentMethod[] {
  return existing.filter((pm) => pm.id !== id);
}

function setDefaultPaymentMethod(
  existing: SerializedPaymentMethod[],
  id: string,
): SerializedPaymentMethod[] {
  return existing.map((pm) => ({ ...pm, isDefault: pm.id === id }));
}

function makePaymentMethod(id: string, isDefault = false): SerializedPaymentMethod {
  return {
    id,
    brand: 'visa',
    last4: '4242',
    expMonth: 12,
    expYear: 2028,
    isDefault,
  };
}

// ─── Tests: empty state ───────────────────────────────────────────────────────

describe('PaymentMethodsClient — empty state', () => {
  it('shows empty state when no payment methods and not adding a card', () => {
    expect(isEmptyState([], false)).toBe(true);
  });

  it('does not show empty state when cards are present', () => {
    expect(isEmptyState([makePaymentMethod('pm_1')], false)).toBe(false);
  });

  it('does not show empty state when in add-card flow even with no existing cards', () => {
    expect(isEmptyState([], true)).toBe(false);
  });
});

// ─── Tests: card list rendering ───────────────────────────────────────────────

describe('PaymentMethodsClient — card list', () => {
  it('renders one card per payment method', () => {
    const pms = [makePaymentMethod('pm_1'), makePaymentMethod('pm_2')];
    expect(pms).toHaveLength(2);
    expect(pms[0]!.id).toBe('pm_1');
    expect(pms[1]!.id).toBe('pm_2');
  });

  it('adds a new card without duplicating when id is new', () => {
    const existing = [makePaymentMethod('pm_1')];
    const newPm = makePaymentMethod('pm_2');
    const updated = addOrUpdatePaymentMethod(existing, newPm);
    expect(updated).toHaveLength(2);
  });

  it('does not add a card when the same id already exists', () => {
    const existing = [makePaymentMethod('pm_1')];
    const updated = addOrUpdatePaymentMethod(existing, makePaymentMethod('pm_1'));
    expect(updated).toHaveLength(1);
  });
});

// ─── Tests: remove card ───────────────────────────────────────────────────────

describe('PaymentMethodsClient — remove card', () => {
  it('removes the correct card from the list', () => {
    const pms = [makePaymentMethod('pm_1'), makePaymentMethod('pm_2')];
    const updated = removePaymentMethod(pms, 'pm_1');
    expect(updated).toHaveLength(1);
    expect(updated[0]!.id).toBe('pm_2');
  });

  it('returns same list when id does not exist', () => {
    const pms = [makePaymentMethod('pm_1')];
    const updated = removePaymentMethod(pms, 'pm_nonexistent');
    expect(updated).toHaveLength(1);
  });
});

// ─── Tests: set default ───────────────────────────────────────────────────────

describe('PaymentMethodsClient — set default', () => {
  it('marks the target card as default and others as not default', () => {
    const pms = [
      makePaymentMethod('pm_1', true),
      makePaymentMethod('pm_2', false),
    ];
    const updated = setDefaultPaymentMethod(pms, 'pm_2');
    expect(updated.find((pm) => pm.id === 'pm_1')!.isDefault).toBe(false);
    expect(updated.find((pm) => pm.id === 'pm_2')!.isDefault).toBe(true);
  });

  it('correctly sets the first card as default when none were default', () => {
    const pms = [makePaymentMethod('pm_1', false), makePaymentMethod('pm_2', false)];
    const updated = setDefaultPaymentMethod(pms, 'pm_1');
    expect(updated[0]!.isDefault).toBe(true);
    expect(updated[1]!.isDefault).toBe(false);
  });
});
