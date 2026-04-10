import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ------------------------------------------------------------------

const mockSelectResult: unknown[] = [];
const mockTxSelectResult: unknown[] = [];

const mockDbChain = () => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(mockSelectResult),
    }),
  }),
});

const mockTxChain = () => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(mockTxSelectResult),
    }),
  }),
});

const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

const mockUpdateSet = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockImplementation(mockDbChain),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    })),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockImplementation(mockTxChain),
        update: mockUpdate,
        insert: mockInsert,
      };
      return cb(tx);
    }),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  promotionCampaign: {
    id: 'id', status: 'status', budgetCents: 'budget_cents',
    spentCents: 'spent_cents', autoDisableOnExhaust: 'auto_disable_on_exhaust',
    budgetAlertPct: 'budget_alert_pct', updatedAt: 'updated_at',
  },
  campaignBudgetLog: {
    campaignId: 'campaign_id', action: 'action', amountCents: 'amount_cents',
    balanceCents: 'balance_cents', orderId: 'order_id', staffId: 'staff_id', reason: 'reason',
  },
  campaignPromotion: { campaignId: 'campaign_id', promotionId: 'promotion_id' },
  scheduledPromoTask: { id: 'id', campaignId: 'campaign_id', status: 'status' },
  promotionUsage: {
    id: 'id', promotionId: 'promotion_id', orderId: 'order_id',
    discountCents: 'discount_cents', buyerId: 'buyer_id',
  },
  promotion: { id: 'id', isActive: 'is_active', updatedAt: 'updated_at' },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: 'inArray', args })),
  sql: Object.assign(vi.fn((...args: unknown[]) => ({ op: 'sql', args })), {
    raw: vi.fn(),
  }),
}));

// Mock campaign-lifecycle to avoid its own DB calls
vi.mock('../campaign-lifecycle', () => ({
  updateCampaignStatus: vi.fn().mockResolvedValue({ success: true }),
}));

// --- Tests ------------------------------------------------------------------

describe('V4-06: Campaign Budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult.length = 0;
    mockTxSelectResult.length = 0;
  });

  describe('recordPromotionSpend', () => {
    it('returns error when campaign not found in transaction', async () => {
      mockTxSelectResult.length = 0;

      const { recordPromotionSpend } = await import('../campaign-budget');
      const result = await recordPromotionSpend({
        campaignId: 'c1',
        promotionId: 'p1',
        orderId: 'o1',
        buyerId: 'b1',
        discountCents: 500,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Campaign not found');
    });

    it('returns error when campaign is not active', async () => {
      mockTxSelectResult.push({
        id: 'c1', status: 'PAUSED', budgetCents: 10000,
        spentCents: 0, autoDisableOnExhaust: true, budgetAlertPct: 80,
      });

      const { recordPromotionSpend } = await import('../campaign-budget');
      const result = await recordPromotionSpend({
        campaignId: 'c1',
        promotionId: 'p1',
        orderId: 'o1',
        buyerId: 'b1',
        discountCents: 500,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Campaign is not active');
    });

    it('records spend successfully for active campaign', async () => {
      mockTxSelectResult.push({
        id: 'c1', status: 'ACTIVE', budgetCents: 10000,
        spentCents: 0, autoDisableOnExhaust: true, budgetAlertPct: 80,
      });

      mockSelectResult.push({ autoDisableOnExhaust: true });

      const { recordPromotionSpend } = await import('../campaign-budget');
      const result = await recordPromotionSpend({
        campaignId: 'c1',
        promotionId: 'p1',
        orderId: 'o1',
        buyerId: 'b1',
        discountCents: 500,
      });

      expect(result.success).toBe(true);
      expect(result.exhausted).toBe(false);
    });

    it('detects budget exhaustion when spend exceeds budget', async () => {
      mockTxSelectResult.push({
        id: 'c1', status: 'ACTIVE', budgetCents: 1000,
        spentCents: 900, autoDisableOnExhaust: true, budgetAlertPct: 80,
      });

      mockSelectResult.push({ autoDisableOnExhaust: true });

      const { recordPromotionSpend } = await import('../campaign-budget');
      const result = await recordPromotionSpend({
        campaignId: 'c1',
        promotionId: 'p1',
        orderId: 'o1',
        buyerId: 'b1',
        discountCents: 200,
      });

      expect(result.success).toBe(true);
      expect(result.exhausted).toBe(true);
    });
  });

  describe('adjustCampaignBudget', () => {
    it('rejects negative budget', async () => {
      const { adjustCampaignBudget } = await import('../campaign-budget');
      const result = await adjustCampaignBudget({
        campaignId: 'c1',
        newBudgetCents: -100,
        staffId: 'staff-1',
        reason: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Budget cannot be negative');
    });

    it('returns error when campaign not found', async () => {
      mockSelectResult.length = 0;

      const { adjustCampaignBudget } = await import('../campaign-budget');
      const result = await adjustCampaignBudget({
        campaignId: 'nonexistent',
        newBudgetCents: 5000,
        staffId: 'staff-1',
        reason: 'Increase',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Campaign not found');
    });
  });

  describe('refundPromotionSpend', () => {
    it('returns error when no usage found', async () => {
      mockSelectResult.length = 0;

      const { refundPromotionSpend } = await import('../campaign-budget');
      const result = await refundPromotionSpend({
        orderId: 'unknown-order',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No promotion usage found for this order');
    });
  });
});
