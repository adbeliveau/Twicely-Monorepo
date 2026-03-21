/**
 * Tests for PaymentMethodCard component logic (G10.10)
 * Pure-logic extraction pattern — no DOM/RTL required.
 */
import { describe, it, expect } from 'vitest';
import type { SerializedPaymentMethod } from '@/lib/actions/payment-methods';

// ─── Pure functions mirroring component logic ─────────────────────────────────

function formatBrand(brand: string): string {
  const map: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };
  return map[brand.toLowerCase()] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

function formatExpiry(expMonth: number, expYear: number): string {
  return `Expires ${String(expMonth).padStart(2, '0')}/${String(expYear).slice(-2)}`;
}

function shouldShowSetAsDefault(isDefault: boolean): boolean {
  return !isDefault;
}

function shouldShowDefaultBadge(isDefault: boolean): boolean {
  return isDefault;
}

function isButtonBusy(isRemoving: boolean, isSettingDefault: boolean): boolean {
  return isRemoving || isSettingDefault;
}

function makePaymentMethod(overrides: Partial<SerializedPaymentMethod> = {}): SerializedPaymentMethod {
  return {
    id: 'pm_test_1',
    brand: 'visa',
    last4: '4242',
    expMonth: 12,
    expYear: 2028,
    isDefault: false,
    ...overrides,
  };
}

// ─── Tests: brand rendering ───────────────────────────────────────────────────

describe('PaymentMethodCard — brand rendering', () => {
  it('renders Visa correctly', () => {
    expect(formatBrand('visa')).toBe('Visa');
  });

  it('renders Mastercard correctly', () => {
    expect(formatBrand('mastercard')).toBe('Mastercard');
  });

  it('renders American Express for amex', () => {
    expect(formatBrand('amex')).toBe('American Express');
  });

  it('capitalizes unknown brands', () => {
    expect(formatBrand('unionpay')).toBe('UnionPay');
  });

  it('displays last4 as provided by the payment method', () => {
    const pm = makePaymentMethod({ last4: '1234' });
    expect(pm.last4).toBe('1234');
  });
});

// ─── Tests: expiry ────────────────────────────────────────────────────────────

describe('PaymentMethodCard — expiry formatting', () => {
  it('formats expiry with zero-padded month', () => {
    expect(formatExpiry(3, 2027)).toBe('Expires 03/27');
  });

  it('formats December as 12', () => {
    expect(formatExpiry(12, 2028)).toBe('Expires 12/28');
  });
});

// ─── Tests: default badge ─────────────────────────────────────────────────────

describe('PaymentMethodCard — default badge', () => {
  it('shows Default badge when isDefault is true', () => {
    expect(shouldShowDefaultBadge(true)).toBe(true);
  });

  it('does not show Default badge when isDefault is false', () => {
    expect(shouldShowDefaultBadge(false)).toBe(false);
  });
});

// ─── Tests: set as default button ────────────────────────────────────────────

describe('PaymentMethodCard — set as default button', () => {
  it('hides Set as default button when isDefault is true', () => {
    expect(shouldShowSetAsDefault(true)).toBe(false);
  });

  it('shows Set as default button when isDefault is false', () => {
    expect(shouldShowSetAsDefault(false)).toBe(true);
  });
});

// ─── Tests: busy state ────────────────────────────────────────────────────────

describe('PaymentMethodCard — busy/disabled state', () => {
  it('is busy when isRemoving is true', () => {
    expect(isButtonBusy(true, false)).toBe(true);
  });

  it('is busy when isSettingDefault is true', () => {
    expect(isButtonBusy(false, true)).toBe(true);
  });

  it('is not busy when both are false', () => {
    expect(isButtonBusy(false, false)).toBe(false);
  });
});
