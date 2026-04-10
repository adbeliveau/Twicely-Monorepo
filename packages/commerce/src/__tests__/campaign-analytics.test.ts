import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const callIndex = { value: 0 };
  return { callIndex, selectResults: [] as unknown[][] };
});

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        const idx = mocks.callIndex.value++;
        const result = mocks.selectResults[idx] ?? [];
        const thenableResult = Object.assign(Promise.resolve(result), {
          limit: vi.fn().mockResolvedValue(result),
          where: vi.fn().mockImplementation(() => {
            const whereResult = Object.assign(Promise.resolve(result), {
              limit: vi.fn().mockResolvedValue(result),
            });
            return whereResult;
          }),
        });
        return thenableResult;
      }),
    })),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  promotionCampaign: {
    id: 'id', name: 'name', status: 'status', campaignType: 'campaign_type',
    budgetCents: 'budget_cents', spentCents: 'spent_cents',
    startsAt: 'starts_at', endsAt: 'ends_at',
  },
  campaignPromotion: { id: 'id', campaignId: 'campaign_id', promotionId: 'promotion_id' },
  campaignBudgetLog: { id: 'id', campaignId: 'campaign_id' },
  promotionUsage: {
    id: 'id', promotionId: 'promotion_id', discountCents: 'discount_cents', buyerId: 'buyer_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  count: vi.fn(() => 'count'),
  sql: Object.assign(vi.fn((...args: unknown[]) => args), {
    raw: vi.fn((v: unknown) => v),
  }),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

// --- Tests ------------------------------------------------------------------

describe('V4-06: Campaign Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callIndex.value = 0;
    mocks.selectResults.length = 0;
  });

  describe('getCampaignAnalytics', () => {
    it('returns null when campaign not found', async () => {
      // Call 0: campaign select → empty
      mocks.selectResults[0] = [];

      const { getCampaignAnalytics } = await import('../campaign-analytics');
      const result = await getCampaignAnalytics('nonexistent');
      expect(result).toBeNull();
    });

    it('returns correct analytics for campaign with budget', async () => {
      // Call 0: campaign select
      mocks.selectResults[0] = [{
        id: 'camp-1', name: 'Flash Sale', status: 'ACTIVE', campaignType: 'FLASH_SALE',
        budgetCents: 100000, spentCents: 50000,
        startsAt: new Date('2026-01-01'), endsAt: new Date('2026-01-31'),
      }];
      // Call 1: promo count
      mocks.selectResults[1] = [{ value: 3 }];
      // Call 2: links
      mocks.selectResults[2] = [{ promotionId: 'p1' }, { promotionId: 'p2' }];
      // Call 3: usage aggregate
      mocks.selectResults[3] = [{ redemptions: 25, discountTotal: 45000, buyers: 20 }];

      const { getCampaignAnalytics } = await import('../campaign-analytics');
      const result = await getCampaignAnalytics('camp-1');

      expect(result).not.toBeNull();
      expect(result!.campaignId).toBe('camp-1');
      expect(result!.spendPct).toBe(50);
      expect(result!.remainingCents).toBe(50000);
    });

    it('returns null spend/remaining when campaign has no budget', async () => {
      mocks.selectResults[0] = [{
        id: 'camp-2', name: 'No Budget', status: 'ACTIVE', campaignType: 'PLATFORM_WIDE',
        budgetCents: null, spentCents: 0,
        startsAt: new Date('2026-01-01'), endsAt: new Date('2026-06-30'),
      }];
      mocks.selectResults[1] = [{ value: 0 }];
      mocks.selectResults[2] = [];

      const { getCampaignAnalytics } = await import('../campaign-analytics');
      const result = await getCampaignAnalytics('camp-2');

      expect(result).not.toBeNull();
      expect(result!.spendPct).toBeNull();
      expect(result!.remainingCents).toBeNull();
    });

    it('counts linked promotions correctly', async () => {
      mocks.selectResults[0] = [{
        id: 'camp-3', name: 'Test', status: 'ACTIVE', campaignType: 'SEASONAL',
        budgetCents: 10000, spentCents: 0,
        startsAt: new Date('2026-01-01'), endsAt: new Date('2026-01-31'),
      }];
      mocks.selectResults[1] = [{ value: 5 }];
      mocks.selectResults[2] = [];

      const { getCampaignAnalytics } = await import('../campaign-analytics');
      const result = await getCampaignAnalytics('camp-3');

      expect(result!.linkedPromotionCount).toBe(5);
    });

    it('deduplicates unique buyers', async () => {
      mocks.selectResults[0] = [{
        id: 'camp-4', name: 'Buyers Test', status: 'COMPLETED', campaignType: 'BUNDLE_DISCOUNT',
        budgetCents: 50000, spentCents: 50000,
        startsAt: new Date('2026-01-01'), endsAt: new Date('2026-01-15'),
      }];
      mocks.selectResults[1] = [{ value: 1 }];
      mocks.selectResults[2] = [{ promotionId: 'p1' }];
      mocks.selectResults[3] = [{ redemptions: 10, discountTotal: 20000, buyers: 7 }];

      const { getCampaignAnalytics } = await import('../campaign-analytics');
      const result = await getCampaignAnalytics('camp-4');

      expect(result!.uniqueBuyers).toBe(7);
      expect(result!.totalRedemptions).toBe(10);
    });
  });
});
