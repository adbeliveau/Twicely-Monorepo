/**
 * Tests for getLedgerTypeGroup in format.ts.
 * Split from format.test.ts to stay under 250-line limit.
 */
import { describe, it, expect } from 'vitest';
import { getLedgerTypeGroup } from '../format';

describe('getLedgerTypeGroup', () => {
  it('classifies ORDER_PAYMENT_CAPTURED as SALES', () => {
    expect(getLedgerTypeGroup('ORDER_PAYMENT_CAPTURED')).toBe('SALES');
  });

  it('classifies ORDER_TF_FEE as FEES', () => {
    expect(getLedgerTypeGroup('ORDER_TF_FEE')).toBe('FEES');
  });

  it('classifies ORDER_BOOST_FEE as FEES', () => {
    expect(getLedgerTypeGroup('ORDER_BOOST_FEE')).toBe('FEES');
  });

  it('classifies ORDER_STRIPE_PROCESSING_FEE as FEES', () => {
    expect(getLedgerTypeGroup('ORDER_STRIPE_PROCESSING_FEE')).toBe('FEES');
  });

  it('classifies INSERTION_FEE as FEES', () => {
    expect(getLedgerTypeGroup('INSERTION_FEE')).toBe('FEES');
  });

  it('classifies SUBSCRIPTION_CHARGE as FEES', () => {
    expect(getLedgerTypeGroup('SUBSCRIPTION_CHARGE')).toBe('FEES');
  });

  it('classifies FINANCE_SUBSCRIPTION_CHARGE as FEES', () => {
    expect(getLedgerTypeGroup('FINANCE_SUBSCRIPTION_CHARGE')).toBe('FEES');
  });

  it('classifies LOCAL_TRANSACTION_FEE as FEES', () => {
    expect(getLedgerTypeGroup('LOCAL_TRANSACTION_FEE')).toBe('FEES');
  });

  it('classifies CHARGEBACK_FEE as FEES', () => {
    expect(getLedgerTypeGroup('CHARGEBACK_FEE')).toBe('FEES');
  });

  it('classifies AUTH_FEE_BUYER as FEES', () => {
    expect(getLedgerTypeGroup('AUTH_FEE_BUYER')).toBe('FEES');
  });

  it('classifies AUTH_FEE_SELLER as FEES', () => {
    expect(getLedgerTypeGroup('AUTH_FEE_SELLER')).toBe('FEES');
  });

  it('classifies OVERAGE_CHARGE as FEES', () => {
    expect(getLedgerTypeGroup('OVERAGE_CHARGE')).toBe('FEES');
  });

  it('classifies PAYOUT_SENT as PAYOUTS', () => {
    expect(getLedgerTypeGroup('PAYOUT_SENT')).toBe('PAYOUTS');
  });

  it('classifies PAYOUT_FAILED as PAYOUTS', () => {
    expect(getLedgerTypeGroup('PAYOUT_FAILED')).toBe('PAYOUTS');
  });

  it('classifies PAYOUT_REVERSED as PAYOUTS', () => {
    expect(getLedgerTypeGroup('PAYOUT_REVERSED')).toBe('PAYOUTS');
  });

  it('classifies REFUND_FULL as REFUNDS', () => {
    expect(getLedgerTypeGroup('REFUND_FULL')).toBe('REFUNDS');
  });

  it('classifies REFUND_PARTIAL as REFUNDS', () => {
    expect(getLedgerTypeGroup('REFUND_PARTIAL')).toBe('REFUNDS');
  });

  it('classifies REFUND_TF_REVERSAL as REFUNDS', () => {
    expect(getLedgerTypeGroup('REFUND_TF_REVERSAL')).toBe('REFUNDS');
  });

  it('classifies REFUND_BOOST_REVERSAL as REFUNDS', () => {
    expect(getLedgerTypeGroup('REFUND_BOOST_REVERSAL')).toBe('REFUNDS');
  });

  it('classifies REFUND_STRIPE_REVERSAL as REFUNDS', () => {
    expect(getLedgerTypeGroup('REFUND_STRIPE_REVERSAL')).toBe('REFUNDS');
  });

  it('classifies AUTH_FEE_REFUND as REFUNDS', () => {
    expect(getLedgerTypeGroup('AUTH_FEE_REFUND')).toBe('REFUNDS');
  });

  it('classifies CHARGEBACK_REVERSAL as REFUNDS', () => {
    expect(getLedgerTypeGroup('CHARGEBACK_REVERSAL')).toBe('REFUNDS');
  });

  it('classifies MANUAL_CREDIT as OTHER', () => {
    expect(getLedgerTypeGroup('MANUAL_CREDIT')).toBe('OTHER');
  });

  it('classifies MANUAL_DEBIT as OTHER', () => {
    expect(getLedgerTypeGroup('MANUAL_DEBIT')).toBe('OTHER');
  });

  it('classifies RESERVE_HOLD as OTHER', () => {
    expect(getLedgerTypeGroup('RESERVE_HOLD')).toBe('OTHER');
  });

  it('classifies RESERVE_RELEASE as OTHER', () => {
    expect(getLedgerTypeGroup('RESERVE_RELEASE')).toBe('OTHER');
  });

  it('classifies SHIPPING_LABEL_PURCHASE as OTHER', () => {
    expect(getLedgerTypeGroup('SHIPPING_LABEL_PURCHASE')).toBe('OTHER');
  });

  it('classifies SHIPPING_LABEL_REFUND as OTHER', () => {
    expect(getLedgerTypeGroup('SHIPPING_LABEL_REFUND')).toBe('OTHER');
  });

  it('classifies AFFILIATE_COMMISSION_PAYOUT as OTHER', () => {
    expect(getLedgerTypeGroup('AFFILIATE_COMMISSION_PAYOUT')).toBe('OTHER');
  });

  it('classifies CHARGEBACK_DEBIT as OTHER (not REFUNDS)', () => {
    // Chargeback debit is a cost, not a refund — goes to OTHER
    expect(getLedgerTypeGroup('CHARGEBACK_DEBIT')).toBe('OTHER');
  });

  it('classifies SELLER_ADJUSTMENT as OTHER', () => {
    expect(getLedgerTypeGroup('SELLER_ADJUSTMENT')).toBe('OTHER');
  });

  it('classifies BUYER_REFERRAL_CREDIT_ISSUED as OTHER', () => {
    expect(getLedgerTypeGroup('BUYER_REFERRAL_CREDIT_ISSUED')).toBe('OTHER');
  });

  it('classifies unknown type as OTHER (fallback)', () => {
    expect(getLedgerTypeGroup('TOTALLY_UNKNOWN_TYPE')).toBe('OTHER');
  });

  it('each group is mutually exclusive — ORDER_PAYMENT_CAPTURED is only SALES not FEES', () => {
    const salesGroup = getLedgerTypeGroup('ORDER_PAYMENT_CAPTURED');
    const feesGroup = getLedgerTypeGroup('ORDER_TF_FEE');
    expect(salesGroup).toBe('SALES');
    expect(feesGroup).toBe('FEES');
    expect(salesGroup).not.toBe(feesGroup);
  });
});
