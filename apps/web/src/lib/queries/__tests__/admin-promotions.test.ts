/**
 * Admin Promotions Queries Tests — Seller Promotions (I9)
 * Covers getAllSellerPromotions, getPromotionDetailAdmin
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  promotion: { id: 'id', sellerId: 'seller_id', name: 'name', type: 'type', scope: 'scope', discountPercent: 'discount_percent', discountAmountCents: 'discount_amount_cents', minimumOrderCents: 'minimum_order_cents', maxUsesTotal: 'max_uses_total', maxUsesPerBuyer: 'max_uses_per_buyer', usageCount: 'usage_count', couponCode: 'coupon_code', isActive: 'is_active', startsAt: 'starts_at', endsAt: 'ends_at', createdAt: 'created_at' },
  promotionUsage: { id: 'id', promotionId: 'promotion_id', orderId: 'order_id', buyerId: 'buyer_id', discountCents: 'discount_cents', createdAt: 'created_at' },
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
  getPromotionStats: vi.fn().mockResolvedValue({ totalUses: 10, totalDiscountCents: 5000 }),
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

const NOW = new Date('2026-01-01T00:00:00Z');

function makePromotionRow(overrides = {}) {
  return {
    id: 'promo-1', sellerId: 'user-1', sellerUsername: 'sellerA', sellerDisplayName: 'Seller A',
    name: 'Spring Sale', type: 'PERCENT_OFF', scope: 'STORE_WIDE', discountPercent: 15,
    discountAmountCents: null, minimumOrderCents: null, maxUsesTotal: 100, maxUsesPerBuyer: 1,
    usageCount: 10, couponCode: 'SPRING15', isActive: true, startsAt: NOW, endsAt: null,
    createdAt: NOW, ...overrides,
  };
}

// ─── getAllSellerPromotions ────────────────────────────────────────────────────

describe('getAllSellerPromotions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns promotions with seller username joined', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromotionRow()])).mockReturnValueOnce(makeCountChain(1));
    const { getAllSellerPromotions } = await import('../admin-promotions');
    const result = await getAllSellerPromotions({ limit: 50, offset: 0 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.sellerUsername).toBe('sellerA');
    expect(result.total).toBe(1);
  });

  it('filters by status=active correctly', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromotionRow()])).mockReturnValueOnce(makeCountChain(1));
    const { getAllSellerPromotions } = await import('../admin-promotions');
    const result = await getAllSellerPromotions({ limit: 50, offset: 0, status: 'active' });
    expect(result.rows).toHaveLength(1);
  });

  it('filters by status=scheduled correctly', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromotionRow()])).mockReturnValueOnce(makeCountChain(1));
    const { getAllSellerPromotions } = await import('../admin-promotions');
    const result = await getAllSellerPromotions({ limit: 50, offset: 0, status: 'scheduled' });
    expect(result.rows).toHaveLength(1);
  });

  it('filters by status=ended correctly', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromotionRow({ isActive: false })])).mockReturnValueOnce(makeCountChain(1));
    const { getAllSellerPromotions } = await import('../admin-promotions');
    const result = await getAllSellerPromotions({ limit: 50, offset: 0, status: 'ended' });
    expect(result.rows).toHaveLength(1);
  });

  it('filters by sellerId when provided', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromotionRow()])).mockReturnValueOnce(makeCountChain(1));
    const { getAllSellerPromotions } = await import('../admin-promotions');
    const result = await getAllSellerPromotions({ limit: 50, offset: 0, sellerId: 'user-1' });
    expect(result.rows[0]?.sellerId).toBe('user-1');
  });

  it('searches by promotion name with ILIKE', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromotionRow()])).mockReturnValueOnce(makeCountChain(1));
    const { getAllSellerPromotions } = await import('../admin-promotions');
    const result = await getAllSellerPromotions({ limit: 50, offset: 0, search: 'Spring' });
    expect(result.rows).toHaveLength(1);
  });

  it('searches by coupon code with ILIKE', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromotionRow()])).mockReturnValueOnce(makeCountChain(1));
    const { getAllSellerPromotions } = await import('../admin-promotions');
    const result = await getAllSellerPromotions({ limit: 50, offset: 0, search: 'SPRING15' });
    expect(result.rows[0]?.couponCode).toBe('SPRING15');
  });

  it('paginates with limit and offset', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([makePromotionRow()])).mockReturnValueOnce(makeCountChain(75));
    const { getAllSellerPromotions } = await import('../admin-promotions');
    const result = await getAllSellerPromotions({ limit: 50, offset: 50 });
    expect(result.total).toBe(75);
  });

  it('returns total count for pagination', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([])).mockReturnValueOnce(makeCountChain(200));
    const { getAllSellerPromotions } = await import('../admin-promotions');
    const result = await getAllSellerPromotions({ limit: 50, offset: 0 });
    expect(result.total).toBe(200);
  });

  it('returns empty rows when no promotions match', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([])).mockReturnValueOnce(makeCountChain(0));
    const { getAllSellerPromotions } = await import('../admin-promotions');
    const result = await getAllSellerPromotions({ limit: 50, offset: 0, search: 'nonexistent' });
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── getPromotionDetailAdmin ──────────────────────────────────────────────────

describe('getPromotionDetailAdmin', () => {
  // Use clearAllMocks (not reset) to preserve the vi.mock factory's mockResolvedValue
  // for getPromotionStats. Queues are always fully consumed per test here.
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns promotion with seller info and stats', async () => {
    const usageRow = { id: 'pu-1', promotionId: 'promo-1', orderId: 'order-1', orderNumber: 'TW-1001', buyerId: 'buyer-1', buyerUsername: 'buyerA', discountCents: 500, createdAt: NOW };
    mockDbSelect.mockReturnValueOnce(makeSimpleChain([makePromotionRow()])).mockReturnValueOnce(makeChain([usageRow]));
    const { getPromotionDetailAdmin } = await import('../admin-promotions');
    const result = await getPromotionDetailAdmin('promo-1');
    expect(result).not.toBeNull();
    expect(result?.promotion.id).toBe('promo-1');
    expect(result?.stats.totalUses).toBe(10);
  });

  it('returns recent usage with buyer and order info', async () => {
    const usageRow = { id: 'pu-1', promotionId: 'promo-1', orderId: 'order-1', orderNumber: 'TW-1001', buyerId: 'buyer-1', buyerUsername: 'buyerA', discountCents: 500, createdAt: NOW };
    mockDbSelect.mockReturnValueOnce(makeSimpleChain([makePromotionRow()])).mockReturnValueOnce(makeChain([usageRow]));
    const { getPromotionDetailAdmin } = await import('../admin-promotions');
    const result = await getPromotionDetailAdmin('promo-1');
    expect(result?.recentUsage[0]?.buyerUsername).toBe('buyerA');
    expect(result?.recentUsage[0]?.orderNumber).toBe('TW-1001');
  });

  it('returns null when promotion not found', async () => {
    mockDbSelect.mockReturnValueOnce(makeSimpleChain([]));
    const { getPromotionDetailAdmin } = await import('../admin-promotions');
    const result = await getPromotionDetailAdmin('nonexistent');
    expect(result).toBeNull();
  });
});
