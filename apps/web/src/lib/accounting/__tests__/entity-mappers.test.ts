/**
 * Tests for entity-mappers.ts — G10.3
 */
import { describe, it, expect } from 'vitest';
import {
  orderToInvoice,
  expenseToExpenseData,
  payoutToJournalEntry,
} from '../entity-mappers';

describe('orderToInvoice', () => {
  it('maps order fields correctly', () => {
    const order = {
      id: 'order-001',
      buyerName: 'Alice Smith',
      priceCents: 5000,
      shippingCostCents: 500,
      completedAt: new Date('2026-01-15'),
    };

    const result = orderToInvoice(order);

    expect(result.customerName).toBe('Alice Smith');
    expect(result.reference).toBe('order-001');
    expect(result.datePaid).toEqual(new Date('2026-01-15'));
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]?.amountCents).toBe(5000);
    expect(result.lineItems[1]?.amountCents).toBe(500);
  });

  it('omits shipping line item when shippingCostCents is zero', () => {
    const order = {
      id: 'order-002',
      buyerName: 'Bob Jones',
      priceCents: 2000,
      shippingCostCents: 0,
      completedAt: new Date('2026-01-16'),
    };

    const result = orderToInvoice(order);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]?.amountCents).toBe(2000);
  });

  it('preserves cents values — does not convert to dollars', () => {
    const order = {
      id: 'order-003',
      buyerName: 'Carol',
      priceCents: 12500,
      shippingCostCents: 799,
      completedAt: new Date('2026-01-17'),
    };

    const result = orderToInvoice(order);
    // Internal representation stays in cents
    expect(result.lineItems[0]?.amountCents).toBe(12500);
    expect(result.lineItems[1]?.amountCents).toBe(799);
  });
});

describe('expenseToExpenseData', () => {
  it('maps expense fields correctly', () => {
    const expense = {
      id: 'exp-001',
      vendor: 'USPS',
      category: 'Shipping Supplies',
      amountCents: 1500,
      expenseDate: new Date('2026-01-10'),
      description: 'Bubble wrap and boxes',
    };

    const result = expenseToExpenseData(expense);

    expect(result.vendor).toBe('USPS');
    expect(result.category).toBe('Shipping Supplies');
    expect(result.amountCents).toBe(1500);
    expect(result.reference).toBe('exp-001');
    expect(result.description).toBe('Bubble wrap and boxes');
  });

  it('uses "Unknown Vendor" when vendor is null', () => {
    const expense = {
      id: 'exp-002',
      vendor: null,
      category: 'Equipment',
      amountCents: 9999,
      expenseDate: new Date('2026-01-11'),
      description: null,
    };

    const result = expenseToExpenseData(expense);
    expect(result.vendor).toBe('Unknown Vendor');
    expect(result.description).toBe('Equipment');  // falls back to category
  });

  it('handles zero amount', () => {
    const expense = {
      id: 'exp-003',
      vendor: 'Test',
      category: 'Other',
      amountCents: 0,
      expenseDate: new Date('2026-01-12'),
      description: 'Zero expense',
    };

    const result = expenseToExpenseData(expense);
    expect(result.amountCents).toBe(0);
  });
});

describe('payoutToJournalEntry', () => {
  it('maps payout to debit/credit journal lines', () => {
    const payout = {
      id: 'payout-001',
      amountCents: 50000,
      createdAt: new Date('2026-01-20'),
      memo: 'Weekly payout',
    };

    const result = payoutToJournalEntry(payout);

    expect(result.reference).toBe('payout-001');
    expect(result.memo).toBe('Weekly payout');
    expect(result.lines).toHaveLength(2);

    // AR credit line
    const creditLine = result.lines.find((l) => l.creditCents > 0);
    expect(creditLine?.creditCents).toBe(50000);
    expect(creditLine?.debitCents).toBe(0);

    // Bank debit line
    const debitLine = result.lines.find((l) => l.debitCents > 0);
    expect(debitLine?.debitCents).toBe(50000);
    expect(debitLine?.creditCents).toBe(0);
  });

  it('uses default memo when memo is null', () => {
    const payout = {
      id: 'payout-002',
      amountCents: 10000,
      createdAt: new Date('2026-01-21'),
      memo: null,
    };

    const result = payoutToJournalEntry(payout);
    expect(result.memo).toContain('payout-002');
  });
});
