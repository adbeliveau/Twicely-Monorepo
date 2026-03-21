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

import {
  updateAffiliatePromoCode,
  deleteAffiliatePromoCode,
} from '../promo-codes-affiliate';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getAffiliateByUserId } from '@/lib/queries/affiliate';
import { getPromoCodeById } from '@/lib/queries/promo-codes';
import { deactivateStripeIfExists } from '../promo-codes-helpers';

const mockAuthorize = vi.mocked(authorize);
const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);
const mockGetAffiliateByUserId = vi.mocked(getAffiliateByUserId);
const mockGetPromoCodeById = vi.mocked(getPromoCodeById);
const mockDeactivateStripeIfExists = vi.mocked(deactivateStripeIfExists);

function makeSession(overrides: Record<string, unknown> = {}) {
  return { userId: 'user-test-1', isSeller: true, ...overrides };
}

function makeAffiliate(overrides: Record<string, unknown> = {}) {
  return { id: 'aff-test-1', status: 'ACTIVE', tier: 'COMMUNITY', ...overrides };
}

function makeInsertNoReturn() {
  return mockInsert.mockReturnValueOnce({
    values: vi.fn().mockResolvedValue(undefined),
  } as never);
}

function makeUpdateChain() {
  return mockUpdate.mockReturnValueOnce({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as never);
}

// ─── updateAffiliatePromoCode ─────────────────────────────────────────────────

describe('updateAffiliatePromoCode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } } as never);
    const result = await updateAffiliatePromoCode({ id: 'pc-1', isActive: false });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns Invalid input for missing id', async () => {
    const result = await updateAffiliatePromoCode({ isActive: false });
    expect(result.success).toBe(false);
  });

  it('returns Not found when promo code does not exist', async () => {
    mockGetPromoCodeById.mockResolvedValue(null);
    const result = await updateAffiliatePromoCode({ id: 'missing', isActive: false });
    expect(result).toEqual({ success: false, error: 'Not found' });
  });

  it('returns Not found when code belongs to different affiliate', async () => {
    mockGetPromoCodeById.mockResolvedValue({ id: 'pc-1', affiliateId: 'aff-other' } as never);
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate({ id: 'aff-test-1' }) as never);
    const result = await updateAffiliatePromoCode({ id: 'pc-1', isActive: false });
    expect(result).toEqual({ success: false, error: 'Not found' });
  });

  it('calls deactivateStripeIfExists when setting isActive to false', async () => {
    mockGetPromoCodeById.mockResolvedValue({ id: 'pc-1', affiliateId: 'aff-test-1', code: 'SAVE10' } as never);
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate() as never);
    makeUpdateChain();
    mockDeactivateStripeIfExists.mockResolvedValue(undefined);
    makeInsertNoReturn();

    await updateAffiliatePromoCode({ id: 'pc-1', isActive: false });
    expect(mockDeactivateStripeIfExists).toHaveBeenCalledWith('SAVE10');
  });

  it('does not call deactivateStripeIfExists when isActive is not false', async () => {
    mockGetPromoCodeById.mockResolvedValue({ id: 'pc-1', affiliateId: 'aff-test-1', code: 'SAVE10' } as never);
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate() as never);
    makeUpdateChain();
    makeInsertNoReturn();

    await updateAffiliatePromoCode({ id: 'pc-1', isActive: true });
    expect(mockDeactivateStripeIfExists).not.toHaveBeenCalled();
  });

  it('returns success and writes audit event on update', async () => {
    mockGetPromoCodeById.mockResolvedValue({ id: 'pc-1', affiliateId: 'aff-test-1', code: 'SAVE10' } as never);
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate() as never);
    makeUpdateChain();
    makeInsertNoReturn();

    const result = await updateAffiliatePromoCode({ id: 'pc-1', isActive: true });
    expect(result).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});

// ─── deleteAffiliatePromoCode ─────────────────────────────────────────────────

describe('deleteAffiliatePromoCode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } } as never);
    const result = await deleteAffiliatePromoCode('pc-1');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns Not found when promo code does not exist', async () => {
    mockGetPromoCodeById.mockResolvedValue(null);
    const result = await deleteAffiliatePromoCode('missing');
    expect(result).toEqual({ success: false, error: 'Not found' });
  });

  it('returns Not found when code belongs to a different affiliate', async () => {
    mockGetPromoCodeById.mockResolvedValue({ id: 'pc-1', affiliateId: 'aff-other', code: 'SAVE10' } as never);
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate({ id: 'aff-mine' }) as never);
    const result = await deleteAffiliatePromoCode('pc-1');
    expect(result).toEqual({ success: false, error: 'Not found' });
  });

  it('sets isActive=false and calls deactivateStripeIfExists on delete', async () => {
    mockGetPromoCodeById.mockResolvedValue({ id: 'pc-1', affiliateId: 'aff-test-1', code: 'SAVE10' } as never);
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate() as never);
    makeUpdateChain();
    mockDeactivateStripeIfExists.mockResolvedValue(undefined);
    makeInsertNoReturn();

    const result = await deleteAffiliatePromoCode('pc-1');
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockDeactivateStripeIfExists).toHaveBeenCalledWith('SAVE10');
  });

  it('returns Forbidden when CASL denies delete on PromoCode', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: { can: vi.fn().mockReturnValue(false) } as never,
    });
    mockGetPromoCodeById.mockResolvedValue({ id: 'pc-1', affiliateId: 'aff-test-1', code: 'SAVE10' } as never);
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate() as never);

    const result = await deleteAffiliatePromoCode('pc-1');
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('writes audit event on successful delete', async () => {
    mockGetPromoCodeById.mockResolvedValue({ id: 'pc-1', affiliateId: 'aff-test-1', code: 'SAVE10' } as never);
    mockGetAffiliateByUserId.mockResolvedValue(makeAffiliate() as never);
    makeUpdateChain();
    mockDeactivateStripeIfExists.mockResolvedValue(undefined);
    makeInsertNoReturn();

    await deleteAffiliatePromoCode('pc-1');
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
