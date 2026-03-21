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
  affiliate: { id: 'id', userId: 'user_id', status: 'status', availableBalanceCents: 'available_balance_cents' },
  affiliatePayout: {
    id: 'id', affiliateId: 'affiliate_id', amountCents: 'amount_cents',
    method: 'method', status: 'status', periodStart: 'period_start',
    periodEnd: 'period_end', failedReason: 'failed_reason',
    createdAt: 'created_at', completedAt: 'completed_at',
    externalPayoutId: 'external_payout_id',
  },
  affiliateCommission: {
    id: 'id', affiliateId: 'affiliate_id', status: 'status',
    commissionCents: 'commission_cents',
  },
  user: { id: 'id', username: 'username', email: 'email' },
}));

import { getAffiliatePayoutList, getAffiliatePayoutStats } from '../affiliate-payout-admin';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

// ─── Chain Helpers ────────────────────────────────────────────────────────────

function makePayoutListChain(rows: unknown[]) {
  const c = {
    from: vi.fn(), leftJoin: vi.fn(), where: vi.fn(),
    orderBy: vi.fn(), limit: vi.fn(), offset: vi.fn().mockResolvedValue(rows),
  };
  c.from.mockReturnValue(c);
  c.leftJoin.mockReturnValue(c);
  c.where.mockReturnValue(c);
  c.orderBy.mockReturnValue(c);
  c.limit.mockReturnValue(c);
  return c as never;
}

function makeCountChain(total: number) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ total }]),
    }),
  } as never;
}

function makeWhereChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as never;
}

function makeFromChain(rows: unknown[]) {
  return { from: vi.fn().mockResolvedValue(rows) } as never;
}

// ─── Test Data ────────────────────────────────────────────────────────────────

const now = new Date('2026-01-15T12:00:00Z');
const periodStart = new Date('2026-01-01T00:00:00Z');
const periodEnd = new Date('2026-01-31T23:59:59Z');

const mockPayoutRow = {
  payoutId: 'payout-test-1',
  affiliateId: 'aff-test-1',
  affiliateUsername: 'testuser',
  affiliateEmail: 'test@example.com',
  amountCents: 5000,
  method: 'stripe_connect',
  status: 'COMPLETED',
  periodStart,
  periodEnd,
  failedReason: null,
  createdAt: now,
  completedAt: now,
  externalPayoutId: 'ext-001',
};

// ─── getAffiliatePayoutList ────────────────────────────────────────────────────

describe('getAffiliatePayoutList', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns paginated rows and correct total count', async () => {
    mockSelect
      .mockReturnValueOnce(makePayoutListChain([mockPayoutRow]))
      .mockReturnValueOnce(makeCountChain(3));

    const result = await getAffiliatePayoutList({ limit: 10, offset: 0 });

    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(3);
    expect(result.rows[0]!.payoutId).toBe('payout-test-1');
  });

  it('filters by status when provided (fires two select calls)', async () => {
    mockSelect
      .mockReturnValueOnce(makePayoutListChain([mockPayoutRow]))
      .mockReturnValueOnce(makeCountChain(1));

    const result = await getAffiliatePayoutList({ status: 'COMPLETED', limit: 10, offset: 0 });

    expect(result.rows[0]!.status).toBe('COMPLETED');
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it('returns affiliateUsername and affiliateEmail from joined user table', async () => {
    mockSelect
      .mockReturnValueOnce(makePayoutListChain([mockPayoutRow]))
      .mockReturnValueOnce(makeCountChain(1));

    const result = await getAffiliatePayoutList({ limit: 10, offset: 0 });

    expect(result.rows[0]!.affiliateUsername).toBe('testuser');
    expect(result.rows[0]!.affiliateEmail).toBe('test@example.com');
  });

  it('returns empty rows and total 0 when no payouts exist', async () => {
    mockSelect
      .mockReturnValueOnce(makePayoutListChain([]))
      .mockReturnValueOnce(makeCountChain(0));

    const result = await getAffiliatePayoutList({ limit: 10, offset: 0 });

    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('maps null username and email to null (not undefined)', async () => {
    const rowNulls = { ...mockPayoutRow, affiliateUsername: null, affiliateEmail: null };
    mockSelect
      .mockReturnValueOnce(makePayoutListChain([rowNulls]))
      .mockReturnValueOnce(makeCountChain(1));

    const result = await getAffiliatePayoutList({ limit: 10, offset: 0 });

    expect(result.rows[0]!.affiliateUsername).toBeNull();
    expect(result.rows[0]!.affiliateEmail).toBeNull();
  });
});

// ─── getAffiliatePayoutStats ──────────────────────────────────────────────────

describe('getAffiliatePayoutStats', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns correct aggregate totals from three parallel queries', async () => {
    mockSelect
      .mockReturnValueOnce(makeFromChain([{
        totalPayoutsCents: 150000,
        totalPayoutsCount: 30,
        failedPayoutsCount: 2,
      }]))
      .mockReturnValueOnce(makeWhereChain([{
        pendingPayoutsCents: 45000,
        activeAffiliatesCount: 12,
      }]))
      .mockReturnValueOnce(makeWhereChain([{
        totalCommissionsPendingCents: 20000,
      }]));

    const stats = await getAffiliatePayoutStats();

    expect(stats.totalPayoutsCents).toBe(150000);
    expect(stats.totalPayoutsCount).toBe(30);
    expect(stats.failedPayoutsCount).toBe(2);
    expect(stats.pendingPayoutsCents).toBe(45000);
    expect(stats.activeAffiliatesCount).toBe(12);
    expect(stats.totalCommissionsPendingCents).toBe(20000);
  });

  it('returns zeroes when no data exists', async () => {
    mockSelect
      .mockReturnValueOnce(makeFromChain([{
        totalPayoutsCents: 0,
        totalPayoutsCount: 0,
        failedPayoutsCount: 0,
      }]))
      .mockReturnValueOnce(makeWhereChain([{
        pendingPayoutsCents: 0,
        activeAffiliatesCount: 0,
      }]))
      .mockReturnValueOnce(makeWhereChain([{
        totalCommissionsPendingCents: 0,
      }]));

    const stats = await getAffiliatePayoutStats();

    expect(stats.totalPayoutsCents).toBe(0);
    expect(stats.totalPayoutsCount).toBe(0);
    expect(stats.pendingPayoutsCents).toBe(0);
    expect(stats.activeAffiliatesCount).toBe(0);
    expect(stats.totalCommissionsPendingCents).toBe(0);
  });

  it('fires exactly 3 select calls (one per stats source)', async () => {
    mockSelect
      .mockReturnValueOnce(makeFromChain([{ totalPayoutsCents: 0, totalPayoutsCount: 0, failedPayoutsCount: 0 }]))
      .mockReturnValueOnce(makeWhereChain([{ pendingPayoutsCents: 0, activeAffiliatesCount: 0 }]))
      .mockReturnValueOnce(makeWhereChain([{ totalCommissionsPendingCents: 0 }]));

    await getAffiliatePayoutStats();

    expect(mockSelect).toHaveBeenCalledTimes(3);
  });
});
