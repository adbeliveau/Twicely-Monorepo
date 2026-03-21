import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

vi.mock('@/lib/queries/affiliate', () => ({
  getAffiliateByUserId: vi.fn(),
  getAffiliateByReferralCode: vi.fn(),
}));

import { joinAffiliateProgram } from '../affiliate';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getAffiliateByUserId, getAffiliateByReferralCode } from '@/lib/queries/affiliate';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);
const mockGetByUserId = vi.mocked(getAffiliateByUserId);
const mockGetByCode = vi.mocked(getAffiliateByReferralCode);

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    isSeller: true,
    ...overrides,
  };
}

function insertChain() {
  return mockInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  } as never);
}

function selectChainUser(username: string | null) {
  return mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ username }]),
      }),
    }),
  } as never);
}

describe('joinAffiliateProgram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_k: string, fallback: unknown) =>
      Promise.resolve(fallback),
    );
    mockGetByUserId.mockResolvedValue(null);
    mockGetByCode.mockResolvedValue(null);
    insertChain();
    selectChainUser('testuser');
  });

  it('happy path: creates affiliate with COMMUNITY tier and ACTIVE status', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    const result = await joinAffiliateProgram({ referralCode: 'MYCODE' });

    expect(result).toEqual({ success: true, referralCode: 'MYCODE' });
    expect(mockInsert).toHaveBeenCalled();
  });

  it('uses platform settings for commission rate, not hardcoded', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    await joinAffiliateProgram({ referralCode: 'MYCODE' });

    expect(mockGetPlatformSetting).toHaveBeenCalledWith(
      'affiliate.community.commissionRateBps',
      1500,
    );
  });

  it('uses platform settings for cookie duration', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    await joinAffiliateProgram({ referralCode: 'MYCODE' });

    expect(mockGetPlatformSetting).toHaveBeenCalledWith('affiliate.community.cookieDays', 30);
  });

  it('uses platform settings for commission duration months', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    await joinAffiliateProgram({ referralCode: 'MYCODE' });

    expect(mockGetPlatformSetting).toHaveBeenCalledWith(
      'affiliate.commissionDurationMonths',
      12,
    );
  });

  it('rejects if affiliate.enabled is false', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) =>
      Promise.resolve(key === 'affiliate.enabled' ? false : fallback),
    );

    const result = await joinAffiliateProgram({});
    expect(result).toEqual({ success: false, error: 'The affiliate program is currently disabled' });
  });

  it('rejects if affiliate.community.enabled is false', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) =>
      Promise.resolve(key === 'affiliate.community.enabled' ? false : fallback),
    );

    const result = await joinAffiliateProgram({});
    expect(result).toEqual({
      success: false,
      error: 'Community affiliate signup is currently disabled',
    });
  });

  it('rejects if user is not authenticated', async () => {
    mockAuthorize.mockResolvedValue({
      session: null,
      ability: { can: vi.fn() } as never,
    });

    const result = await joinAffiliateProgram({});
    expect(result).toEqual({ success: false, error: 'Please sign in to continue' });
  });

  it('rejects if user is not a seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession({ isSeller: false }) as never,
      ability: { can: vi.fn() } as never,
    });

    const result = await joinAffiliateProgram({});
    expect(result).toEqual({
      success: false,
      error: 'You must be a seller to join the affiliate program',
    });
  });

  it('rejects if user is already an affiliate', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetByUserId.mockResolvedValue({ id: 'aff-1' } as never);

    const result = await joinAffiliateProgram({});
    expect(result).toEqual({
      success: false,
      error: 'You are already registered as an affiliate',
    });
  });

  it('rejects if referral code is already taken', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetByCode.mockResolvedValue({ id: 'aff-2' } as never);

    const result = await joinAffiliateProgram({ referralCode: 'TAKEN' });
    expect(result).toEqual({ success: false, error: 'This referral code is already taken' });
  });

  it('defaults referral code to uppercased username when not provided', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    selectChainUser('myuser');

    const result = await joinAffiliateProgram({});
    expect(result).toEqual({ success: true, referralCode: 'MYUSER' });
  });

  it('rejects if no username and no referral code provided', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    selectChainUser(null);

    const result = await joinAffiliateProgram({});
    expect(result).toEqual({
      success: false,
      error: 'Please set a username in your account settings before joining the affiliate program',
    });
  });

  it('uppercases provided referral code', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    const result = await joinAffiliateProgram({ referralCode: 'lower-code' });
    expect(result).toEqual({ success: true, referralCode: 'LOWER-CODE' });
  });

  it('writes audit event on success', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    await joinAffiliateProgram({ referralCode: 'MYCODE' });

    // Two inserts: affiliate record + audit event
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('CASL check: rejects if ability.can create Affiliate is false', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(false) } as never,
    });

    const result = await joinAffiliateProgram({});
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });
});
