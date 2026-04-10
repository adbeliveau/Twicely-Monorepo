import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const selectCallIndex = { value: 0 };
  return {
    selectCallIndex,
    selectResults: [] as unknown[][],
    mockInsertValues: vi.fn().mockResolvedValue(undefined),
    mockUpdateSet: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  };
});

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        const idx = mocks.selectCallIndex.value++;
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
    insert: vi.fn().mockImplementation(() => ({
      values: mocks.mockInsertValues,
    })),
    update: vi.fn().mockImplementation(() => ({
      set: mocks.mockUpdateSet,
    })),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  promotedListing: {
    id: 'id', sellerId: 'seller_id', bidCents: 'bid_cents',
    dailyBudgetCents: 'daily_budget_cents', isActive: 'is_active',
    impressions: 'impressions', clicks: 'clicks', sales: 'sales',
    totalFeeCents: 'total_fee_cents', updatedAt: 'updated_at',
  },
  promotedListingEvent: {
    id: 'id', promotedListingId: 'promoted_listing_id',
    eventType: 'event_type', feeCents: 'fee_cents', createdAt: 'created_at',
  },
  ledgerEntry: {
    userId: 'user_id', type: 'type', amountCents: 'amount_cents',
    status: 'status', memo: 'memo', idempotencyKey: 'idempotency_key',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  gte: vi.fn((...args: unknown[]) => ({ op: 'gte', args })),
  sql: Object.assign(vi.fn((...args: unknown[]) => args), {
    raw: vi.fn((v: unknown) => v),
  }),
  count: vi.fn(() => 'count'),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// --- Tests ------------------------------------------------------------------

describe('V4-06: Promoted Listing Billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectCallIndex.value = 0;
    mocks.selectResults.length = 0;
  });

  describe('recordPromotedListingClick', () => {
    it('returns not found when listing does not exist', async () => {
      mocks.selectResults[0] = [];
      const { recordPromotedListingClick } = await import('../promoted-listing-billing');
      const result = await recordPromotedListingClick({ promotedListingId: 'pl-1' });
      expect(result.charged).toBe(false);
      expect(result.reason).toBe('Promoted listing not found');
    });

    it('returns not active when listing is inactive', async () => {
      mocks.selectResults[0] = [{
        id: 'pl-1', sellerId: 's-1', bidCents: 10,
        dailyBudgetCents: null, isActive: false,
      }];
      const { recordPromotedListingClick } = await import('../promoted-listing-billing');
      const result = await recordPromotedListingClick({ promotedListingId: 'pl-1' });
      expect(result.charged).toBe(false);
      expect(result.reason).toBe('Promoted listing is not active');
    });

    it('charges bidCents on successful click (no daily budget)', async () => {
      mocks.selectResults[0] = [{
        id: 'pl-1', sellerId: 's-1', bidCents: 15,
        dailyBudgetCents: null, isActive: true,
      }];
      const { recordPromotedListingClick } = await import('../promoted-listing-billing');
      const result = await recordPromotedListingClick({ promotedListingId: 'pl-1' });
      expect(result.charged).toBe(true);
      expect(mocks.mockInsertValues).toHaveBeenCalledTimes(2); // click event + ledger
    });

    it('rejects when daily budget exhausted', async () => {
      // Call 0: load promoted listing
      mocks.selectResults[0] = [{
        id: 'pl-1', sellerId: 's-1', bidCents: 10,
        dailyBudgetCents: 100, isActive: true,
      }];
      // Call 1: sum of today's spend
      mocks.selectResults[1] = [{ total: '95' }];

      const { recordPromotedListingClick } = await import('../promoted-listing-billing');
      const result = await recordPromotedListingClick({ promotedListingId: 'pl-1' });
      expect(result.charged).toBe(false);
      expect(result.reason).toBe('Daily budget exhausted');
    });

    it('allows click when within daily budget', async () => {
      // Call 0: load promoted listing
      mocks.selectResults[0] = [{
        id: 'pl-1', sellerId: 's-1', bidCents: 10,
        dailyBudgetCents: 100, isActive: true,
      }];
      // Call 1: sum of today's spend
      mocks.selectResults[1] = [{ total: '80' }];

      const { recordPromotedListingClick } = await import('../promoted-listing-billing');
      const result = await recordPromotedListingClick({ promotedListingId: 'pl-1' });
      expect(result.charged).toBe(true);
    });
  });

  describe('checkDailyBudget', () => {
    it('returns not remaining when listing not found', async () => {
      mocks.selectResults[0] = [];
      const { checkDailyBudget } = await import('../promoted-listing-billing');
      const result = await checkDailyBudget('pl-999');
      expect(result.remaining).toBe(false);
    });

    it('returns remaining when no daily budget set', async () => {
      // Call 0: load promoted listing
      mocks.selectResults[0] = [{ dailyBudgetCents: null }];
      // Call 1: today's spend
      mocks.selectResults[1] = [{ total: '0' }];

      const { checkDailyBudget } = await import('../promoted-listing-billing');
      const result = await checkDailyBudget('pl-1');
      expect(result.remaining).toBe(true);
      expect(result.dailyBudgetCents).toBeNull();
    });
  });

  describe('getPromotedListingRoas', () => {
    it('returns zeros when listing not found', async () => {
      mocks.selectResults[0] = [];
      const { getPromotedListingRoas } = await import('../promoted-listing-billing');
      const result = await getPromotedListingRoas('pl-999');
      expect(result.roas).toBeNull();
      expect(result.clicks).toBe(0);
    });

    it('calculates ROAS when spend exists', async () => {
      mocks.selectResults[0] = [{
        impressions: 1000, clicks: 50, sales: 5, totalFeeCents: 500,
      }];
      const { getPromotedListingRoas } = await import('../promoted-listing-billing');
      const result = await getPromotedListingRoas('pl-1');
      expect(result.clicks).toBe(50);
      expect(result.sales).toBe(5);
      expect(result.roas).toBe(0.01);
    });

    it('returns null ROAS when zero spend', async () => {
      mocks.selectResults[0] = [{
        impressions: 100, clicks: 0, sales: 0, totalFeeCents: 0,
      }];
      const { getPromotedListingRoas } = await import('../promoted-listing-billing');
      const result = await getPromotedListingRoas('pl-1');
      expect(result.roas).toBeNull();
    });
  });
});
