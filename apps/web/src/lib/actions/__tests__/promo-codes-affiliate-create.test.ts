import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

vi.mock('@/lib/queries/affiliate', () => ({
  getAffiliateByUserId: vi.fn(),
}));

vi.mock('@/lib/queries/promo-codes', () => ({
  getPromoCodeByCode: vi.fn(),
  getPromoCodeById: vi.fn(),
}));

vi.mock('@twicely/stripe/promo-codes', () => ({
  syncPromoCodeToStripe: vi.fn(),
  deactivateStripePromotionCode: vi.fn(),
}));

vi.mock('../promo-codes-helpers', () => ({
  deactivateStripeIfExists: vi.fn(),
}));

import { createAffiliatePromoCode } from '../promo-codes-affiliate';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getAffiliateByUserId } from '@/lib/queries/affiliate';
import { getPromoCodeByCode } from '@/lib/queries/promo-codes';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);
const mockGetAffiliateByUserId = vi.mocked(getAffiliateByUserId);
const mockGetPromoCodeByCode = vi.mocked(getPromoCodeByCode);

function makeSession(overrides: Record<string, unknown> = {}) {
  return { userId: 'user-test-1', isSeller: true, ...overrides };
}

function makeAffiliate(overrides: Record<string, unknown> = {}) {
  return { id: 'aff-test-1', status: 'ACTIVE', tier: 'COMMUNITY', ...overrides };
}

// Sets up two sequential inserts: first returns the row, second is audit (no returning)
function makeInsertSequence(row: Record<string, unknown>) {
  mockInsert
    .mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([row]),
      }),
    } as never)
    .mockReturnValueOnce({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);
}

// count query: select({total}).from().where()
function makeSelectCountChain(total: number) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ total }]),
    }),
  } as never;
}

const validCreateInput = {
  code: 'SAVE10',
  discountType: 'PERCENTAGE',
  discountValue: 1000,
  durationMonths: 1,
};

// ─── auth checks ──────────────────────────────────────────────────────────────

describe('createAffiliatePromoCode — auth checks', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } } as never);
    const result = await createAffiliatePromoCode(validCreateInput);
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns Sellers only when user is not a seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession({ isSeller: false }) as never,
      ability: { can: vi.fn() } as never,
    });
    const result = await createAffiliatePromoCode(validCreateInput);
    expect(result).toEqual({ success: false, error: 'Sellers only' });
  });

  it('returns Forbidden when CASL denies create on PromoCode', async () => {
    // CASL check occurs before DB queries — no DB mocks needed here
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(false) } as never,
    });
    const result = await createAffiliatePromoCode(validCreateInput);
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });
});

// ─── validation ───────────────────────────────────────────────────────────────

describe('createAffiliatePromoCode — validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
  });

  it('returns Invalid input for missing code', async () => {
    const result = await createAffiliatePromoCode({ discountType: 'PERCENTAGE', discountValue: 1000 });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns Invalid input for unknown fields (strict schema)', async () => {
    const result = await createAffiliatePromoCode({ ...validCreateInput, extra: 'bad' });
    expect(result.success).toBe(false);
  });
});

// ─── affiliate checks ─────────────────────────────────────────────────────────

describe('createAffiliatePromoCode — affiliate checks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
  });

  it('returns error when affiliate record not found', async () => {
    mockGetAffiliateByUserId.mockResolvedValue(null);
    const result = await createAffiliatePromoCode(validCreateInput);
    expect(result).toEqual({ success: false, error: 'Affiliate record not found' });
  });

  it('returns error when affiliate account is SUSPENDED', async () => {
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate({ status: 'SUSPENDED' }) as never);
    const result = await createAffiliatePromoCode(validCreateInput);
    expect(result).toEqual({ success: false, error: 'Your affiliate account is not active' });
  });
});

// ─── discount limits (COMMUNITY tier) ────────────────────────────────────────

describe('createAffiliatePromoCode — discount limits (COMMUNITY tier)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate({ tier: 'COMMUNITY' }) as never);
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) => {
      const map: Record<string, unknown> = {
        'affiliate.maxPromoDiscountBps': 2000,
        'affiliate.community.maxFixedPromoDiscountCents': 5000,
        'affiliate.community.maxPromoCodeDurationMonths': 3,
        'affiliate.community.maxActivePromoCodes': 3,
      };
      return Promise.resolve(map[key] ?? fallback);
    });
  });

  it('rejects PERCENTAGE discount exceeding community max (2000 BPS = 20%)', async () => {
    const result = await createAffiliatePromoCode({ ...validCreateInput, discountValue: 2001 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('20%');
  });

  it('accepts PERCENTAGE discount at community max (exactly 2000 BPS)', async () => {
    mockSelect.mockReturnValueOnce(makeSelectCountChain(0));
    mockGetPromoCodeByCode.mockResolvedValue(null);
    makeInsertSequence({ id: 'pc-new', code: 'SAVE10' });
    const result = await createAffiliatePromoCode({ ...validCreateInput, discountValue: 2000 });
    expect(result.success).toBe(true);
  });

  it('rejects FIXED discount over $50 (5000 cents)', async () => {
    const result = await createAffiliatePromoCode({ ...validCreateInput, discountType: 'FIXED', discountValue: 5001 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('$50');
  });

  it('rejects FIXED discount over community max from platform settings (5000 cents = $50)', async () => {
    const result = await createAffiliatePromoCode({
      ...validCreateInput,
      discountType: 'FIXED',
      discountValue: 5001,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('$50');
  });

  it('accepts FIXED discount at community max (exactly 5000 cents)', async () => {
    mockSelect.mockReturnValueOnce(makeSelectCountChain(0));
    mockGetPromoCodeByCode.mockResolvedValue(null);
    makeInsertSequence({ id: 'pc-new', code: 'FIXED50', discountType: 'FIXED' });
    const result = await createAffiliatePromoCode({
      ...validCreateInput,
      discountType: 'FIXED',
      discountValue: 5000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects durationMonths > 3 for COMMUNITY tier', async () => {
    const result = await createAffiliatePromoCode({ ...validCreateInput, durationMonths: 4 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('3 months');
  });

  it('rejects creating more than 3 active codes for COMMUNITY tier', async () => {
    mockSelect.mockReturnValueOnce(makeSelectCountChain(3));
    const result = await createAffiliatePromoCode(validCreateInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain('3');
  });
});

// ─── discount limits (INFLUENCER tier) ───────────────────────────────────────

describe('createAffiliatePromoCode — discount limits (INFLUENCER tier)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate({ tier: 'INFLUENCER' }) as never);
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) => {
      const map: Record<string, unknown> = {
        'affiliate.maxInfluencerDiscountBps': 5000,
        'affiliate.influencer.maxFixedPromoDiscountCents': 10000,
        'affiliate.influencer.maxPromoCodeDurationMonths': 6,
        'affiliate.influencer.maxActivePromoCodes': 10,
      };
      return Promise.resolve(map[key] ?? fallback);
    });
  });

  it('rejects PERCENTAGE discount exceeding influencer max (5000 BPS = 50%)', async () => {
    const result = await createAffiliatePromoCode({ ...validCreateInput, discountValue: 5001 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('50%');
  });

  it('rejects FIXED discount over influencer max from platform settings (10000 cents = $100)', async () => {
    const result = await createAffiliatePromoCode({
      ...validCreateInput,
      discountType: 'FIXED',
      discountValue: 10001,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('$100');
  });

  it('accepts FIXED discount at influencer max (exactly 10000 cents)', async () => {
    mockSelect.mockReturnValueOnce(makeSelectCountChain(0));
    mockGetPromoCodeByCode.mockResolvedValue(null);
    makeInsertSequence({ id: 'pc-new', code: 'FIXED100', discountType: 'FIXED' });
    const result = await createAffiliatePromoCode({
      ...validCreateInput,
      discountType: 'FIXED',
      discountValue: 10000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects durationMonths > 6 for INFLUENCER tier', async () => {
    const result = await createAffiliatePromoCode({ ...validCreateInput, durationMonths: 7 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('6 months');
  });

  it('rejects creating more than 10 active codes for INFLUENCER tier', async () => {
    mockSelect.mockReturnValueOnce(makeSelectCountChain(10));
    const result = await createAffiliatePromoCode(validCreateInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain('10');
  });
});

// ─── code uniqueness + happy path ─────────────────────────────────────────────

describe('createAffiliatePromoCode — code uniqueness + happy path', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate() as never);
    mockGetPlatformSetting.mockResolvedValue(2000 as never);
  });

  it('returns error when code already exists', async () => {
    mockSelect.mockReturnValueOnce(makeSelectCountChain(0));
    mockGetPromoCodeByCode.mockResolvedValue({ id: 'existing' } as never);
    const result = await createAffiliatePromoCode(validCreateInput);
    expect(result).toEqual({ success: false, error: 'This code is already in use' });
  });

  it('returns success and writes audit event on creation', async () => {
    mockSelect.mockReturnValueOnce(makeSelectCountChain(0));
    mockGetPromoCodeByCode.mockResolvedValue(null);
    makeInsertSequence({ id: 'pc-new-1', code: 'SAVE10', discountType: 'PERCENTAGE' });
    const result = await createAffiliatePromoCode(validCreateInput);
    expect(result).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
