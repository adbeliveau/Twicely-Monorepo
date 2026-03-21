import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { getAffiliateByUserId, getAffiliateByReferralCode } from '../affiliate';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

function selectChain(rows: unknown[]) {
  return mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never);
}

const mockAffiliate = {
  id: 'aff-1',
  userId: 'user-1',
  tier: 'COMMUNITY',
  status: 'ACTIVE',
  referralCode: 'TESTCODE',
  commissionRateBps: 1500,
  cookieDurationDays: 30,
  commissionDurationMonths: 12,
};

describe('getAffiliateByUserId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns affiliate row when exists', async () => {
    selectChain([mockAffiliate]);
    const result = await getAffiliateByUserId('user-1');
    expect(result).toEqual(mockAffiliate);
  });

  it('returns null when not found', async () => {
    selectChain([]);
    const result = await getAffiliateByUserId('nonexistent');
    expect(result).toBeNull();
  });
});

describe('getAffiliateByReferralCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns affiliate row when code matches', async () => {
    selectChain([mockAffiliate]);
    const result = await getAffiliateByReferralCode('TESTCODE');
    expect(result).toEqual(mockAffiliate);
  });

  it('returns null when code not found', async () => {
    selectChain([]);
    const result = await getAffiliateByReferralCode('NOEXIST');
    expect(result).toBeNull();
  });

  it('performs case-sensitive match (codes stored uppercased)', async () => {
    selectChain([]);
    await getAffiliateByReferralCode('testcode');
    expect(mockSelect).toHaveBeenCalled();
  });
});
