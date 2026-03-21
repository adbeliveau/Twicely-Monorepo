/**
 * G1-B Seller Onboarding — submitBusinessInfoAction validation and guard tests.
 * Categories: A (auth), B (validation), C (CASL), E (guard: existing biz info)
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
// Use REAL validation schemas — want actual Zod parse behaviour
vi.unmock('@/lib/validations/seller-onboarding');

import { submitBusinessInfoAction } from '../seller-onboarding';
import { authorize } from '@twicely/casl';
import { getBusinessInfo } from '@/lib/queries/business-info';
import { getSellerProfile } from '@/lib/queries/seller';

const mockAuthorize = vi.mocked(authorize);
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

describe('submitBusinessInfoAction — auth and CASL', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error for unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    expect(await submitBusinessInfoAction(validBizInput)).toEqual({
      success: false,
      error: 'Please sign in to continue',
    });
  });

  it('returns error when CASL forbids', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility(false) as never,
    });
    expect(await submitBusinessInfoAction(validBizInput)).toEqual({ success: false, error: 'Forbidden' });
  });
});

describe('submitBusinessInfoAction — validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error for missing businessName', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    expect(await submitBusinessInfoAction({ ...validBizInput, businessName: undefined })).toEqual({
      success: false, error: 'Invalid input',
    });
  });

  it('returns error for invalid businessType', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    expect(await submitBusinessInfoAction({ ...validBizInput, businessType: 'NONPROFIT' })).toEqual({
      success: false, error: 'Invalid input',
    });
  });

  it('returns error for invalid EIN format (no hyphen)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    expect(await submitBusinessInfoAction({ ...validBizInput, ein: '123456789' })).toEqual({
      success: false, error: 'Invalid input',
    });
  });

  it('returns error for invalid zip code', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    expect(await submitBusinessInfoAction({ ...validBizInput, zip: 'ABCDE' })).toEqual({
      success: false, error: 'Invalid input',
    });
  });

  it('returns error for invalid state code', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    expect(await submitBusinessInfoAction({ ...validBizInput, state: 'XX' })).toEqual({
      success: false, error: 'Invalid input',
    });
  });

  it('rejects unknown fields (strict mode)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    expect(await submitBusinessInfoAction({ ...validBizInput, unknownField: 'bad' })).toEqual({
      success: false, error: 'Invalid input',
    });
  });
});

describe('submitBusinessInfoAction — business guards', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects if businessInfo already exists', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetBusinessInfo.mockResolvedValue({ id: 'biz-test-1' } as never);
    expect(await submitBusinessInfoAction(validBizInput)).toEqual({
      success: false,
      error: 'Business info already submitted. Use update instead.',
    });
  });

  it('returns error if seller profile not found', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-123', delegationId: null } as never,
      ability: makeAbility() as never,
    });
    mockGetBusinessInfo.mockResolvedValue(null);
    mockGetSellerProfile.mockResolvedValue(null);
    expect(await submitBusinessInfoAction(validBizInput)).toEqual({
      success: false,
      error: 'Seller profile not found. Please enable selling first.',
    });
  });
});
