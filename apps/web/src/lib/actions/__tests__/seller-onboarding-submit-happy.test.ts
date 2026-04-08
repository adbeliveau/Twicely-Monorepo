/**
 * G1-B Seller Onboarding — submitBusinessInfoAction happy path and updateBusinessInfoAction tests.
 * Categories: D (happy path), F (audit events), E (update guard)
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
  sellerProfile: { id: 'id', userId: 'user_id' },
  businessInfo: { userId: 'user_id' },
  auditEvent: { id: 'id' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ type: 'eq', a, b })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/listings/seller-activate', () => ({
  ensureSellerProfile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/queries/seller', () => ({ getSellerProfile: vi.fn() }));
vi.mock('@/lib/queries/business-info', () => ({ getBusinessInfo: vi.fn() }));
vi.unmock('@/lib/validations/seller-onboarding');

import { submitBusinessInfoAction, updateBusinessInfoAction } from '../seller-onboarding';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getBusinessInfo } from '@/lib/queries/business-info';
import { getSellerProfile } from '@/lib/queries/seller';

const mockAuthorize = vi.mocked(authorize);
const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);
const mockTransaction = vi.mocked(db.transaction);
const mockGetBusinessInfo = vi.mocked(getBusinessInfo);
const mockGetSellerProfile = vi.mocked(getSellerProfile);

const validBizInput = {
  businessName: 'Acme LLC',
  businessType: 'LLC' as const,
  ein: '12-3456789',
  address1: '123 Commerce Ave',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  country: 'US',
};

function makeAbility(allowed = true) {
  return { can: vi.fn().mockReturnValue(allowed) };
}

describe('submitBusinessInfoAction — happy path', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates businessInfo WITHOUT flipping sellerType to BUSINESS', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetBusinessInfo.mockResolvedValue(null);
    mockGetSellerProfile.mockResolvedValue({ id: 'sp-test-1', userId: 'user-test-123' } as never);
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);

    const result = await submitBusinessInfoAction(validBizInput);

    expect(result).toEqual({ success: true });
    // sellerType flip is deferred to updateStoreNameAction (final wizard step)
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('emits BUSINESS_INFO_SUBMITTED audit event (not BUSINESS_UPGRADED)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetBusinessInfo.mockResolvedValue(null);
    mockGetSellerProfile.mockResolvedValue({ id: 'sp-test-1', userId: 'user-test-123' } as never);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues } as never);

    await submitBusinessInfoAction(validBizInput);

    // First insert is the businessInfo row, second is the audit event.
    const auditArg = mockValues.mock.calls[1]![0];
    expect(auditArg.action).toBe('BUSINESS_INFO_SUBMITTED');
    expect(auditArg.severity).toBe('LOW');
    expect(auditArg.detailsJson).toMatchObject({ businessName: 'Acme LLC', businessType: 'LLC' });
  });

  it('accepts valid input without optional fields', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetBusinessInfo.mockResolvedValue(null);
    mockGetSellerProfile.mockResolvedValue({ id: 'sp-test-1', userId: 'user-test-123' } as never);
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);

    const result = await submitBusinessInfoAction({
      businessName: 'Solo Shop',
      businessType: 'SOLE_PROPRIETOR',
      address1: '1 Main St',
      city: 'Dallas',
      state: 'TX',
      zip: '75201',
      country: 'US',
    });

    expect(result).toEqual({ success: true });
  });

  it('uses onBehalfOfSellerId as userId when delegationId is set', async () => {
    mockAuthorize.mockResolvedValue({
      session: {
        userId: 'staff-test-999',
        delegationId: 'del-test-1',
        onBehalfOfSellerId: 'seller-test-456',
      } as never,
      ability: makeAbility() as never,
    });
    mockGetBusinessInfo.mockResolvedValue(null);
    mockGetSellerProfile.mockResolvedValue({ id: 'sp-test-1', userId: 'seller-test-456' } as never);
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);

    await submitBusinessInfoAction(validBizInput);

    expect(mockGetBusinessInfo).toHaveBeenCalledWith('seller-test-456');
    expect(mockGetSellerProfile).toHaveBeenCalledWith('seller-test-456');
  });
});

describe('updateBusinessInfoAction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error for unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    expect(await updateBusinessInfoAction(validBizInput)).toEqual({
      success: false, error: 'Please sign in to continue',
    });
  });

  it('returns error when CASL forbids', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility(false) as never,
    });
    expect(await updateBusinessInfoAction(validBizInput)).toEqual({ success: false, error: 'Forbidden' });
  });

  it('returns error if no existing businessInfo', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetBusinessInfo.mockResolvedValue(null);
    expect(await updateBusinessInfoAction(validBizInput)).toEqual({
      success: false,
      error: 'No business info found. Use submit instead.',
    });
  });

  it('updates existing businessInfo and returns success', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetBusinessInfo.mockResolvedValue({ id: 'biz-test-1', userId: 'user-test-123' } as never);
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);

    const result = await updateBusinessInfoAction(validBizInput);

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('emits BUSINESS_INFO_UPDATED audit event', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetBusinessInfo.mockResolvedValue({ id: 'biz-test-1', userId: 'user-test-123' } as never);
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues } as never);

    await updateBusinessInfoAction(validBizInput);

    const arg = mockValues.mock.calls[0]![0];
    expect(arg.action).toBe('BUSINESS_INFO_UPDATED');
    expect(arg.severity).toBe('LOW');
  });
});
