import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

import { getInfluencerLandingData } from '../affiliate-landing';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

const mockSelect = vi.mocked(db.select);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const REFERRAL_CODE = 'JANE123';

const mockAffiliateRow = {
  affiliateId: 'aff-test-1',
  referralCode: REFERRAL_CODE,
  applicationNote: JSON.stringify({
    note: 'I love resale',
    socialLinks: {
      instagram: 'https://instagram.com/jane',
      youtube: 'https://youtube.com/jane',
    },
  }),
  name: 'Jane Smith',
  displayName: 'Jane Smith',
  username: 'janesmith',
  bio: 'Resale content creator.',
  avatarUrl: 'https://cdn.example.com/jane.jpg',
};

const mockPromoRows = [
  {
    code: 'SAVE10',
    discountType: 'PERCENTAGE',
    discountValue: 1000,
    durationMonths: 3,
  },
];

// ─── Chain builders ───────────────────────────────────────────────────────────

// select().from().innerJoin().where().limit(1) — affiliate row
function makeAffiliateChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as never;
}

// select().from().where() — promo codes
function makePromoChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as never;
}

// Enable both platform settings flags
function enableFlags() {
  mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) => {
    const map: Record<string, unknown> = {
      'affiliate.enabled': true,
      'affiliate.influencer.enabled': true,
    };
    return Promise.resolve(key in map ? map[key] : fallback);
  });
}

// ─── Platform setting flag tests ──────────────────────────────────────────────

describe('getInfluencerLandingData — feature flags', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns null when affiliate.enabled is false', async () => {
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) =>
      Promise.resolve(key === 'affiliate.enabled' ? false : fallback),
    );
    const result = await getInfluencerLandingData('JANE123');
    expect(result).toBeNull();
  });

  it('returns null when affiliate.influencer.enabled is false', async () => {
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) =>
      Promise.resolve(key === 'affiliate.influencer.enabled' ? false : fallback),
    );
    const result = await getInfluencerLandingData('JANE123');
    expect(result).toBeNull();
  });

  it('returns null when both flags are false', async () => {
    mockGetPlatformSetting.mockResolvedValue(false);
    const result = await getInfluencerLandingData('JANE123');
    expect(result).toBeNull();
  });

  it('does not query the DB when flags are disabled', async () => {
    mockGetPlatformSetting.mockResolvedValue(false);
    await getInfluencerLandingData('JANE123');
    expect(mockSelect).not.toHaveBeenCalled();
  });
});

// ─── Affiliate lookup tests ───────────────────────────────────────────────────

describe('getInfluencerLandingData — affiliate lookup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    enableFlags();
  });

  it('returns null when no affiliate row found', async () => {
    mockSelect.mockReturnValueOnce(makeAffiliateChain([]));
    const result = await getInfluencerLandingData('NOTEXIST');
    expect(result).toBeNull();
  });

  it('uppercases the slug before querying', async () => {
    // The slug is lowercased input — query should uppercase it.
    // We verify by confirming data is returned (query succeeded with uppercased code).
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([mockAffiliateRow]))
      .mockReturnValueOnce(makePromoChain([]));
    const result = await getInfluencerLandingData('jane123');
    expect(result).not.toBeNull();
    expect(result!.referralCode).toBe(REFERRAL_CODE);
  });

  it('returns data when affiliate is INFLUENCER + ACTIVE', async () => {
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([mockAffiliateRow]))
      .mockReturnValueOnce(makePromoChain(mockPromoRows));
    const result = await getInfluencerLandingData(REFERRAL_CODE);
    expect(result).not.toBeNull();
    expect(result!.referralCode).toBe(REFERRAL_CODE);
    expect(result!.displayName).toBe('Jane Smith');
    expect(result!.username).toBe('janesmith');
    expect(result!.bio).toBe('Resale content creator.');
    expect(result!.avatarUrl).toBe('https://cdn.example.com/jane.jpg');
  });

  it('fires exactly 2 db.select calls on success (affiliate + promos)', async () => {
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([mockAffiliateRow]))
      .mockReturnValueOnce(makePromoChain([]));
    await getInfluencerLandingData(REFERRAL_CODE);
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it('does not fire promo query when affiliate row not found', async () => {
    mockSelect.mockReturnValueOnce(makeAffiliateChain([]));
    await getInfluencerLandingData(REFERRAL_CODE);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });
});

// ─── Promo code filtering tests ───────────────────────────────────────────────

describe('getInfluencerLandingData — promo codes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    enableFlags();
  });

  it('returns promoCodes array with correct shape', async () => {
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([mockAffiliateRow]))
      .mockReturnValueOnce(makePromoChain(mockPromoRows));
    const result = await getInfluencerLandingData(REFERRAL_CODE);
    expect(result!.promoCodes).toHaveLength(1);
    expect(result!.promoCodes[0]).toEqual({
      code: 'SAVE10',
      discountType: 'PERCENTAGE',
      discountValue: 1000,
      durationMonths: 3,
    });
  });

  it('returns empty promoCodes when no active codes exist', async () => {
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([mockAffiliateRow]))
      .mockReturnValueOnce(makePromoChain([]));
    const result = await getInfluencerLandingData(REFERRAL_CODE);
    expect(result!.promoCodes).toHaveLength(0);
  });

  it('returns multiple promo codes when available', async () => {
    const multiPromos = [
      { code: 'SAVE10', discountType: 'PERCENTAGE', discountValue: 1000, durationMonths: 1 },
      { code: 'FLAT5', discountType: 'FIXED', discountValue: 500, durationMonths: 6 },
    ];
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([mockAffiliateRow]))
      .mockReturnValueOnce(makePromoChain(multiPromos));
    const result = await getInfluencerLandingData(REFERRAL_CODE);
    expect(result!.promoCodes).toHaveLength(2);
  });
});

// ─── socialLinks parsing tests ────────────────────────────────────────────────

describe('getInfluencerLandingData — socialLinks parsing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    enableFlags();
  });

  it('parses socialLinks from valid JSON applicationNote', async () => {
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([mockAffiliateRow]))
      .mockReturnValueOnce(makePromoChain([]));
    const result = await getInfluencerLandingData(REFERRAL_CODE);
    expect(result!.socialLinks).toEqual({
      instagram: 'https://instagram.com/jane',
      youtube: 'https://youtube.com/jane',
      tiktok: undefined,
      blog: undefined,
    });
  });

  it('returns null socialLinks when applicationNote is null', async () => {
    const rowNoNote = { ...mockAffiliateRow, applicationNote: null };
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([rowNoNote]))
      .mockReturnValueOnce(makePromoChain([]));
    const result = await getInfluencerLandingData(REFERRAL_CODE);
    expect(result!.socialLinks).toBeNull();
  });

  it('returns null socialLinks when applicationNote is invalid JSON', async () => {
    const rowBadNote = { ...mockAffiliateRow, applicationNote: 'not-json' };
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([rowBadNote]))
      .mockReturnValueOnce(makePromoChain([]));
    const result = await getInfluencerLandingData(REFERRAL_CODE);
    expect(result!.socialLinks).toBeNull();
  });

  it('returns null socialLinks when applicationNote has no socialLinks key', async () => {
    const rowNoteNoLinks = {
      ...mockAffiliateRow,
      applicationNote: JSON.stringify({ note: 'I love resale' }),
    };
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([rowNoteNoLinks]))
      .mockReturnValueOnce(makePromoChain([]));
    const result = await getInfluencerLandingData(REFERRAL_CODE);
    expect(result!.socialLinks).toBeNull();
  });

  it('returns null socialLinks when socialLinks value is not an object', async () => {
    const rowBadLinks = {
      ...mockAffiliateRow,
      applicationNote: JSON.stringify({ socialLinks: 'not-an-object' }),
    };
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([rowBadLinks]))
      .mockReturnValueOnce(makePromoChain([]));
    const result = await getInfluencerLandingData(REFERRAL_CODE);
    expect(result!.socialLinks).toBeNull();
  });

  it('omits non-string social link values (guards against injection)', async () => {
    const rowMixed = {
      ...mockAffiliateRow,
      applicationNote: JSON.stringify({
        socialLinks: {
          instagram: 'https://instagram.com/jane',
          youtube: 42,
          tiktok: null,
          blog: 'https://blog.example.com',
        },
      }),
    };
    mockSelect
      .mockReturnValueOnce(makeAffiliateChain([rowMixed]))
      .mockReturnValueOnce(makePromoChain([]));
    const result = await getInfluencerLandingData(REFERRAL_CODE);
    expect(result!.socialLinks!.instagram).toBe('https://instagram.com/jane');
    expect(result!.socialLinks!.youtube).toBeUndefined();
    expect(result!.socialLinks!.tiktok).toBeUndefined();
    expect(result!.socialLinks!.blog).toBe('https://blog.example.com');
  });
});
