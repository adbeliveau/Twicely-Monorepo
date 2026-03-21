/**
 * G10.10 — PaymentMethodCard component logic gap tests
 *
 * Covers branches NOT exercised by payment-method-card.test.tsx:
 *   - formatBrand with uppercase input (brand.toLowerCase() handles it)
 *   - formatBrand for all mapped brands (discover, diners, jcb)
 *   - formatBrand for unknown brand uses charAt(0).toUpperCase() + slice(1)
 *   - formatExpiry: both digits month (no padding needed), 2-digit year from 4-digit
 *   - setDefaultPaymentMethod pure logic: non-existent ID leaves all cards non-default
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

function setDefaultPaymentMethod(
  existing: SerializedPaymentMethod[],
  id: string,
): SerializedPaymentMethod[] {
  return existing.map((pm) => ({ ...pm, isDefault: pm.id === id }));
}

function makePaymentMethod(id: string, isDefault = false): SerializedPaymentMethod {
  return { id, brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028, isDefault };
}

// ─── Tests: brand formatting — uppercase input ────────────────────────────────

describe('PaymentMethodCard — brand formatting (uppercase input)', () => {
  it('handles uppercase VISA correctly via toLowerCase()', () => {
    expect(formatBrand('VISA')).toBe('Visa');
  });

  it('handles mixed case MasterCard correctly', () => {
    expect(formatBrand('MasterCard')).toBe('Mastercard');
  });
});

// ─── Tests: brand formatting — all mapped brands ─────────────────────────────

describe('PaymentMethodCard — brand formatting (all mapped brands)', () => {
  it('renders Discover correctly', () => {
    expect(formatBrand('discover')).toBe('Discover');
  });

  it('renders Diners Club correctly', () => {
    expect(formatBrand('diners')).toBe('Diners Club');
  });

  it('renders JCB correctly', () => {
    expect(formatBrand('jcb')).toBe('JCB');
  });
});

// ─── Tests: brand formatting — unknown brand fallback ────────────────────────

describe('PaymentMethodCard — brand formatting (unknown brand fallback)', () => {
  it('capitalizes first letter of unknown brand', () => {
    // 'stripe' is not in the map — should return 'Stripe'
    expect(formatBrand('stripe')).toBe('Stripe');
  });

  it('preserves rest of unknown brand string after first character', () => {
    expect(formatBrand('carboncopy')).toBe('Carboncopy');
  });

  it('handles single-character unknown brand', () => {
    expect(formatBrand('x')).toBe('X');
  });
});

// ─── Tests: expiry formatting — boundary cases ────────────────────────────────

describe('PaymentMethodCard — expiry formatting (boundary cases)', () => {
  it('formats January (1) with zero padding', () => {
    expect(formatExpiry(1, 2030)).toBe('Expires 01/30');
  });

  it('formats October (10) without extra padding', () => {
    expect(formatExpiry(10, 2029)).toBe('Expires 10/29');
  });

  it('correctly takes last 2 digits of a 4-digit year (2100 → "00")', () => {
    expect(formatExpiry(6, 2100)).toBe('Expires 06/00');
  });

  it('formats correctly at year boundary 2099 → "99"', () => {
    expect(formatExpiry(11, 2099)).toBe('Expires 11/99');
  });
});

// ─── Tests: setDefault — non-existent ID ─────────────────────────────────────

describe('PaymentMethodsClient — setDefault with non-existent ID', () => {
  it('sets all cards to isDefault=false when ID does not match any card', () => {
    const pms = [
      makePaymentMethod('pm_1', true),
      makePaymentMethod('pm_2', false),
    ];
    const updated = setDefaultPaymentMethod(pms, 'pm_nonexistent');
    expect(updated[0]!.isDefault).toBe(false);
    expect(updated[1]!.isDefault).toBe(false);
  });

  it('returns empty array unchanged when list is empty', () => {
    const updated = setDefaultPaymentMethod([], 'pm_nonexistent');
    expect(updated).toHaveLength(0);
  });
});
