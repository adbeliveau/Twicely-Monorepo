/**
 * G1-B Seller Onboarding — enableSellerAction and getOnboardingProgressAction tests.
 * Categories: A (auth), D (happy path), F (audit events), C (progress step logic)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: (type: string, conditions: Record<string, unknown>) => ({ ...conditions, __caslSubjectType__: type }),
}));
vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), transaction: vi.fn() },
}));
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { id: 'id', userId: 'user_id', storeSlug: 'store_slug' },
  businessInfo: { userId: 'user_id' },
  auditEvent: { id: 'id' },
  user: { id: 'id', isSeller: 'is_seller' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ type: 'eq', a, b })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));
vi.mock('@/lib/listings/seller-activate', () => ({
  ensureSellerProfile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/queries/seller', () => ({ getSellerProfile: vi.fn() }));
vi.mock('@/lib/queries/business-info', () => ({ getBusinessInfo: vi.fn() }));
vi.mock('@/lib/validations/seller-onboarding', () => ({
  businessInfoSchema: { safeParse: vi.fn() },
  storeNameSchema: { safeParse: vi.fn() },
}));

import { enableSellerAction } from '../seller-onboarding';
import { getOnboardingProgressAction } from '../seller-onboarding-store';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { ensureSellerProfile } from '@/lib/listings/seller-activate';
import { getSellerProfile } from '@/lib/queries/seller';
import { getBusinessInfo } from '@/lib/queries/business-info';

const mockAuthorize = vi.mocked(authorize);
const mockInsert = vi.mocked(db.insert);
const mockEnsureSellerProfile = vi.mocked(ensureSellerProfile);
const mockGetSellerProfile = vi.mocked(getSellerProfile);
const mockGetBusinessInfo = vi.mocked(getBusinessInfo);

describe('enableSellerAction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error for unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } as never });
    expect(await enableSellerAction()).toEqual({ success: false, error: 'Please sign in to continue' });
  });

  it('returns alreadySeller=true if user is already a seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', isSeller: true, delegationId: null } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    expect(await enableSellerAction()).toEqual({ success: true, alreadySeller: true });
    expect(mockEnsureSellerProfile).not.toHaveBeenCalled();
  });

  it('creates seller profile for new seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', isSeller: false, delegationId: null } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
    expect(await enableSellerAction()).toEqual({ success: true });
    expect(mockEnsureSellerProfile).toHaveBeenCalledWith('user-test-123');
  });

  it('emits SELLER_ACTIVATED audit event with correct fields', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', isSeller: false, delegationId: null } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues } as never);
    await enableSellerAction();
    const arg = mockValues.mock.calls[0]![0];
    expect(arg.action).toBe('SELLER_ACTIVATED');
    expect(arg.actorType).toBe('USER');
    expect(arg.actorId).toBe('user-test-123');
    expect(arg.subject).toBe('SellerProfile');
    expect(arg.severity).toBe('LOW');
  });
});

describe('getOnboardingProgressAction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error for unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } as never });
    expect(await getOnboardingProgressAction()).toEqual({ success: false, error: 'Please sign in to continue' });
  });

  it('returns step 1 when user has no businessInfo', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetSellerProfile.mockResolvedValue(null);
    mockGetBusinessInfo.mockResolvedValue(null);
    const result = await getOnboardingProgressAction();
    expect(result).toEqual({
      success: true,
      progress: { step: 1, hasBusinessInfo: false, hasStripe: false, hasStoreName: false, isComplete: false },
    });
  });

  it('returns step 2 when has businessInfo but no Stripe', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetSellerProfile.mockResolvedValue({ stripeOnboarded: false, storeName: null, storeSlug: null } as never);
    mockGetBusinessInfo.mockResolvedValue({ id: 'biz-test-1' } as never);
    const result = await getOnboardingProgressAction();
    expect(result).toEqual({
      success: true,
      progress: { step: 2, hasBusinessInfo: true, hasStripe: false, hasStoreName: false, isComplete: false },
    });
  });

  it('returns step 3 when has Stripe but no storeName', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetSellerProfile.mockResolvedValue({ stripeOnboarded: true, storeName: null, storeSlug: null } as never);
    mockGetBusinessInfo.mockResolvedValue({ id: 'biz-test-1' } as never);
    const result = await getOnboardingProgressAction();
    expect(result).toEqual({
      success: true,
      progress: { step: 3, hasBusinessInfo: true, hasStripe: true, hasStoreName: false, isComplete: false },
    });
  });

  it('returns step 4 (complete) when all steps done', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetSellerProfile.mockResolvedValue({ stripeOnboarded: true, storeName: 'My Store', storeSlug: 'my-store' } as never);
    mockGetBusinessInfo.mockResolvedValue({ id: 'biz-test-1' } as never);
    const result = await getOnboardingProgressAction();
    expect(result).toEqual({
      success: true,
      progress: { step: 4, hasBusinessInfo: true, hasStripe: true, hasStoreName: true, isComplete: true },
    });
  });

  it('uses onBehalfOfSellerId when delegationId is set', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'staff-test-999', delegationId: 'del-test-1', onBehalfOfSellerId: 'seller-test-456' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockGetSellerProfile.mockResolvedValue(null);
    mockGetBusinessInfo.mockResolvedValue(null);
    await getOnboardingProgressAction();
    expect(mockGetSellerProfile).toHaveBeenCalledWith('seller-test-456');
    expect(mockGetBusinessInfo).toHaveBeenCalledWith('seller-test-456');
  });
});
