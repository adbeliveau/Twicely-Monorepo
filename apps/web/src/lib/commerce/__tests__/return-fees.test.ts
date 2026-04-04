import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));

describe('Return Fees Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Constants', () => {
    it('defines correct fee percentages and limits', async () => {
      const {
        DEFAULT_RESTOCKING_FEE_PERCENT,
        DEFAULT_RESTOCKING_FEE_MAX_CENTS,
        DEFAULT_RESTOCKING_FEE_MIN_CENTS,
        DEFAULT_TF_REFUND_REMORSE_PERCENT,
      } = await import('@/lib/commerce/return-fees');

      expect(DEFAULT_RESTOCKING_FEE_PERCENT).toBe(0.10);
      expect(DEFAULT_RESTOCKING_FEE_MAX_CENTS).toBe(5000); // $50
      expect(DEFAULT_RESTOCKING_FEE_MIN_CENTS).toBe(100); // $1
      expect(DEFAULT_TF_REFUND_REMORSE_PERCENT).toBe(0.50);
    });
  });

  describe('calculateRestockingFee', () => {
    it('calculates 10% of item price', async () => {
      const { calculateRestockingFee } = await import('@/lib/commerce/return-fees');

      expect(calculateRestockingFee(10000)).toBe(1000); // 10% of $100
      expect(calculateRestockingFee(5000)).toBe(500); // 10% of $50
    });

    it('respects minimum of $1 for small orders', async () => {
      const { calculateRestockingFee, DEFAULT_RESTOCKING_FEE_MIN_CENTS } = await import('@/lib/commerce/return-fees');

      expect(calculateRestockingFee(500)).toBe(DEFAULT_RESTOCKING_FEE_MIN_CENTS); // 10% would be $0.50
      expect(calculateRestockingFee(100)).toBe(DEFAULT_RESTOCKING_FEE_MIN_CENTS); // 10% would be $0.10
    });

    it('respects maximum of $50 for large orders', async () => {
      const { calculateRestockingFee, DEFAULT_RESTOCKING_FEE_MAX_CENTS } = await import('@/lib/commerce/return-fees');

      expect(calculateRestockingFee(100000)).toBe(DEFAULT_RESTOCKING_FEE_MAX_CENTS); // 10% would be $100
      expect(calculateRestockingFee(200000)).toBe(DEFAULT_RESTOCKING_FEE_MAX_CENTS); // 10% would be $200
    });
  });

  describe('getReasonBucket', () => {
    it('returns SELLER_FAULT for seller fault reasons', async () => {
      const { getReasonBucket } = await import('@/lib/commerce/return-fees');

      expect(getReasonBucket('INAD')).toBe('SELLER_FAULT');
      expect(getReasonBucket('WRONG_ITEM')).toBe('SELLER_FAULT');
      expect(getReasonBucket('COUNTERFEIT')).toBe('SELLER_FAULT');
      expect(getReasonBucket('INR')).toBe('SELLER_FAULT');
    });

    it('returns BUYER_REMORSE for remorse', async () => {
      const { getReasonBucket } = await import('@/lib/commerce/return-fees');
      expect(getReasonBucket('REMORSE')).toBe('BUYER_REMORSE');
    });

    it('returns PLATFORM_CARRIER_FAULT for damaged', async () => {
      const { getReasonBucket } = await import('@/lib/commerce/return-fees');
      expect(getReasonBucket('DAMAGED')).toBe('PLATFORM_CARRIER_FAULT');
    });
  });

  describe('getReturnShippingPayer', () => {
    it('returns SELLER for seller fault reasons', async () => {
      const { getReturnShippingPayer } = await import('@/lib/commerce/return-fees');

      expect(getReturnShippingPayer('INAD')).toBe('SELLER');
      expect(getReturnShippingPayer('WRONG_ITEM')).toBe('SELLER');
      expect(getReturnShippingPayer('COUNTERFEIT')).toBe('SELLER');
    });

    it('returns BUYER for remorse', async () => {
      const { getReturnShippingPayer } = await import('@/lib/commerce/return-fees');
      expect(getReturnShippingPayer('REMORSE')).toBe('BUYER');
    });

    it('returns PLATFORM for damaged', async () => {
      const { getReturnShippingPayer } = await import('@/lib/commerce/return-fees');
      expect(getReturnShippingPayer('DAMAGED')).toBe('PLATFORM');
    });

    it('returns null for INR (no return needed)', async () => {
      const { getReturnShippingPayer } = await import('@/lib/commerce/return-fees');
      expect(getReturnShippingPayer('INR')).toBe(null);
    });
  });

  describe('calculateTfRefund', () => {
    it('returns 100% TF refund for seller fault', async () => {
      const { calculateTfRefund } = await import('@/lib/commerce/return-fees');

      expect(calculateTfRefund(500, 'SELLER_FAULT')).toBe(500);
    });

    it('returns 50% TF refund for buyer remorse', async () => {
      const { calculateTfRefund } = await import('@/lib/commerce/return-fees');

      expect(calculateTfRefund(500, 'BUYER_REMORSE')).toBe(250);
      expect(calculateTfRefund(1000, 'BUYER_REMORSE')).toBe(500);
    });

    it('returns 100% TF refund for platform/carrier fault', async () => {
      const { calculateTfRefund } = await import('@/lib/commerce/return-fees');

      expect(calculateTfRefund(500, 'PLATFORM_CARRIER_FAULT')).toBe(500);
    });

    it('returns 100% TF refund for edge cases', async () => {
      const { calculateTfRefund } = await import('@/lib/commerce/return-fees');

      expect(calculateTfRefund(500, 'EDGE_CONDITIONAL')).toBe(500);
    });
  });
});
