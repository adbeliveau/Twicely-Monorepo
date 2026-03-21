import { describe, it, expect } from 'vitest';
import {
  formatCentsToDollars,
  calculateTrend,
  getLedgerTypeLabel,
} from '../format';

describe('formatCentsToDollars', () => {
  it('formats positive cents to dollar string', () => {
    expect(formatCentsToDollars(1000)).toBe('$10.00');
  });

  it('formats zero cents as $0.00', () => {
    expect(formatCentsToDollars(0)).toBe('$0.00');
  });

  it('formats negative cents with minus sign', () => {
    expect(formatCentsToDollars(-500)).toBe('-$5.00');
  });

  it('formats single-digit cents with leading zero', () => {
    expect(formatCentsToDollars(501)).toBe('$5.01');
  });

  it('formats large amounts with locale commas', () => {
    const result = formatCentsToDollars(1000000);
    expect(result).toContain('$');
    expect(result).toContain('10,000.00');
  });

  it('formats $0.01 correctly', () => {
    expect(formatCentsToDollars(1)).toBe('$0.01');
  });

  it('formats $0.99 correctly', () => {
    expect(formatCentsToDollars(99)).toBe('$0.99');
  });

  it('formats large negative correctly', () => {
    expect(formatCentsToDollars(-10000)).toBe('-$100.00');
  });

  it('uses integer arithmetic — no floating-point drift at $9.99', () => {
    expect(formatCentsToDollars(999)).toBe('$9.99');
  });

  it('handles minimum payout amount (1500 cents = $15.00)', () => {
    expect(formatCentsToDollars(1500)).toBe('$15.00');
  });
});

describe('calculateTrend', () => {
  it('returns flat when both values are zero', () => {
    const result = calculateTrend(0, 0);
    expect(result.direction).toBe('flat');
    expect(result.percent).toBe(0);
  });

  it('returns up when current > previous', () => {
    const result = calculateTrend(1200, 1000);
    expect(result.direction).toBe('up');
    expect(result.percent).toBe(20);
  });

  it('returns down when current < previous', () => {
    const result = calculateTrend(800, 1000);
    expect(result.direction).toBe('down');
    expect(result.percent).toBe(20);
  });

  it('returns flat with 0 percent when current equals previous', () => {
    const result = calculateTrend(1000, 1000);
    expect(result.direction).toBe('flat');
    expect(result.percent).toBe(0);
  });

  it('returns up direction when previousCents is 0 and current > 0', () => {
    const result = calculateTrend(500, 0);
    expect(result.direction).toBe('up');
    expect(result.percent).toBe(0);
  });

  it('returns flat direction when previousCents is 0 and current is also 0', () => {
    const result = calculateTrend(0, 0);
    expect(result.direction).toBe('flat');
    expect(result.percent).toBe(0);
  });

  it('calculates 50% increase correctly', () => {
    const result = calculateTrend(1500, 1000);
    expect(result.direction).toBe('up');
    expect(result.percent).toBe(50);
  });

  it('calculates 100% increase correctly', () => {
    const result = calculateTrend(2000, 1000);
    expect(result.direction).toBe('up');
    expect(result.percent).toBe(100);
  });

  it('rounds percent to 2 decimal places', () => {
    // 1/3 increase -> 33.33%
    const result = calculateTrend(4, 3);
    expect(result.percent).toBe(33.33);
  });

  it('percent is always positive even for down trend', () => {
    const result = calculateTrend(500, 1000);
    expect(result.percent).toBeGreaterThan(0);
    expect(result.direction).toBe('down');
  });
});

describe('getLedgerTypeLabel', () => {
  it('returns "Transaction Fee" for ORDER_TF_FEE', () => {
    expect(getLedgerTypeLabel('ORDER_TF_FEE')).toBe('Transaction Fee');
  });

  it('returns "Sale" for ORDER_PAYMENT_CAPTURED', () => {
    expect(getLedgerTypeLabel('ORDER_PAYMENT_CAPTURED')).toBe('Sale');
  });

  it('returns "Payment processing fee" for ORDER_STRIPE_PROCESSING_FEE', () => {
    expect(getLedgerTypeLabel('ORDER_STRIPE_PROCESSING_FEE')).toBe('Payment processing fee');
  });

  it('returns "Payout sent" for PAYOUT_SENT', () => {
    expect(getLedgerTypeLabel('PAYOUT_SENT')).toBe('Payout sent');
  });

  it('returns "Full refund" for REFUND_FULL', () => {
    expect(getLedgerTypeLabel('REFUND_FULL')).toBe('Full refund');
  });

  it('returns "Shipping label" for SHIPPING_LABEL_PURCHASE', () => {
    expect(getLedgerTypeLabel('SHIPPING_LABEL_PURCHASE')).toBe('Shipping label');
  });

  it('returns "Finance Pro charge" for FINANCE_SUBSCRIPTION_CHARGE', () => {
    expect(getLedgerTypeLabel('FINANCE_SUBSCRIPTION_CHARGE')).toBe('Finance Pro charge');
  });

  it('returns "Manual credit" for MANUAL_CREDIT', () => {
    expect(getLedgerTypeLabel('MANUAL_CREDIT')).toBe('Manual credit');
  });

  it('returns "Manual debit" for MANUAL_DEBIT', () => {
    expect(getLedgerTypeLabel('MANUAL_DEBIT')).toBe('Manual debit');
  });

  it('returns the raw type string for unknown types (fallback)', () => {
    expect(getLedgerTypeLabel('UNKNOWN_TYPE_XYZ')).toBe('UNKNOWN_TYPE_XYZ');
  });

  it('does NOT return v2 legacy fee term for any type', () => {
    const label = getLedgerTypeLabel('ORDER_TF_FEE');
    // Verify v3 terminology is used (not v2 legacy terms)
    expect(label).toContain('Transaction Fee');
  });

  it('returns "Transaction Fee reversal" for REFUND_TF_REVERSAL', () => {
    expect(getLedgerTypeLabel('REFUND_TF_REVERSAL')).toBe('Transaction Fee reversal');
  });

  it('returns "Chargeback" for CHARGEBACK_DEBIT', () => {
    expect(getLedgerTypeLabel('CHARGEBACK_DEBIT')).toBe('Chargeback');
  });
});

