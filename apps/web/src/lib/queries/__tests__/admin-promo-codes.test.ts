/**
 * Admin Promo Code Queries Tests — Codes & Stats (I9)
 * Covers getAllPromoCodesAdmin, getPromoCodeDetailAdmin, getPromotionsOverviewStats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  promotion: { id: 'id', sellerId: 'seller_id', name: 'name', isActive: 'is_active', startsAt: 'starts_at', endsAt: 'ends_at' },
  promotionUsage: { discountCents: 'discount_cents' },
  promoCode: { id: 'id', code: 'code', type: 'type', affiliateId: 'affiliate_id', discountType: 'discount_type', discountValue: 'discount_value', durationMonths: 'duration_months', scopeProductTypes: 'scope_product_types', usageLimit: 'usage_limit', usageCount: 'usage_count', expiresAt: 'expires_at', isActive: 'is_active', createdAt: 'created_at' },
  promoCodeRedemption: { id: 'id', promoCodeId: 'promo_code_id', userId: 'user_id', subscriptionProduct: 'subscription_product', discountAppliedCents: 'discount_applied_cents', monthsRemaining: 'months_remaining', createdAt: 'created_at' },
  affiliate: { id: 'id', userId: 'user_id' },
  user: { id: 'id', username: 'username', displayName: 'display_name' },
  order: { id: 'id', orderNumber: 'order_number' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (_c: unknown, _v: unknown) => ({ type: 'eq' }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  ilike: (_c: unknown, _v: unknown) => ({ type: 'ilike' }),
  count: () => ({ type: 'count' }),
  desc: (_c: unknown) => ({ type: 'desc' }),
  gt: (_c: unknown, _v: unknown) => ({ type: 'gt' }),
  lt: (_c: unknown, _v: unknown) => ({ type: 'lt' }),
  isNull: (_c: unknown) => ({ type: 'isNull' }),
  sql: vi.fn(() => ({ type: 'sql' })),
}));

vi.mock('drizzle-orm/pg-core', () => ({
  alias: (_table: unknown, _name: string) => ({ type: 'alias', username: 'username', displayName: 'display_name' }),
}));

vi.mock('../promotions', () => ({
  getPromotionStats: vi.fn().mockResolvedValue({ totalUses: 0, totalDiscountCents: 0 }),
}));

// ─── Chain helpers ────────────────────────────────────────────────────────────

function makeChain(result: unknown[]) {
  const c: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const key of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) {
    c[key] = vi.fn().mockReturnValue(c);
  }
  return c;
}

function makeCountChain(total: number) {
  const result = [{ total }];
  const c: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const key of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) {
    c[key] = vi.fn().mockReturnValue(c);
  }
  return c;
}

function makeSimpleChain(result: unknown[]) {
  const c: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const key of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) {
    c[key] = vi.fn().mockReturnValue(c);
  }
  return c;
}

function makeStatChain(val: Record<string, unknown>) {
  const result = [val];
  const c: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const key of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) {
    c[key] = vi.fn().mockReturnValue(c);
  }
  return c;
}

const NOW = new Date('2026-01-01T00:00:00Z');

function makePromoCodeRow(overrides = {}) {
  return {
    id: 'code-1', code: 'LAUNCH50', type: 'PLATFORM',
    affiliateId: null, affiliateUsername: null, discountType: 'PERCENTAGE',
    discountValue: 5000, durationMonths: 3, scopeProductTypes: null,
    usageLimit: 100, usageCount: 5, expiresAt: null, isActive: true,
    createdAt: NOW, ...overrides,
  };
}

// ─── getAllPromoCodesAdmin ────────────────────────────────────────────────────

describe('getAllPromoCodesAdmin', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns all promo codes when no filter', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromoCodeRow()])).mockReturnValueOnce(makeCountChain(1));
    const { getAllPromoCodesAdmin } = await import('../admin-promotions');
    const result = await getAllPromoCodesAdmin({ limit: 50, offset: 0 });
    expect(result.rows).toHaveLength(1);
  });

  it('filters by type=PLATFORM', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromoCodeRow()])).mockReturnValueOnce(makeCountChain(1));
    const { getAllPromoCodesAdmin } = await import('../admin-promotions');
    const result = await getAllPromoCodesAdmin({ limit: 50, offset: 0, type: 'PLATFORM' });
    expect(result.rows[0]?.type).toBe('PLATFORM');
  });

  it('filters by type=AFFILIATE', async () => {
    const row = makePromoCodeRow({ type: 'AFFILIATE', affiliateId: 'aff-1', affiliateUsername: 'affUser' });
    mockDbSelect.mockReturnValueOnce(makeChain([row])).mockReturnValueOnce(makeCountChain(1));
    const { getAllPromoCodesAdmin } = await import('../admin-promotions');
    const result = await getAllPromoCodesAdmin({ limit: 50, offset: 0, type: 'AFFILIATE' });
    expect(result.rows[0]?.type).toBe('AFFILIATE');
  });

  it('filters by isActive', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromoCodeRow()])).mockReturnValueOnce(makeCountChain(1));
    const { getAllPromoCodesAdmin } = await import('../admin-promotions');
    const result = await getAllPromoCodesAdmin({ limit: 50, offset: 0, isActive: true });
    expect(result.rows[0]?.isActive).toBe(true);
  });

  it('searches by code with ILIKE', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromoCodeRow()])).mockReturnValueOnce(makeCountChain(1));
    const { getAllPromoCodesAdmin } = await import('../admin-promotions');
    const result = await getAllPromoCodesAdmin({ limit: 50, offset: 0, search: 'LAUNCH' });
    expect(result.rows[0]?.code).toBe('LAUNCH50');
  });

  it('includes affiliate username for AFFILIATE codes', async () => {
    const row = makePromoCodeRow({ type: 'AFFILIATE', affiliateId: 'aff-1', affiliateUsername: 'affUser' });
    mockDbSelect.mockReturnValueOnce(makeChain([row])).mockReturnValueOnce(makeCountChain(1));
    const { getAllPromoCodesAdmin } = await import('../admin-promotions');
    const result = await getAllPromoCodesAdmin({ limit: 50, offset: 0, type: 'AFFILIATE' });
    expect(result.rows[0]?.affiliateUsername).toBe('affUser');
  });

  it('paginates correctly', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([])).mockReturnValueOnce(makeCountChain(100));
    const { getAllPromoCodesAdmin } = await import('../admin-promotions');
    const result = await getAllPromoCodesAdmin({ limit: 50, offset: 50 });
    expect(result.total).toBe(100);
  });
});

// ─── getPromoCodeDetailAdmin ──────────────────────────────────────────────────

describe('getPromoCodeDetailAdmin', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns promo code with redemption history', async () => {
    const redemption = { id: 'pcr-1', promoCodeId: 'code-1', userId: 'user-1', username: 'testUser', subscriptionProduct: 'store', discountAppliedCents: 1000, monthsRemaining: 2, createdAt: NOW };
    mockDbSelect.mockReturnValueOnce(makeSimpleChain([makePromoCodeRow()])).mockReturnValueOnce(makeChain([redemption])).mockReturnValueOnce(makeCountChain(1));
    const { getPromoCodeDetailAdmin } = await import('../admin-promotions');
    const result = await getPromoCodeDetailAdmin('code-1');
    expect(result).not.toBeNull();
    expect(result?.promoCode.code).toBe('LAUNCH50');
    expect(result?.redemptions[0]?.username).toBe('testUser');
  });

  it('returns affiliate info for AFFILIATE codes', async () => {
    const row = makePromoCodeRow({ type: 'AFFILIATE', affiliateId: 'aff-1', affiliateUsername: 'affUser' });
    mockDbSelect.mockReturnValueOnce(makeSimpleChain([row])).mockReturnValueOnce(makeChain([])).mockReturnValueOnce(makeCountChain(0));
    const { getPromoCodeDetailAdmin } = await import('../admin-promotions');
    const result = await getPromoCodeDetailAdmin('code-1');
    expect(result?.promoCode.affiliateUsername).toBe('affUser');
  });

  it('returns null for non-existent ID', async () => {
    mockDbSelect.mockReturnValueOnce(makeSimpleChain([]));
    const { getPromoCodeDetailAdmin } = await import('../admin-promotions');
    const result = await getPromoCodeDetailAdmin('nonexistent');
    expect(result).toBeNull();
  });
});

// ─── getPromotionsOverviewStats ───────────────────────────────────────────────

describe('getPromotionsOverviewStats', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns aggregate counts for active promotions and codes', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeStatChain({ total: 5 }))
      .mockReturnValueOnce(makeStatChain({ total: 3 }))
      .mockReturnValueOnce(makeStatChain({ total: 20 }))
      .mockReturnValueOnce(makeStatChain({ totalDiscountCents: 50000 }));
    const { getPromotionsOverviewStats } = await import('../admin-promotions');
    const result = await getPromotionsOverviewStats();
    expect(result.activeSellerPromotions).toBe(5);
    expect(result.activePromoCodes).toBe(3);
    expect(result.totalRedemptions).toBe(20);
    expect(result.totalDiscountCents).toBe(50000);
  });

  it('returns zero counts when no data', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeStatChain({ total: 0 }))
      .mockReturnValueOnce(makeStatChain({ total: 0 }))
      .mockReturnValueOnce(makeStatChain({ total: 0 }))
      .mockReturnValueOnce(makeStatChain({ totalDiscountCents: 0 }));
    const { getPromotionsOverviewStats } = await import('../admin-promotions');
    const result = await getPromotionsOverviewStats();
    expect(result.activeSellerPromotions).toBe(0);
    expect(result.activePromoCodes).toBe(0);
    expect(result.totalRedemptions).toBe(0);
    expect(result.totalDiscountCents).toBe(0);
  });
});
