import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn() }));

describe('Shipping Exceptions Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Module exports', () => {
    it('exports expected functions', async () => {
      const mod = await import('@twicely/commerce/shipping-exceptions');

      expect(typeof mod.detectShippingException).toBe('function');
      expect(typeof mod.autoCreateClaim).toBe('function');
      expect(typeof mod.scanForShippingExceptions).toBe('function');
      expect(typeof mod.getShippingStatus).toBe('function');
    });
  });
});
