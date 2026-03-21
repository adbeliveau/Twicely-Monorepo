import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPlatformSetting = vi.fn();

vi.mock('@twicely/db', () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn() }));
vi.mock('@twicely/stripe/server', () => ({ stripe: { refunds: { create: vi.fn() } } }));
vi.mock('@twicely/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

function setupClaimWindowDefaults() {
  mockGetPlatformSetting
    .mockResolvedValueOnce(30)   // standardClaimWindowDays
    .mockResolvedValueOnce(60);  // counterfeitClaimWindowDays
}

describe('Buyer Protection Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('isWithinClaimWindow', () => {
    it('returns true for INR without delivery date', async () => {
      setupClaimWindowDefaults();
      const { isWithinClaimWindow } = await import('@/lib/commerce/buyer-protection');

      const result = await isWithinClaimWindow(null, 'INR');
      expect(result.withinWindow).toBe(true);
      expect(result.daysRemaining).toBe(30);
    });

    it('returns true within 30 days for standard claims', async () => {
      setupClaimWindowDefaults();
      const { isWithinClaimWindow } = await import('@/lib/commerce/buyer-protection');
      const deliveredAt = new Date();
      deliveredAt.setDate(deliveredAt.getDate() - 15);

      const result = await isWithinClaimWindow(deliveredAt, 'INAD');
      expect(result.withinWindow).toBe(true);
      expect(result.daysRemaining).toBeGreaterThan(0);
    });

    it('returns false after 30 days for standard claims', async () => {
      setupClaimWindowDefaults();
      const { isWithinClaimWindow } = await import('@/lib/commerce/buyer-protection');
      const deliveredAt = new Date();
      deliveredAt.setDate(deliveredAt.getDate() - 35);

      const result = await isWithinClaimWindow(deliveredAt, 'INAD');
      expect(result.withinWindow).toBe(false);
      expect(result.daysRemaining).toBe(0);
    });

    it('allows 60 days for counterfeit claims', async () => {
      setupClaimWindowDefaults();
      const { isWithinClaimWindow, DEFAULT_COUNTERFEIT_CLAIM_WINDOW_DAYS } = await import('@/lib/commerce/buyer-protection');
      const deliveredAt = new Date();
      deliveredAt.setDate(deliveredAt.getDate() - 45);

      const result = await isWithinClaimWindow(deliveredAt, 'COUNTERFEIT');
      expect(result.withinWindow).toBe(true);
      expect(DEFAULT_COUNTERFEIT_CLAIM_WINDOW_DAYS).toBe(60);
    });

    it('returns false after 60 days for counterfeit', async () => {
      setupClaimWindowDefaults();
      const { isWithinClaimWindow } = await import('@/lib/commerce/buyer-protection');
      const deliveredAt = new Date();
      deliveredAt.setDate(deliveredAt.getDate() - 65);

      const result = await isWithinClaimWindow(deliveredAt, 'COUNTERFEIT');
      expect(result.withinWindow).toBe(false);
    });

    it('returns false for non-INR claims without delivery date', async () => {
      setupClaimWindowDefaults();
      const { isWithinClaimWindow } = await import('@/lib/commerce/buyer-protection');

      const result = await isWithinClaimWindow(null, 'INAD');
      expect(result.withinWindow).toBe(false);
    });
  });

  describe('PROTECTION_ELIGIBLE_REASONS', () => {
    it('includes the correct claim types', async () => {
      const { PROTECTION_ELIGIBLE_REASONS } = await import('@/lib/commerce/buyer-protection');

      expect(PROTECTION_ELIGIBLE_REASONS).toContain('INAD');
      expect(PROTECTION_ELIGIBLE_REASONS).toContain('DAMAGED');
      expect(PROTECTION_ELIGIBLE_REASONS).toContain('WRONG_ITEM');
      expect(PROTECTION_ELIGIBLE_REASONS).toContain('INR');
      expect(PROTECTION_ELIGIBLE_REASONS).toContain('COUNTERFEIT');
    });

    it('has exactly 5 eligible reasons', async () => {
      const { PROTECTION_ELIGIBLE_REASONS } = await import('@/lib/commerce/buyer-protection');
      expect(PROTECTION_ELIGIBLE_REASONS).toHaveLength(5);
    });
  });

  describe('Constants', () => {
    it('defines correct default claim window days', async () => {
      const { DEFAULT_STANDARD_CLAIM_WINDOW_DAYS, DEFAULT_COUNTERFEIT_CLAIM_WINDOW_DAYS } = await import('@/lib/commerce/buyer-protection');

      expect(DEFAULT_STANDARD_CLAIM_WINDOW_DAYS).toBe(30);
      expect(DEFAULT_COUNTERFEIT_CLAIM_WINDOW_DAYS).toBe(60);
    });

    it('reads claim windows from platform_settings via getClaimWindows()', async () => {
      mockGetPlatformSetting
        .mockResolvedValueOnce(45)   // custom standard window
        .mockResolvedValueOnce(90);  // custom counterfeit window
      const { getClaimWindows } = await import('@/lib/commerce/buyer-protection');

      const windows = await getClaimWindows();
      expect(windows.standardDays).toBe(45);
      expect(windows.counterfeitDays).toBe(90);
    });
  });
});
