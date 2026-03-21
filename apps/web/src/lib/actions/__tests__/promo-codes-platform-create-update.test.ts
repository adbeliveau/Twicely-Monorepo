import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/queries/promo-codes', () => ({
  getPromoCodeByCode: vi.fn(),
  getPromoCodeById: vi.fn(),
  hasUserRedeemedPromoCode: vi.fn(),
}));

vi.mock('@twicely/stripe/promo-codes', () => ({
  syncPromoCodeToStripe: vi.fn(),
}));

vi.mock('../promo-codes-helpers', () => ({
  deactivateStripeIfExists: vi.fn(),
}));

import { createPlatformPromoCode, updatePlatformPromoCode } from '../promo-codes-platform';
import { db } from '@twicely/db';
import { getPromoCodeByCode, getPromoCodeById } from '@/lib/queries/promo-codes';
import { deactivateStripeIfExists } from '../promo-codes-helpers';

const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);
const mockGetPromoCodeByCode = vi.mocked(getPromoCodeByCode);
const mockGetPromoCodeById = vi.mocked(getPromoCodeById);
const mockDeactivateStripeIfExists = vi.mocked(deactivateStripeIfExists);

function makeStaffSession(overrides: Record<string, unknown> = {}) {
  return { staffUserId: 'staff-test-1', isPlatformStaff: true, ...overrides };
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

const validCreateInput = {
  code: 'PLATFORM10',
  discountType: 'PERCENTAGE',
  discountValue: 2000,
  durationMonths: 3,
};

// ─── createPlatformPromoCode — auth ───────────────────────────────────────────

describe('createPlatformPromoCode — auth', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Forbidden when staff lacks manage on PromoCode', async () => {
    mockStaffAuthorize.mockResolvedValue({
      session: makeStaffSession() as never,
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const result = await createPlatformPromoCode(validCreateInput);
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });
});

// ─── createPlatformPromoCode — validation ─────────────────────────────────────

describe('createPlatformPromoCode — validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue({
      session: makeStaffSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) },
    });
  });

  it('returns Invalid input for missing code', async () => {
    const result = await createPlatformPromoCode({ discountType: 'PERCENTAGE', discountValue: 2000 });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns Invalid input for invalid discountType', async () => {
    const result = await createPlatformPromoCode({ ...validCreateInput, discountType: 'FLAT' });
    expect(result.success).toBe(false);
  });

  it('returns Invalid input for extra fields (strict schema)', async () => {
    const result = await createPlatformPromoCode({ ...validCreateInput, adminNote: 'test' });
    expect(result.success).toBe(false);
  });
});

// ─── createPlatformPromoCode — code uniqueness + happy path ───────────────────

describe('createPlatformPromoCode — code uniqueness + happy path', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue({
      session: makeStaffSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) },
    });
  });

  it('returns error when code already exists', async () => {
    mockGetPromoCodeByCode.mockResolvedValue({ id: 'existing' } as never);
    const result = await createPlatformPromoCode(validCreateInput);
    expect(result).toEqual({ success: false, error: 'This code is already in use' });
  });

  it('returns success and writes audit event on creation', async () => {
    mockGetPromoCodeByCode.mockResolvedValue(null);
    makeInsertSequence({ id: 'pc-plat-1', code: 'PLATFORM10', discountType: 'PERCENTAGE' });

    const result = await createPlatformPromoCode(validCreateInput);
    expect(result).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('stores affiliateId as null for PLATFORM type', async () => {
    mockGetPromoCodeByCode.mockResolvedValue(null);
    makeInsertSequence({ id: 'pc-plat-1', code: 'PLATFORM10', type: 'PLATFORM', affiliateId: null });

    await createPlatformPromoCode(validCreateInput);
    expect(mockInsert.mock.calls[0]).toBeDefined();
  });
});

// ─── updatePlatformPromoCode — auth + validation ──────────────────────────────

describe('updatePlatformPromoCode — auth + validation', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Forbidden when staff lacks manage on PromoCode', async () => {
    mockStaffAuthorize.mockResolvedValue({
      session: makeStaffSession() as never,
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const result = await updatePlatformPromoCode({ id: 'pc-1', isActive: false });
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('returns error when promo code not found', async () => {
    mockStaffAuthorize.mockResolvedValue({
      session: makeStaffSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetPromoCodeById.mockResolvedValue(null);
    const result = await updatePlatformPromoCode({ id: 'missing' });
    expect(result).toEqual({ success: false, error: 'Not found' });
  });
});

// ─── updatePlatformPromoCode — happy path ─────────────────────────────────────

describe('updatePlatformPromoCode — happy path', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue({
      session: makeStaffSession() as never,
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetPromoCodeById.mockResolvedValue({ id: 'pc-1', code: 'PLAT10', isActive: true } as never);
    makeUpdateChain();
    makeInsertNoReturn();
  });

  it('returns success and writes audit event', async () => {
    const result = await updatePlatformPromoCode({ id: 'pc-1', isActive: false });
    expect(result).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('calls deactivateStripeIfExists when setting isActive=false', async () => {
    mockDeactivateStripeIfExists.mockResolvedValue(undefined);
    await updatePlatformPromoCode({ id: 'pc-1', isActive: false });
    expect(mockDeactivateStripeIfExists).toHaveBeenCalledWith('PLAT10');
  });

  it('does not call deactivateStripeIfExists when isActive is not false', async () => {
    await updatePlatformPromoCode({ id: 'pc-1', isActive: true });
    expect(mockDeactivateStripeIfExists).not.toHaveBeenCalled();
  });
});
