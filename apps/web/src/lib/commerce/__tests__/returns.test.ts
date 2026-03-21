import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock helpers
const mockDb = { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
const mockNotify = vi.fn();
const mockProcessReturnRefund = vi.fn().mockResolvedValue({ success: true });

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));
vi.mock('@twicely/stripe/refunds', () => ({ processReturnRefund: mockProcessReturnRefund }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

describe('Returns Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('isWithinReturnWindow', () => {
    it('returns true when within 30 days of delivery', async () => {
      const { isWithinReturnWindow } = await import('@/lib/commerce/returns');
      const deliveredAt = new Date();
      deliveredAt.setDate(deliveredAt.getDate() - 15); // 15 days ago

      await expect(isWithinReturnWindow(deliveredAt, 'INAD')).resolves.toBe(true);
    });

    it('returns false when beyond 30 days for standard reasons', async () => {
      const { isWithinReturnWindow } = await import('@/lib/commerce/returns');
      const deliveredAt = new Date();
      deliveredAt.setDate(deliveredAt.getDate() - 35); // 35 days ago

      await expect(isWithinReturnWindow(deliveredAt, 'INAD')).resolves.toBe(false);
    });

    it('returns true for counterfeit within 60 days', async () => {
      const { isWithinReturnWindow } = await import('@/lib/commerce/returns');
      const deliveredAt = new Date();
      deliveredAt.setDate(deliveredAt.getDate() - 45); // 45 days ago

      await expect(isWithinReturnWindow(deliveredAt, 'COUNTERFEIT')).resolves.toBe(true);
    });

    it('returns false for counterfeit beyond 60 days', async () => {
      const { isWithinReturnWindow } = await import('@/lib/commerce/returns');
      const deliveredAt = new Date();
      deliveredAt.setDate(deliveredAt.getDate() - 65); // 65 days ago

      await expect(isWithinReturnWindow(deliveredAt, 'COUNTERFEIT')).resolves.toBe(false);
    });

    it('returns false when no delivery date', async () => {
      const { isWithinReturnWindow } = await import('@/lib/commerce/returns');
      await expect(isWithinReturnWindow(null, 'INAD')).resolves.toBe(false);
    });
  });

  describe('calculateSellerResponseDue', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-13T10:00:00Z')); // Monday 10am UTC
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns date 3 business days from now', async () => {
      const { calculateSellerResponseDue } = await import('@/lib/commerce/returns');
      const dueDate = await calculateSellerResponseDue();
      const now = new Date();

      // Should be at least 3 days away
      const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      expect(daysDiff).toBeGreaterThanOrEqual(3);

      // Hour should be 17:00 (5pm) local time
      expect(dueDate.getHours()).toBe(17);
    });
  });

  describe('REASON_FAULT_MAP', () => {
    it('maps seller fault reasons correctly', async () => {
      const { REASON_FAULT_MAP } = await import('@/lib/commerce/returns');

      expect(REASON_FAULT_MAP.INAD).toBe('SELLER');
      expect(REASON_FAULT_MAP.WRONG_ITEM).toBe('SELLER');
      expect(REASON_FAULT_MAP.COUNTERFEIT).toBe('SELLER');
      expect(REASON_FAULT_MAP.INR).toBe('SELLER');
    });

    it('maps buyer remorse correctly', async () => {
      const { REASON_FAULT_MAP } = await import('@/lib/commerce/returns');
      expect(REASON_FAULT_MAP.REMORSE).toBe('BUYER');
    });

    it('maps damaged to carrier fault', async () => {
      const { REASON_FAULT_MAP } = await import('@/lib/commerce/returns');
      expect(REASON_FAULT_MAP.DAMAGED).toBe('CARRIER');
    });
  });

  describe('REASON_BUCKET_MAP', () => {
    it('maps reasons to correct buckets', async () => {
      const { REASON_BUCKET_MAP } = await import('@/lib/commerce/returns');

      expect(REASON_BUCKET_MAP.INAD).toBe('SELLER_FAULT');
      expect(REASON_BUCKET_MAP.COUNTERFEIT).toBe('SELLER_FAULT');
      expect(REASON_BUCKET_MAP.REMORSE).toBe('BUYER_REMORSE');
      expect(REASON_BUCKET_MAP.DAMAGED).toBe('PLATFORM_CARRIER_FAULT');
      expect(REASON_BUCKET_MAP.INR).toBe('SELLER_FAULT'); // INR is seller's fault (didn't ship)
      expect(REASON_BUCKET_MAP.WRONG_ITEM).toBe('SELLER_FAULT');
    });
  });

  describe('RETURN_SHIPPING_PAYER', () => {
    it('maps return shipping responsibility correctly', async () => {
      const { RETURN_SHIPPING_PAYER } = await import('@/lib/commerce/returns');

      expect(RETURN_SHIPPING_PAYER.INAD).toBe('SELLER');
      expect(RETURN_SHIPPING_PAYER.COUNTERFEIT).toBe('SELLER');
      expect(RETURN_SHIPPING_PAYER.REMORSE).toBe('BUYER');
      expect(RETURN_SHIPPING_PAYER.DAMAGED).toBe('PLATFORM');
      expect(RETURN_SHIPPING_PAYER.INR).toBe('N/A'); // No return needed for INR
    });
  });

  describe('Configurable Settings (platform_settings)', () => {
    it('returns correct default return window days', async () => {
      const { getReturnWindowDays, getCounterfeitWindowDays, getSellerResponseDays } = await import('@/lib/commerce/returns');

      await expect(getReturnWindowDays()).resolves.toBe(30);
      await expect(getCounterfeitWindowDays()).resolves.toBe(60);
      await expect(getSellerResponseDays()).resolves.toBe(3);
    });
  });

  describe('isValidINRClaim', () => {
    it('returns true when order not delivered', async () => {
      const { isValidINRClaim } = await import('@/lib/commerce/returns');

      expect(isValidINRClaim(null, null)).toBe(true);
    });

    it('returns false when order already delivered', async () => {
      const { isValidINRClaim } = await import('@/lib/commerce/returns');

      expect(isValidINRClaim(new Date(), null)).toBe(false);
    });

    it('returns false when before expected delivery', async () => {
      const { isValidINRClaim } = await import('@/lib/commerce/returns');
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      expect(isValidINRClaim(null, futureDate)).toBe(false);
    });

    it('returns true when past expected delivery', async () => {
      const { isValidINRClaim } = await import('@/lib/commerce/returns');
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      expect(isValidINRClaim(null, pastDate)).toBe(true);
    });
  });

  describe('P0 Wiring: markReturnReceived calls processReturnRefund', () => {
    it('calls processReturnRefund after marking return as DELIVERED', async () => {
      // Setup mocks for the full flow - status must be 'SHIPPED'
      const returnReq = {
        id: 'ret1',
        orderId: 'ord1',
        sellerId: 'seller1',
        buyerId: 'buyer1',
        status: 'SHIPPED',
      };
      const orderData = { orderNumber: 'TW-123456' };

      // Use fresh mock function to chain calls properly
      const selectMock = vi.fn();
      selectMock.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([returnReq])),
          })),
        })),
      });
      selectMock.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([orderData])),
          })),
        })),
      });
      mockDb.select = selectMock;

      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
        })),
      });

      mockNotify.mockResolvedValue(undefined);
      mockProcessReturnRefund.mockResolvedValue({ success: true });

      const { markReturnReceived } = await import('@/lib/commerce/returns');
      const result = await markReturnReceived('seller1', 'ret1');

      expect(result.success).toBe(true);
      expect(mockProcessReturnRefund).toHaveBeenCalledWith({ returnId: 'ret1' });
    });

    it('still returns success if processReturnRefund fails (logs error)', async () => {
      const returnReq = {
        id: 'ret1',
        orderId: 'ord1',
        sellerId: 'seller1',
        buyerId: 'buyer1',
        status: 'SHIPPED',
      };
      const orderData = { orderNumber: 'TW-123456' };

      const selectMock = vi.fn();
      selectMock.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([returnReq])),
          })),
        })),
      });
      selectMock.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([orderData])),
          })),
        })),
      });
      mockDb.select = selectMock;

      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
        })),
      });

      mockNotify.mockResolvedValue(undefined);
      mockProcessReturnRefund.mockResolvedValue({ success: false, error: 'Stripe error' });

      const { markReturnReceived } = await import('@/lib/commerce/returns');
      const result = await markReturnReceived('seller1', 'ret1');

      expect(result.success).toBe(true);
      expect(mockProcessReturnRefund).toHaveBeenCalled();
    });

    it('does not call processReturnRefund if return is not in SHIPPED status', async () => {
      const returnReq = {
        id: 'ret1',
        orderId: 'ord1',
        sellerId: 'seller1',
        buyerId: 'buyer1',
        status: 'APPROVED', // Wrong status - should be SHIPPED
      };

      mockDb.select = vi.fn().mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([returnReq])),
          })),
        })),
      });

      const { markReturnReceived } = await import('@/lib/commerce/returns');
      const result = await markReturnReceived('seller1', 'ret1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('shipped before marking');
      expect(mockProcessReturnRefund).not.toHaveBeenCalled();
    });
  });
});
