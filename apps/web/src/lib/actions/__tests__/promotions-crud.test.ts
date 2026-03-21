import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDbSelect, mockDbUpdate, mockDbInsert, mockDb, mockAuthorize,
  mockCouponCodeExists, mockCountActivePromotions } = vi.hoisted(() => {
  const mockDbSelect = vi.fn();
  const mockDbUpdate = vi.fn();
  const mockDbInsert = vi.fn();
  const mockDb = { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert };
  const mockAuthorize = vi.fn();
  const mockCouponCodeExists = vi.fn();
  const mockCountActivePromotions = vi.fn();
  return { mockDbSelect, mockDbUpdate, mockDbInsert, mockDb, mockAuthorize,
    mockCouponCodeExists, mockCountActivePromotions };
});

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (type: string, conditions: Record<string, unknown>) => ({ ...conditions, __caslSubjectType__: type }),
}));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/queries/promotions', () => ({
  couponCodeExists: (...args: unknown[]) => mockCouponCodeExists(...args),
  countActivePromotions: (...args: unknown[]) => mockCountActivePromotions(...args),
}));
vi.mock('@twicely/utils/tier-gates', () => ({
  canUseFeature: vi.fn((tier: string) => tier === 'PRO' || tier === 'POWER' || tier === 'ENTERPRISE'),
}));
vi.mock('@twicely/commerce/promotions', () => ({
  validateCouponCodeFormat: vi.fn((code: string) => /^[A-Z0-9][A-Z0-9-]{2,18}[A-Z0-9]$/.test(code)),
  normalizeCouponCode: vi.fn((code: string) => code.toUpperCase()),
}));

import { createPromotion, updatePromotion, deactivatePromotion, reactivatePromotion } from '../promotions';

function createChainableMock(result: unknown[], noLimit = false) {
  return {
    from: vi.fn().mockReturnThis(),
    where: noLimit ? vi.fn().mockResolvedValue(result) : vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
}

const validInput = { name: 'Test', type: 'PERCENT_OFF' as const, scope: 'STORE_WIDE' as const, discountPercent: 20, startsAt: new Date().toISOString() };

describe('createPromotion', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCouponCodeExists.mockResolvedValue(false); mockCountActivePromotions.mockResolvedValue(0); });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: null });
    expect(await createPromotion(validInput)).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when storeTier below PRO', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(createChainableMock([{ id: 'sp-1', storeTier: 'STARTER' }]));
    expect(await createPromotion(validInput)).toEqual({ success: false, error: 'Promotions require Pro plan or higher' });
  });

  it('succeeds with valid PERCENT_OFF input', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(createChainableMock([{ id: 'sp-1', storeTier: 'PRO' }]));
    mockCountActivePromotions.mockResolvedValue(5);
    mockDbInsert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'promo-1' }]) }) });
    const result = await createPromotion({ ...validInput, name: 'Summer Sale' });
    expect(result.success).toBe(true);
    expect(result.promotionId).toBe('promo-1');
  });

  it('fails when discountPercent missing for PERCENT_OFF type', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(createChainableMock([{ id: 'sp-1', storeTier: 'PRO' }]));
    const result = await createPromotion({ name: 'Test', type: 'PERCENT_OFF', scope: 'STORE_WIDE', startsAt: new Date().toISOString() });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Discount percent');
  });

  it('fails when discountPercent > 95 (platform max)', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(createChainableMock([{ id: 'sp-1', storeTier: 'PRO' }]));
    const result = await createPromotion({ ...validInput, discountPercent: 96 });
    expect(result.success).toBe(false);
  });

  it('fails when coupon code format invalid', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(createChainableMock([{ id: 'sp-1', storeTier: 'PRO' }]));
    const result = await createPromotion({ ...validInput, couponCode: '-INVALID' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Coupon code');
  });

  it('fails when coupon code already exists', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(createChainableMock([{ id: 'sp-1', storeTier: 'PRO' }]));
    mockCouponCodeExists.mockResolvedValue(true);
    const result = await createPromotion({ ...validInput, couponCode: 'EXISTINGCODE' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already in use');
  });

  it('fails when name is empty', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(createChainableMock([{ id: 'sp-1', storeTier: 'PRO' }]));
    const result = await createPromotion({ ...validInput, name: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('1 character');
  });

  it('fails when > 50 active promotions', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(createChainableMock([{ id: 'sp-1', storeTier: 'PRO' }]));
    mockCountActivePromotions.mockResolvedValue(50);
    const result = await createPromotion(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum 50');
  });
});

describe('updatePromotion', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCouponCodeExists.mockResolvedValue(false); });

  it('returns error when not owner', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(createChainableMock([{ id: 'promo-1', sellerId: 'user-2' }]));
    expect(await updatePromotion('promo-1', { name: 'New Name' })).toEqual({ success: false, error: 'Forbidden' });
  });
});

describe('deactivatePromotion', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sets isActive to false', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(createChainableMock([{ id: 'promo-1', sellerId: 'user-1' }]));
    mockDbUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    expect((await deactivatePromotion('promo-1')).success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});

describe('reactivatePromotion', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fails when endsAt is in the past', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(createChainableMock([{ id: 'promo-1', sellerId: 'user-1', endsAt: new Date('2020-01-01') }]));
    const result = await reactivatePromotion('promo-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });
});
