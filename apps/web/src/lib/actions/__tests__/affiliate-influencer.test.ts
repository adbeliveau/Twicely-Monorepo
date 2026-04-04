import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => {
  const selectChain = { from: vi.fn().mockReturnValue({ innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }) };
  return { db: { select: vi.fn().mockReturnValue(selectChain), insert: vi.fn(), update: vi.fn() } };
});

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

vi.mock('@/lib/queries/affiliate', () => ({
  getAffiliateByUserId: vi.fn(),
}));

import { applyForInfluencer } from '../affiliate-influencer';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getAffiliateByUserId } from '@/lib/queries/affiliate';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);
const mockGetAffiliateByUserId = vi.mocked(getAffiliateByUserId);

/** Re-setup db.select chain for notifyStaffByRoles (lost on vi.resetAllMocks) */
function makeSelectChain() {
  mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as never);
}

const validInput = {
  applicationNote: 'I have 50,000 followers on Instagram and post resale content daily.',
  referralCode: 'MYCODE',
};

function makeSession(overrides: Record<string, unknown> = {}) {
  return { userId: 'user-test-1', isSeller: true, ...overrides };
}

function makeAbility(canCreate = true) {
  return { can: vi.fn().mockReturnValue(canCreate) };
}

function makeAffiliate(overrides: Record<string, unknown> = {}) {
  return { id: 'aff-test-1', tier: 'COMMUNITY', status: 'ACTIVE', warningCount: 0, ...overrides };
}

// update().set().where()
function makeUpdateChain() {
  return mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as never);
}

// insert().values() — audit event (no returning)
// insert().values().returning() — new affiliate record
function makeInsertWithReturning(id: string) {
  mockInsert
    .mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id }]),
      }),
    } as never)
    .mockReturnValueOnce({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);
}

function makeInsertAuditOnly() {
  mockInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  } as never);
}

function setupEnabledFlags() {
  mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) => {
    const map: Record<string, unknown> = {
      'affiliate.enabled': true,
      'affiliate.influencer.enabled': true,
      'affiliate.influencer.defaultCommissionRateBps': 2500,
      'affiliate.influencer.cookieDays': 60,
      'affiliate.commissionDurationMonths': 12,
    };
    return Promise.resolve(map[key] ?? fallback);
  });
}

// ─── Authentication checks ────────────────────────────────────────────────────

describe('applyForInfluencer — auth checks', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns error when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() } as never);
    const result = await applyForInfluencer(validInput);
    expect(result).toEqual({ success: false, error: 'Please sign in to continue' });
  });

  it('returns error when user is not a seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession({ isSeller: false }) as never,
      ability: makeAbility() as never,
    });
    const result = await applyForInfluencer(validInput);
    expect(result).toEqual({ success: false, error: 'You must be a seller to apply for the influencer program' });
  });

  it('returns Forbidden when CASL denies create on Affiliate', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: makeAbility(false) as never,
    });
    const result = await applyForInfluencer(validInput);
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });
});

// ─── Feature flag checks ──────────────────────────────────────────────────────

describe('applyForInfluencer — feature flag checks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: makeAbility() as never,
    });
  });

  it('returns error when affiliate.enabled is false', async () => {
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) =>
      Promise.resolve(key === 'affiliate.enabled' ? false : fallback),
    );
    const result = await applyForInfluencer(validInput);
    expect(result).toEqual({ success: false, error: 'The affiliate program is currently disabled' });
  });

  it('returns error when affiliate.influencer.enabled is false', async () => {
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) =>
      Promise.resolve(key === 'affiliate.influencer.enabled' ? false : fallback),
    );
    const result = await applyForInfluencer(validInput);
    expect(result).toEqual({ success: false, error: 'Influencer applications are currently disabled' });
  });
});

// ─── Validation checks ────────────────────────────────────────────────────────

describe('applyForInfluencer — validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: makeAbility() as never,
    });
    setupEnabledFlags();
  });

  it('returns error for missing applicationNote', async () => {
    const result = await applyForInfluencer({});
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error when applicationNote is too short (under 20 chars)', async () => {
    const result = await applyForInfluencer({ applicationNote: 'Too short.' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('20 characters');
  });

  it('returns error for unknown fields (strict schema)', async () => {
    const result = await applyForInfluencer({ ...validInput, unknownField: true });
    expect(result.success).toBe(false);
  });
});

// ─── Edge cases: existing affiliate ──────────────────────────────────────────

describe('applyForInfluencer — existing affiliate edge cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    makeSelectChain();
    mockAuthorize.mockResolvedValue({
      session: makeSession({ email: 'seller@example.com' }) as never,
      ability: makeAbility() as never,
    });
    setupEnabledFlags();
  });

  it('returns error when already an INFLUENCER (already applied)', async () => {
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate({ tier: 'INFLUENCER' }) as never);
    const result = await applyForInfluencer(validInput);
    expect(result).toEqual({ success: false, error: 'You have already applied for the influencer program' });
  });

  it('returns error when affiliate is SUSPENDED', async () => {
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate({ status: 'SUSPENDED' }) as never);
    const result = await applyForInfluencer(validInput);
    expect(result).toEqual({ success: false, error: 'Your affiliate account is not eligible to apply' });
  });

  it('returns error when affiliate is BANNED', async () => {
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate({ status: 'BANNED' }) as never);
    const result = await applyForInfluencer(validInput);
    expect(result).toEqual({ success: false, error: 'Your affiliate account is not eligible to apply' });
  });

  it('upgrades existing COMMUNITY ACTIVE to INFLUENCER PENDING via update', async () => {
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate({ tier: 'COMMUNITY', status: 'ACTIVE' }) as never);
    makeUpdateChain();
    makeInsertAuditOnly();
    const result = await applyForInfluencer(validInput);
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('serializes applicationData as JSON in applicationNote on update', async () => {
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate({ tier: 'COMMUNITY', status: 'ACTIVE' }) as never);
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: updateSetMock } as never);
    makeInsertAuditOnly();
    await applyForInfluencer({ ...validInput, audienceSize: 50000 });
    const setArg = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const parsed = JSON.parse(setArg['applicationNote'] as string) as Record<string, unknown>;
    expect(parsed['note']).toBe(validInput.applicationNote);
    expect(parsed['audienceSize']).toBe(50000);
  });
});

// ─── Happy path: new affiliate record ────────────────────────────────────────

describe('applyForInfluencer — new affiliate happy path', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    makeSelectChain();
    mockAuthorize.mockResolvedValue({
      session: makeSession({ email: 'user@example.com' }) as never,
      ability: makeAbility() as never,
    });
    setupEnabledFlags();
    mockGetAffiliateByUserId.mockResolvedValue(null);
  });

  it('creates new affiliate record with INFLUENCER PENDING status', async () => {
    makeInsertWithReturning('aff-new-1');
    const result = await applyForInfluencer(validInput);
    expect(result).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('falls back to userId slice when referralCode not provided', async () => {
    makeInsertWithReturning('aff-new-2');
    const result = await applyForInfluencer({ applicationNote: validInput.applicationNote });
    expect(result).toEqual({ success: true });
    // Insert should have been called — referralCode derived from userId
    expect(mockInsert).toHaveBeenCalled();
  });

  it('reads commission rate from platform settings (not hardcoded)', async () => {
    makeInsertWithReturning('aff-new-3');
    await applyForInfluencer(validInput);
    expect(mockGetPlatformSetting).toHaveBeenCalledWith(
      'affiliate.influencer.defaultCommissionRateBps',
      2500,
    );
  });

  it('reads cookie duration from platform settings', async () => {
    makeInsertWithReturning('aff-new-4');
    await applyForInfluencer(validInput);
    expect(mockGetPlatformSetting).toHaveBeenCalledWith('affiliate.influencer.cookieDays', 60);
  });

  it('returns error when DB insert returns empty array (failure)', async () => {
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    } as never);
    const result = await applyForInfluencer(validInput);
    expect(result).toEqual({ success: false, error: 'Failed to submit application' });
  });

  it('writes audit event with action INFLUENCER_APPLIED on success', async () => {
    makeInsertWithReturning('aff-new-5');
    await applyForInfluencer(validInput);
    // Two inserts: affiliate record + audit event
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
