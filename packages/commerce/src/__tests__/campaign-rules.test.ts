import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockSelectResult: [] as unknown[],
  mockInsertReturning: vi.fn().mockResolvedValue([{ id: 'rule-1' }]),
  mockDeleteWhere: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockImplementation((cols?: unknown) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mocks.mockSelectResult),
      }),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: mocks.mockInsertReturning,
      }),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: mocks.mockDeleteWhere,
    })),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  campaignRule: {
    id: 'id', campaignId: 'campaign_id', ruleType: 'rule_type',
    condition: 'condition', isActive: 'is_active', createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

// --- Tests ------------------------------------------------------------------

describe('V4-06: Campaign Rules Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSelectResult.length = 0;
  });

  describe('evaluateCampaignRules', () => {
    it('returns eligible when no rules exist', async () => {
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 0,
        categoryIds: [],
        listingIds: [],
      });
      expect(result.eligible).toBe(true);
      expect(result.failedRules).toEqual([]);
    });

    it('min_order: passes when orderTotal >= minCents', async () => {
      mocks.mockSelectResult.push({
        id: 'r1', ruleType: 'min_order', condition: { minCents: 3000 },
      });
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 0,
        categoryIds: [],
        listingIds: [],
      });
      expect(result.eligible).toBe(true);
    });

    it('min_order: fails when orderTotal < minCents', async () => {
      mocks.mockSelectResult.push({
        id: 'r1', ruleType: 'min_order', condition: { minCents: 10000 },
      });
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 0,
        categoryIds: [],
        listingIds: [],
      });
      expect(result.eligible).toBe(false);
      expect(result.failedRules).toContain('min_order');
    });

    it('category_match: passes with intersection', async () => {
      mocks.mockSelectResult.push({
        id: 'r1', ruleType: 'category_match', condition: { categoryIds: ['cat-1', 'cat-2'] },
      });
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 0,
        categoryIds: ['cat-2', 'cat-3'],
        listingIds: [],
      });
      expect(result.eligible).toBe(true);
    });

    it('category_match: fails without intersection', async () => {
      mocks.mockSelectResult.push({
        id: 'r1', ruleType: 'category_match', condition: { categoryIds: ['cat-1', 'cat-2'] },
      });
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 0,
        categoryIds: ['cat-3', 'cat-4'],
        listingIds: [],
      });
      expect(result.eligible).toBe(false);
      expect(result.failedRules).toContain('category_match');
    });

    it('listing_set: passes with matching listing', async () => {
      mocks.mockSelectResult.push({
        id: 'r1', ruleType: 'listing_set', condition: { listingIds: ['lst-1'] },
      });
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 0,
        categoryIds: [],
        listingIds: ['lst-1', 'lst-2'],
      });
      expect(result.eligible).toBe(true);
    });

    it('seller_tier: passes when tier >= minTier', async () => {
      mocks.mockSelectResult.push({
        id: 'r1', ruleType: 'seller_tier', condition: { minTier: 'PRO' },
      });
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 0,
        categoryIds: [],
        listingIds: [],
        sellerTier: 'PREMIUM',
      });
      expect(result.eligible).toBe(true);
    });

    it('seller_tier: fails when tier < minTier', async () => {
      mocks.mockSelectResult.push({
        id: 'r1', ruleType: 'seller_tier', condition: { minTier: 'PRO' },
      });
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 0,
        categoryIds: [],
        listingIds: [],
        sellerTier: 'BASIC',
      });
      expect(result.eligible).toBe(false);
      expect(result.failedRules).toContain('seller_tier');
    });

    it('new_user_only: passes when orderCount = 0', async () => {
      mocks.mockSelectResult.push({
        id: 'r1', ruleType: 'new_user_only', condition: { maxOrderCount: 0 },
      });
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 0,
        categoryIds: [],
        listingIds: [],
      });
      expect(result.eligible).toBe(true);
    });

    it('new_user_only: fails when orderCount > maxOrderCount', async () => {
      mocks.mockSelectResult.push({
        id: 'r1', ruleType: 'new_user_only', condition: { maxOrderCount: 0 },
      });
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 3,
        categoryIds: [],
        listingIds: [],
      });
      expect(result.eligible).toBe(false);
      expect(result.failedRules).toContain('new_user_only');
    });

    it('all rules must pass for eligible = true', async () => {
      mocks.mockSelectResult.push(
        { id: 'r1', ruleType: 'min_order', condition: { minCents: 1000 } },
        { id: 'r2', ruleType: 'new_user_only', condition: { maxOrderCount: 5 } },
      );
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 2,
        categoryIds: [],
        listingIds: [],
      });
      expect(result.eligible).toBe(true);
      expect(result.failedRules).toEqual([]);
    });

    it('returns failed rules when multiple rules fail', async () => {
      mocks.mockSelectResult.push(
        { id: 'r1', ruleType: 'min_order', condition: { minCents: 10000 } },
        { id: 'r2', ruleType: 'new_user_only', condition: { maxOrderCount: 0 } },
      );
      const { evaluateCampaignRules } = await import('../campaign-rules');
      const result = await evaluateCampaignRules({
        campaignId: 'camp-1',
        orderTotalCents: 5000,
        buyerOrderCount: 3,
        categoryIds: [],
        listingIds: [],
      });
      expect(result.eligible).toBe(false);
      expect(result.failedRules).toContain('min_order');
      expect(result.failedRules).toContain('new_user_only');
    });
  });

  describe('addCampaignRule', () => {
    it('inserts a rule and returns it', async () => {
      const { addCampaignRule } = await import('../campaign-rules');
      const result = await addCampaignRule({
        campaignId: 'camp-1',
        ruleType: 'min_order',
        condition: { minCents: 5000 },
      });
      expect(result).toEqual({ id: 'rule-1' });
    });
  });

  describe('removeCampaignRule', () => {
    it('deletes a rule by ID', async () => {
      const { removeCampaignRule } = await import('../campaign-rules');
      await removeCampaignRule('rule-1');
      expect(mocks.mockDeleteWhere).toHaveBeenCalled();
    });
  });

  describe('getCampaignRules', () => {
    it('returns rules for a campaign', async () => {
      mocks.mockSelectResult.push(
        { id: 'r1', campaignId: 'camp-1', ruleType: 'min_order' },
      );
      const { getCampaignRules } = await import('../campaign-rules');
      const rules = await getCampaignRules('camp-1');
      expect(rules).toHaveLength(1);
    });
  });
});
