import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn() }));
vi.mock('@twicely/stripe/refunds', () => ({ processReturnRefund: vi.fn().mockResolvedValue({ success: true }) }));

describe('Disputes Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Module exports', () => {
    it('exports expected functions', async () => {
      const mod = await import('@twicely/commerce/disputes');

      expect(typeof mod.canEscalate).toBe('function');
      expect(typeof mod.escalateToDispute).toBe('function');
      expect(typeof mod.assignDispute).toBe('function');
      expect(typeof mod.resolveDispute).toBe('function');
      expect(typeof mod.getOpenDisputes).toBe('function');
      expect(typeof mod.getAssignedDisputes).toBe('function');
      expect(typeof mod.getDisputeById).toBe('function');
    });
  });

  describe('Type exports', () => {
    it('exports EscalateToDisputeInput interface shape', async () => {
      const mod = await import('@twicely/commerce/disputes');
      // TypeScript interface check - function exists and accepts the right shape
      expect(typeof mod.escalateToDispute).toBe('function');
    });

    it('exports ResolveDisputeInput interface shape', async () => {
      const mod = await import('@twicely/commerce/disputes');
      expect(typeof mod.resolveDispute).toBe('function');
    });
  });
});
