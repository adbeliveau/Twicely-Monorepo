/**
 * G1-B Seller Onboarding — updateStoreNameAction tests.
 * Categories: A (auth), B (validation), C (CASL), D (happy path), E (business type guard, slug uniqueness), F (audit)
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
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ type: 'eq', a, b })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/listings/seller-activate', () => ({
  ensureSellerProfile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/queries/seller', () => ({ getSellerProfile: vi.fn() }));
vi.mock('@/lib/queries/business-info', () => ({ getBusinessInfo: vi.fn() }));
vi.unmock('@/lib/validations/seller-onboarding');

import { updateStoreNameAction } from '../seller-onboarding';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getSellerProfile } from '@/lib/queries/seller';
import { getBusinessInfo } from '@/lib/queries/business-info';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);
const mockGetSellerProfile = vi.mocked(getSellerProfile);
const mockGetBusinessInfo = vi.mocked(getBusinessInfo);

const validInput = { storeName: 'My Vintage Shop', storeSlug: 'my-vintage-shop' };

function makeAbility(allowed = true) {
  return { can: vi.fn().mockReturnValue(allowed) };
}

function makeBusinessProfile(overrides: Record<string, unknown> = {}) {
  return { id: 'sp-test-1', userId: 'user-test-123', sellerType: 'BUSINESS', storeSlug: null, ...overrides };
}

function mockBizInfoPresent() {
  mockGetBusinessInfo.mockResolvedValue({
    id: 'biz-test-1',
    userId: 'user-test-123',
    businessName: 'Acme LLC',
    businessType: 'LLC',
  } as never);
}

function mockNoConflict() {
  mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
    }),
  } as never);
}

describe('updateStoreNameAction — auth and CASL', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error for unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    expect(await updateStoreNameAction(validInput)).toEqual({
      success: false, error: 'Please sign in to continue',
    });
  });

  it('returns error when CASL forbids', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility(false) as never,
    });
    expect(await updateStoreNameAction(validInput)).toEqual({ success: false, error: 'Forbidden' });
  });
});

describe('updateStoreNameAction — validation (real schemas)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error for storeSlug with uppercase letters', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    expect(await updateStoreNameAction({ storeName: 'My Store', storeSlug: 'MyStore' })).toEqual({
      success: false, error: 'Invalid input',
    });
  });

  it('returns error for storeSlug with special characters', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    expect(await updateStoreNameAction({ storeName: 'My Store', storeSlug: 'my_store!' })).toEqual({
      success: false, error: 'Invalid input',
    });
  });

  it('returns error for reserved storeSlug (admin)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    expect(await updateStoreNameAction({ storeName: 'Admin Store', storeSlug: 'admin' })).toEqual({
      success: false, error: 'Invalid input',
    });
  });

  it('returns error for reserved storeSlug (checkout)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    expect(await updateStoreNameAction({ storeName: 'Checkout Store', storeSlug: 'checkout' })).toEqual({
      success: false, error: 'Invalid input',
    });
  });

  it('rejects unknown fields (strict mode)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    expect(await updateStoreNameAction({ ...validInput, extraField: 'oops' })).toEqual({
      success: false, error: 'Invalid input',
    });
  });
});

describe('updateStoreNameAction — business rules and happy path', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error if seller profile not found', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetSellerProfile.mockResolvedValue(null);
    mockGetBusinessInfo.mockResolvedValue(null);
    expect(await updateStoreNameAction(validInput)).toEqual({
      success: false, error: 'Seller profile not found',
    });
  });

  it('returns error if business info is missing', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetSellerProfile.mockResolvedValue(
      makeBusinessProfile({ sellerType: 'PERSONAL' }) as never
    );
    mockGetBusinessInfo.mockResolvedValue(null);
    expect(await updateStoreNameAction(validInput)).toEqual({
      success: false, error: 'Business info required before setting a store name',
    });
  });

  it('returns error if storeSlug already taken', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetSellerProfile.mockResolvedValue(makeBusinessProfile() as never);
    mockBizInfoPresent();
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'sp-other-99' }]) }),
      }),
    } as never);
    expect(await updateStoreNameAction(validInput)).toEqual({
      success: false, error: 'This store URL is already taken',
    });
  });

  it('skips slug uniqueness check if slug is unchanged', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetSellerProfile.mockResolvedValue(makeBusinessProfile({ storeSlug: 'my-vintage-shop' }) as never);
    mockBizInfoPresent();
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);

    const result = await updateStoreNameAction(validInput);

    expect(result).toEqual({ success: true });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('updates storeName and storeSlug on happy path', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetSellerProfile.mockResolvedValue(makeBusinessProfile() as never);
    mockBizInfoPresent();
    mockNoConflict();
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);

    expect(await updateStoreNameAction(validInput)).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('emits STORE_NAME_SET audit event', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetSellerProfile.mockResolvedValue(makeBusinessProfile() as never);
    mockBizInfoPresent();
    mockNoConflict();
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues } as never);

    await updateStoreNameAction(validInput);

    const arg = mockValues.mock.calls[0]![0];
    expect(arg.action).toBe('STORE_NAME_SET');
    expect(arg.actorType).toBe('USER');
    expect(arg.subject).toBe('SellerProfile');
  });

  it('flips sellerType to BUSINESS when seller is still PERSONAL', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetSellerProfile.mockResolvedValue(
      makeBusinessProfile({ sellerType: 'PERSONAL' }) as never
    );
    mockBizInfoPresent();
    mockNoConflict();
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: mockSet } as never);
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues } as never);

    const result = await updateStoreNameAction(validInput);

    expect(result).toEqual({ success: true });
    // sellerType flip is part of the update set payload
    const setArg = mockSet.mock.calls[0]![0];
    expect(setArg.sellerType).toBe('BUSINESS');
    // BUSINESS_UPGRADED audit event emitted alongside STORE_NAME_SET
    const auditActions = mockValues.mock.calls.map((c) => c[0].action);
    expect(auditActions).toContain('STORE_NAME_SET');
    expect(auditActions).toContain('BUSINESS_UPGRADED');
  });

  it('does NOT re-flip sellerType when seller is already BUSINESS', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetSellerProfile.mockResolvedValue(makeBusinessProfile() as never);
    mockBizInfoPresent();
    mockNoConflict();
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: mockSet } as never);
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues } as never);

    await updateStoreNameAction(validInput);

    const setArg = mockSet.mock.calls[0]![0];
    expect(setArg.sellerType).toBeUndefined();
    const auditActions = mockValues.mock.calls.map((c) => c[0].action);
    expect(auditActions).not.toContain('BUSINESS_UPGRADED');
  });
});
