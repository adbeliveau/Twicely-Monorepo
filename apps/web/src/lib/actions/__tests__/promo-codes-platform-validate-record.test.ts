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
  recordPromoCodeRedemption: vi.fn(),
}));

// Staff authorize mock — not used in validate/record but must be declared
const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

import { validatePromoCode } from '../promo-codes-platform';
import { authorize } from '@twicely/casl';
import { getPromoCodeByCode, hasUserRedeemedPromoCode } from '@/lib/queries/promo-codes';

const mockAuthorize = vi.mocked(authorize);
const mockGetPromoCodeByCode = vi.mocked(getPromoCodeByCode);
const mockHasUserRedeemed = vi.mocked(hasUserRedeemedPromoCode);

// ─── validatePromoCode — auth + input ────────────────────────────────────────

describe('validatePromoCode — auth + input', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Unauthorized when session is null', async () => {
    mockGetPromoCodeByCode.mockResolvedValue(null);
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } } as never);

    const result = await validatePromoCode({ code: 'SAVE10', product: 'store' });
    expect(result).toEqual({ valid: false, error: 'Unauthorized' });
  });

  it('returns invalid for bad product enum', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-1' } as never,
      ability: { can: vi.fn() } as never,
    });

    const result = await validatePromoCode({ code: 'SAVE10', product: 'wallet' });
    expect(result).toEqual({ valid: false, error: 'Invalid input' });
  });
});

// ─── validatePromoCode — business rules ──────────────────────────────────────

describe('validatePromoCode — business rules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-1' } as never,
      ability: { can: vi.fn() } as never,
    });
  });

  it('returns not found when code does not exist', async () => {
    mockGetPromoCodeByCode.mockResolvedValue(null);
    const result = await validatePromoCode({ code: 'GHOST', product: 'store' });
    expect(result).toEqual({ valid: false, error: 'Promo code not found' });
  });

  it('returns error when code is inactive', async () => {
    mockGetPromoCodeByCode.mockResolvedValue({
      id: 'pc-1', code: 'OLD10', isActive: false, expiresAt: null,
      usageLimit: null, usageCount: 0, scopeProductTypes: null,
    } as never);
    const result = await validatePromoCode({ code: 'OLD10', product: 'store' });
    expect(result).toEqual({ valid: false, error: 'This promo code is no longer active' });
  });

  it('returns expired error when expiresAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockGetPromoCodeByCode.mockResolvedValue({
      id: 'pc-1', code: 'OLD10', isActive: true, expiresAt: pastDate,
      usageLimit: null, usageCount: 0, scopeProductTypes: null,
    } as never);
    const result = await validatePromoCode({ code: 'OLD10', product: 'store' });
    expect(result).toEqual({ valid: false, error: 'This promo code has expired' });
  });

  it('returns error when usage limit is reached', async () => {
    mockGetPromoCodeByCode.mockResolvedValue({
      id: 'pc-1', code: 'MAXED', isActive: true, expiresAt: null,
      usageLimit: 100, usageCount: 100, scopeProductTypes: null,
    } as never);
    const result = await validatePromoCode({ code: 'MAXED', product: 'store' });
    expect(result).toEqual({ valid: false, error: 'This promo code has reached its usage limit' });
  });

  it('returns error when code cannot be applied to the product', async () => {
    mockGetPromoCodeByCode.mockResolvedValue({
      id: 'pc-1', code: 'LISTER5', isActive: true, expiresAt: null,
      usageLimit: null, usageCount: 0, scopeProductTypes: ['lister'],
    } as never);
    const result = await validatePromoCode({ code: 'LISTER5', product: 'store' });
    expect(result).toEqual({ valid: false, error: 'This promo code cannot be applied to this product' });
  });

  it('returns error when user has already redeemed this code for the product', async () => {
    mockGetPromoCodeByCode.mockResolvedValue({
      id: 'pc-1', code: 'SAVE10', isActive: true, expiresAt: null,
      usageLimit: null, usageCount: 5, scopeProductTypes: null,
    } as never);
    mockHasUserRedeemed.mockResolvedValue(true);
    const result = await validatePromoCode({ code: 'SAVE10', product: 'store' });
    expect(result).toEqual({ valid: false, error: 'You have already used this promo code for this product' });
  });

  it('returns valid result with discount info for a valid code', async () => {
    mockGetPromoCodeByCode.mockResolvedValue({
      id: 'pc-1', code: 'SAVE10', isActive: true, expiresAt: null,
      usageLimit: null, usageCount: 0, scopeProductTypes: null,
      discountType: 'PERCENTAGE', discountValue: 1000, durationMonths: 3, type: 'AFFILIATE',
    } as never);
    mockHasUserRedeemed.mockResolvedValue(false);
    const result = await validatePromoCode({ code: 'SAVE10', product: 'store' });
    expect(result).toEqual({
      valid: true,
      discountType: 'PERCENTAGE',
      discountValue: 1000,
      durationMonths: 3,
      type: 'AFFILIATE',
    });
  });

  it('accepts code scoped to matching product', async () => {
    mockGetPromoCodeByCode.mockResolvedValue({
      id: 'pc-1', code: 'STORE10', isActive: true, expiresAt: null,
      usageLimit: null, usageCount: 0, scopeProductTypes: ['store', 'lister'],
      discountType: 'FIXED', discountValue: 500, durationMonths: 1, type: 'PLATFORM',
    } as never);
    mockHasUserRedeemed.mockResolvedValue(false);
    const result = await validatePromoCode({ code: 'STORE10', product: 'store' });
    expect(result.valid).toBe(true);
  });
});

