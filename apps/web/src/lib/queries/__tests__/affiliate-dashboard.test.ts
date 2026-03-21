import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import {
  getAffiliateStats,
  getAffiliateReferrals,
  getAffiliateCommissions,
  getAffiliatePayouts,
} from '../affiliate';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

// Helper to chain select().from().where().orderBy().limit().offset()
function mockSelectChain(rows: unknown[]) {
  const orderByChain = {
    limit: vi.fn().mockReturnValue({
      offset: vi.fn().mockResolvedValue(rows),
    }),
  };
  const whereChain = {
    orderBy: vi.fn().mockReturnValue(orderByChain),
  };
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(whereChain),
      leftJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(whereChain),
      }),
      orderBy: vi.fn().mockReturnValue(orderByChain),
    }),
  } as never;
}

function mockCountChain(total: number) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ total }]),
    }),
  } as never;
}

describe('getAffiliateStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns zero counts when affiliate has no referrals', async () => {
    // First call: referral stats, second: commission stats
    mockSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            allClicks: 0, allSignups: 0, allConversions: 0,
            monthClicks: 0, monthSignups: 0, monthConversions: 0,
          }]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ allEarnings: 0, monthEarnings: 0 }]),
        }),
      } as never);

    const stats = await getAffiliateStats('aff-1');
    expect(stats.thisMonth.clicks).toBe(0);
    expect(stats.allTime.clicks).toBe(0);
    expect(stats.thisMonth.earningsCents).toBe(0);
  });

  it('correctly counts this-month clicks vs all-time clicks', async () => {
    mockSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            allClicks: 100, allSignups: 50, allConversions: 20,
            monthClicks: 10, monthSignups: 5, monthConversions: 2,
          }]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ allEarnings: 50000, monthEarnings: 5000 }]),
        }),
      } as never);

    const stats = await getAffiliateStats('aff-1');
    expect(stats.thisMonth.clicks).toBe(10);
    expect(stats.allTime.clicks).toBe(100);
  });

  it('correctly counts signups (only where signedUpAt IS NOT NULL)', async () => {
    mockSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            allClicks: 50, allSignups: 30, allConversions: 10,
            monthClicks: 5, monthSignups: 3, monthConversions: 1,
          }]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ allEarnings: 0, monthEarnings: 0 }]),
        }),
      } as never);

    const stats = await getAffiliateStats('aff-1');
    expect(stats.allTime.signups).toBe(30);
    expect(stats.thisMonth.signups).toBe(3);
  });

  it('calculates conversion rate, returns 0 when signups is 0', async () => {
    mockSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            allClicks: 10, allSignups: 0, allConversions: 0,
            monthClicks: 5, monthSignups: 0, monthConversions: 0,
          }]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ allEarnings: 0, monthEarnings: 0 }]),
        }),
      } as never);

    const stats = await getAffiliateStats('aff-1');
    expect(stats.thisMonth.conversionRate).toBe(0);
    expect(stats.allTime.conversionRate).toBe(0);
  });

  it('sums commission cents for earnings', async () => {
    mockSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            allClicks: 10, allSignups: 5, allConversions: 2,
            monthClicks: 3, monthSignups: 1, monthConversions: 1,
          }]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ allEarnings: 100000, monthEarnings: 25000 }]),
        }),
      } as never);

    const stats = await getAffiliateStats('aff-1');
    expect(stats.allTime.earningsCents).toBe(100000);
    expect(stats.thisMonth.earningsCents).toBe(25000);
  });
});

describe('getAffiliateReferrals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated results with correct total', async () => {
    const now = new Date();
    const rows = [
      { id: 'r1', status: 'CONVERTED', clickedAt: now, signedUpAt: now, convertedAt: now, churnedAt: null, referredUsername: 'user1', referredSignupDate: now },
    ];

    mockSelect
      .mockReturnValueOnce(mockSelectChain(rows))
      .mockReturnValueOnce(mockCountChain(5));

    const result = await getAffiliateReferrals('aff-1', { limit: 10, offset: 0 });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(5);
  });

  it('anonymizes usernames older than 30 days from signup', async () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const rows = [
      { id: 'r1', status: 'CONVERTED', clickedAt: oldDate, signedUpAt: oldDate, convertedAt: oldDate, churnedAt: null, referredUsername: 'olduser', referredSignupDate: oldDate },
    ];

    mockSelect
      .mockReturnValueOnce(mockSelectChain(rows))
      .mockReturnValueOnce(mockCountChain(1));

    const result = await getAffiliateReferrals('aff-1', { limit: 10, offset: 0 });
    expect(result.rows[0]!.referredUsername).toBeNull();
  });

  it('shows username if signup is within 30 days', async () => {
    const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const rows = [
      { id: 'r1', status: 'SIGNED_UP', clickedAt: recentDate, signedUpAt: recentDate, convertedAt: null, churnedAt: null, referredUsername: 'newuser', referredSignupDate: recentDate },
    ];

    mockSelect
      .mockReturnValueOnce(mockSelectChain(rows))
      .mockReturnValueOnce(mockCountChain(1));

    const result = await getAffiliateReferrals('aff-1', { limit: 10, offset: 0 });
    expect(result.rows[0]!.referredUsername).toBe('newuser');
  });

  it('shows username for CLICKED referrals (no signup yet)', async () => {
    const rows = [
      { id: 'r1', status: 'CLICKED', clickedAt: new Date(), signedUpAt: null, convertedAt: null, churnedAt: null, referredUsername: null, referredSignupDate: null },
    ];

    mockSelect
      .mockReturnValueOnce(mockSelectChain(rows))
      .mockReturnValueOnce(mockCountChain(1));

    const result = await getAffiliateReferrals('aff-1', { limit: 10, offset: 0 });
    // No signup yet, so not anonymized (username is null because no user joined)
    expect(result.rows[0]!.referredUsername).toBeNull();
  });
});

describe('getAffiliateCommissions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated results', async () => {
    const rows = [
      { id: 'c1', subscriptionProduct: 'store', grossRevenueCents: 2999, netRevenueCents: 2700, commissionRateBps: 1500, commissionCents: 405, status: 'PENDING', holdExpiresAt: new Date(), createdAt: new Date() },
    ];

    mockSelect
      .mockReturnValueOnce(mockSelectChain(rows))
      .mockReturnValueOnce(mockCountChain(3));

    const result = await getAffiliateCommissions('aff-1', { limit: 10, offset: 0 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.commissionCents).toBe(405);
  });

  it('returns correct total count', async () => {
    mockSelect
      .mockReturnValueOnce(mockSelectChain([]))
      .mockReturnValueOnce(mockCountChain(42));

    const result = await getAffiliateCommissions('aff-1', { limit: 10, offset: 0 });
    expect(result.total).toBe(42);
  });
});

describe('getAffiliatePayouts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated results', async () => {
    const rows = [
      { id: 'p1', affiliateId: 'aff-1', amountCents: 5000, method: 'stripe_connect', status: 'COMPLETED', periodStart: new Date(), periodEnd: new Date(), createdAt: new Date(), completedAt: new Date(), externalPayoutId: null, failedReason: null },
    ];

    mockSelect
      .mockReturnValueOnce(mockSelectChain(rows))
      .mockReturnValueOnce(mockCountChain(1));

    const result = await getAffiliatePayouts('aff-1', { limit: 10, offset: 0 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.amountCents).toBe(5000);
  });

  it('returns correct total count', async () => {
    mockSelect
      .mockReturnValueOnce(mockSelectChain([]))
      .mockReturnValueOnce(mockCountChain(7));

    const result = await getAffiliatePayouts('aff-1', { limit: 10, offset: 0 });
    expect(result.total).toBe(7);
  });
});
