import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ eq: { col, val } })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  desc: vi.fn((col) => ({ desc: col })),
  count: vi.fn(() => ({ count: true })),
  sql: Object.assign(
    vi.fn((_tpl: TemplateStringsArray, ..._vals: unknown[]) => ({ sql: true })),
    { raw: vi.fn((s: string) => ({ sql: s })) },
  ),
}));

vi.mock('@twicely/db/schema', () => ({
  affiliatePayout: {
    id: 'id', affiliateId: 'affiliate_id', amountCents: 'amount_cents',
    method: 'method', status: 'status', periodStart: 'period_start',
    periodEnd: 'period_end', failedReason: 'failed_reason',
    createdAt: 'created_at', completedAt: 'completed_at',
    externalPayoutId: 'external_payout_id',
  },
  affiliateCommission: {
    id: 'id', affiliateId: 'affiliate_id',
    subscriptionProduct: 'subscription_product',
    grossRevenueCents: 'gross_revenue_cents',
    netRevenueCents: 'net_revenue_cents',
    commissionRateBps: 'commission_rate_bps',
    commissionCents: 'commission_cents',
    status: 'status', holdExpiresAt: 'hold_expires_at',
    paidAt: 'paid_at', reversedAt: 'reversed_at',
    reversalReason: 'reversal_reason', createdAt: 'created_at',
  },
}));

import { getCommissionsForAdmin, getPayoutsForAdmin } from '../affiliate-payout-admin';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

// ─── Chain Helpers ────────────────────────────────────────────────────────────

// select().from().where().orderBy().limit().offset()
function makeListChain(rows: unknown[]) {
  const c = {
    from: vi.fn(), where: vi.fn(),
    orderBy: vi.fn(), limit: vi.fn(), offset: vi.fn().mockResolvedValue(rows),
  };
  c.from.mockReturnValue(c);
  c.where.mockReturnValue(c);
  c.orderBy.mockReturnValue(c);
  c.limit.mockReturnValue(c);
  return c as never;
}

// select({total}).from().where()
function makeCountChain(total: number) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ total }]),
    }),
  } as never;
}

// ─── Test Data ────────────────────────────────────────────────────────────────

const now = new Date('2026-01-15T12:00:00Z');
const periodStart = new Date('2026-01-01T00:00:00Z');
const periodEnd = new Date('2026-01-31T23:59:59Z');

const mockCommissionRow = {
  commissionId: 'comm-test-1',
  subscriptionProduct: 'store_pro',
  grossRevenueCents: 2999,
  netRevenueCents: 2700,
  commissionRateBps: 1500,
  commissionCents: 405,
  status: 'PENDING',
  holdExpiresAt: now,
  paidAt: null,
  reversedAt: null,
  reversalReason: null,
  createdAt: now,
};

// ─── getCommissionsForAdmin ───────────────────────────────────────────────────

describe('getCommissionsForAdmin', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns paginated commissions for a specific affiliate', async () => {
    mockSelect
      .mockReturnValueOnce(makeListChain([mockCommissionRow]))
      .mockReturnValueOnce(makeCountChain(5));

    const result = await getCommissionsForAdmin({ affiliateId: 'aff-test-1', limit: 10, offset: 0 });

    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(5);
    expect(result.rows[0]!.commissionId).toBe('comm-test-1');
    expect(result.rows[0]!.commissionCents).toBe(405);
  });

  it('filters by commission status when provided', async () => {
    mockSelect
      .mockReturnValueOnce(makeListChain([mockCommissionRow]))
      .mockReturnValueOnce(makeCountChain(1));

    const result = await getCommissionsForAdmin({
      affiliateId: 'aff-test-1', status: 'PENDING', limit: 10, offset: 0,
    });

    expect(result.rows[0]!.status).toBe('PENDING');
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it('maps null optional fields to null (paidAt, reversedAt, reversalReason)', async () => {
    mockSelect
      .mockReturnValueOnce(makeListChain([mockCommissionRow]))
      .mockReturnValueOnce(makeCountChain(1));

    const result = await getCommissionsForAdmin({ affiliateId: 'aff-test-1', limit: 10, offset: 0 });

    expect(result.rows[0]!.paidAt).toBeNull();
    expect(result.rows[0]!.reversedAt).toBeNull();
    expect(result.rows[0]!.reversalReason).toBeNull();
  });

  it('returns empty rows and total 0 when no commissions exist for affiliate', async () => {
    mockSelect
      .mockReturnValueOnce(makeListChain([]))
      .mockReturnValueOnce(makeCountChain(0));

    const result = await getCommissionsForAdmin({ affiliateId: 'aff-test-1', limit: 10, offset: 0 });

    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── getPayoutsForAdmin ───────────────────────────────────────────────────────

describe('getPayoutsForAdmin', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns paginated payouts for a specific affiliate', async () => {
    const row = {
      id: 'payout-test-1', affiliateId: 'aff-test-1',
      amountCents: 7500, method: 'stripe_connect',
      externalPayoutId: 'ext-pay-001', status: 'COMPLETED',
      periodStart, periodEnd,
      failedReason: null, createdAt: now, completedAt: now,
    };

    mockSelect
      .mockReturnValueOnce(makeListChain([row]))
      .mockReturnValueOnce(makeCountChain(2));

    const result = await getPayoutsForAdmin({ affiliateId: 'aff-test-1', limit: 10, offset: 0 });

    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(2);
    expect(result.rows[0]!.amountCents).toBe(7500);
    expect(result.rows[0]!.status).toBe('COMPLETED');
  });

  it('maps null optional fields to null (externalPayoutId, failedReason, completedAt)', async () => {
    const row = {
      id: 'payout-test-2', affiliateId: 'aff-test-1',
      amountCents: 3000, method: 'stripe_connect',
      externalPayoutId: null, status: 'PENDING',
      periodStart, periodEnd,
      failedReason: null, createdAt: now, completedAt: null,
    };

    mockSelect
      .mockReturnValueOnce(makeListChain([row]))
      .mockReturnValueOnce(makeCountChain(1));

    const result = await getPayoutsForAdmin({ affiliateId: 'aff-test-1', limit: 10, offset: 0 });

    expect(result.rows[0]!.externalPayoutId).toBeNull();
    expect(result.rows[0]!.completedAt).toBeNull();
  });

  it('returns empty rows and total 0 when no payouts exist for affiliate', async () => {
    mockSelect
      .mockReturnValueOnce(makeListChain([]))
      .mockReturnValueOnce(makeCountChain(0));

    const result = await getPayoutsForAdmin({ affiliateId: 'aff-test-1', limit: 10, offset: 0 });

    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
