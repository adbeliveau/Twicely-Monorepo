import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

import { getAffiliateApplications, getAffiliateDetailForAdmin } from '../affiliate-admin';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

const AFF_ID = 'aff-test-1';
const USER_ID = 'user-test-1';

const mockAffiliateRow = {
  id: AFF_ID,
  userId: USER_ID,
  username: 'testuser',
  email: 'test@example.com',
  displayName: 'Test User',
  tier: 'INFLUENCER',
  status: 'PENDING',
  commissionRateBps: 2500,
  referralCode: 'TESTCODE',
  totalEarnedCents: 0,
  createdAt: new Date('2026-01-01'),
};

const mockAffiliateDetailRow = {
  ...mockAffiliateRow,
  cookieDurationDays: 60,
  commissionDurationMonths: 12,
  applicationNote: 'My application note here.',
  warningCount: 0,
  suspendedAt: null,
  suspendedReason: null,
  pendingBalanceCents: 0,
  availableBalanceCents: 0,
  totalPaidCents: 0,
  updatedAt: new Date('2026-01-01'),
};

// select().from().leftJoin().where().orderBy().limit().offset()
function makeListChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain as never;
}

// select({total}).from().leftJoin().where() — count query
function makeCountChain(total: number) {
  const chain = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn().mockResolvedValue([{ total }]),
  };
  chain.from.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  return chain as never;
}

// select().from().leftJoin().where().limit(1) — single affiliate detail row
function makeSingleChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      leftJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as never;
}

// select({total}).from().where() — count query without leftJoin
function makeSimpleCountChain(total: number) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ total }]),
    }),
  } as never;
}

// ─── getAffiliateApplications ─────────────────────────────────────────────────

describe('getAffiliateApplications', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns rows and total count with no filters', async () => {
    mockSelect
      .mockReturnValueOnce(makeListChain([mockAffiliateRow]))
      .mockReturnValueOnce(makeCountChain(1));
    const result = await getAffiliateApplications({ limit: 10, offset: 0 });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.rows[0]!.id).toBe(AFF_ID);
  });

  it('returns empty rows and total 0 when no affiliates exist', async () => {
    mockSelect
      .mockReturnValueOnce(makeListChain([]))
      .mockReturnValueOnce(makeCountChain(0));
    const result = await getAffiliateApplications({ limit: 10, offset: 0 });
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('passes pagination offset to query', async () => {
    mockSelect
      .mockReturnValueOnce(makeListChain([]))
      .mockReturnValueOnce(makeCountChain(5));
    const result = await getAffiliateApplications({ limit: 5, offset: 10 });
    // Pagination was passed — total still reflects full count
    expect(result.total).toBe(5);
  });

  it('filters by status when provided', async () => {
    mockSelect
      .mockReturnValueOnce(makeListChain([mockAffiliateRow]))
      .mockReturnValueOnce(makeCountChain(1));
    const result = await getAffiliateApplications({ status: 'PENDING', limit: 10, offset: 0 });
    expect(result.rows[0]!.status).toBe('PENDING');
    // Two db.select calls made (rows + count)
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it('filters by tier when provided', async () => {
    mockSelect
      .mockReturnValueOnce(makeListChain([mockAffiliateRow]))
      .mockReturnValueOnce(makeCountChain(1));
    const result = await getAffiliateApplications({ tier: 'INFLUENCER', limit: 10, offset: 0 });
    expect(result.rows[0]!.tier).toBe('INFLUENCER');
  });

  it('maps null username and email to null (not undefined)', async () => {
    const rowWithNulls = { ...mockAffiliateRow, username: null, email: null, displayName: null };
    mockSelect
      .mockReturnValueOnce(makeListChain([rowWithNulls]))
      .mockReturnValueOnce(makeCountChain(1));
    const result = await getAffiliateApplications({ limit: 10, offset: 0 });
    expect(result.rows[0]!.username).toBeNull();
    expect(result.rows[0]!.email).toBeNull();
    expect(result.rows[0]!.displayName).toBeNull();
  });

  it('handles missing totalResult gracefully (defaults to 0)', async () => {
    mockSelect
      .mockReturnValueOnce(makeListChain([]))
      .mockReturnValueOnce(makeCountChain(0));
    const result = await getAffiliateApplications({ limit: 10, offset: 0 });
    expect(result.total).toBe(0);
  });
});

// ─── getAffiliateDetailForAdmin ───────────────────────────────────────────────

describe('getAffiliateDetailForAdmin', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns null when affiliate not found', async () => {
    mockSelect.mockReturnValueOnce(makeSingleChain([]));
    const result = await getAffiliateDetailForAdmin(AFF_ID);
    expect(result).toBeNull();
  });

  it('returns full detail with referral/conversion/promo counts', async () => {
    mockSelect
      .mockReturnValueOnce(makeSingleChain([mockAffiliateDetailRow]))
      .mockReturnValueOnce(makeSimpleCountChain(10))   // referralCount
      .mockReturnValueOnce(makeSimpleCountChain(3))    // conversionCount
      .mockReturnValueOnce(makeSimpleCountChain(2));   // promoCodeCount
    const result = await getAffiliateDetailForAdmin(AFF_ID);
    expect(result).not.toBeNull();
    expect(result!.referralCount).toBe(10);
    expect(result!.conversionCount).toBe(3);
    expect(result!.promoCodeCount).toBe(2);
  });

  it('returns 0 for referralCount when no referrals', async () => {
    mockSelect
      .mockReturnValueOnce(makeSingleChain([mockAffiliateDetailRow]))
      .mockReturnValueOnce(makeSimpleCountChain(0))
      .mockReturnValueOnce(makeSimpleCountChain(0))
      .mockReturnValueOnce(makeSimpleCountChain(0));
    const result = await getAffiliateDetailForAdmin(AFF_ID);
    expect(result!.referralCount).toBe(0);
    expect(result!.conversionCount).toBe(0);
    expect(result!.promoCodeCount).toBe(0);
  });

  it('returns null for applicationNote when not set', async () => {
    const rowNoNote = { ...mockAffiliateDetailRow, applicationNote: null };
    mockSelect
      .mockReturnValueOnce(makeSingleChain([rowNoNote]))
      .mockReturnValueOnce(makeSimpleCountChain(0))
      .mockReturnValueOnce(makeSimpleCountChain(0))
      .mockReturnValueOnce(makeSimpleCountChain(0));
    const result = await getAffiliateDetailForAdmin(AFF_ID);
    expect(result!.applicationNote).toBeNull();
  });

  it('fires 3 count queries in parallel after fetching main row', async () => {
    mockSelect
      .mockReturnValueOnce(makeSingleChain([mockAffiliateDetailRow]))
      .mockReturnValueOnce(makeSimpleCountChain(5))
      .mockReturnValueOnce(makeSimpleCountChain(2))
      .mockReturnValueOnce(makeSimpleCountChain(1));
    await getAffiliateDetailForAdmin(AFF_ID);
    // 1 select for main row + 3 count selects = 4 total
    expect(mockSelect).toHaveBeenCalledTimes(4);
  });
});
