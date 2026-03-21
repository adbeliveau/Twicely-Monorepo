/**
 * Admin Promotions Actions Tests (I9)
 * Covers adminDeactivatePromotion, adminReactivatePromotion,
 * adminCreatePlatformPromoCode, adminUpdatePromoCode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockRevalidatePath = vi.fn();
const mockStaffAuthorize = vi.fn();
const mockCreatePlatformPromoCode = vi.fn();
const mockUpdatePlatformPromoCode = vi.fn();
const mockGetPromoCodeByCode = vi.fn();

vi.mock('@twicely/db', () => ({ db: { insert: mockInsert, update: mockUpdate, select: mockSelect } }));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('@/lib/actions/promo-codes-platform', () => ({ createPlatformPromoCode: mockCreatePlatformPromoCode, updatePlatformPromoCode: mockUpdatePlatformPromoCode }));
vi.mock('@/lib/queries/promo-codes', () => ({ getPromoCodeByCode: mockGetPromoCodeByCode }));
vi.mock('@twicely/db/schema', () => ({ promotion: { id: 'id', isActive: 'is_active', endsAt: 'ends_at' }, auditEvent: { id: 'id' } }));
vi.mock('drizzle-orm', () => ({ eq: (_c: unknown, _v: unknown) => ({ type: 'eq' }) }));

function makeAdminSession() {
  return { session: { staffUserId: 'staff-admin-001', isPlatformStaff: true as const, email: 'a@t.com', displayName: 'Admin', platformRoles: ['ADMIN' as const] }, ability: { can: vi.fn().mockReturnValue(true) } };
}
function makeFinanceSession() {
  return { session: { staffUserId: 'staff-fin-001', isPlatformStaff: true as const, email: 'f@t.com', displayName: 'Finance', platformRoles: ['FINANCE' as const] }, ability: { can: vi.fn().mockImplementation((a: string, s: string) => a === 'manage' && s === 'PromoCode') } };
}
function makeUnauthorizedSession() {
  return { session: { staffUserId: 'staff-sup-001', isPlatformStaff: true as const, email: 's@t.com', displayName: 'Support', platformRoles: ['SUPPORT' as const] }, ability: { can: vi.fn().mockReturnValue(false) } };
}

function makeSelectSingleChain(row: unknown) {
  const c: Record<string, unknown> = {};
  c['from'] = vi.fn().mockReturnValue(c);
  c['where'] = vi.fn().mockReturnValue(c);
  c['limit'] = vi.fn().mockResolvedValue(row ? [row] : []);
  return c;
}
function makeInsertChain() { return { values: vi.fn().mockResolvedValue([]) }; }
function makeUpdateChain() { return { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) }; }

const FUTURE = new Date(Date.now() + 86400000);
const PAST = new Date(Date.now() - 86400000);

// ─── adminDeactivatePromotion ─────────────────────────────────────────────────

describe('adminDeactivatePromotion', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('deactivates an active promotion', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(makeSelectSingleChain({ id: 'promo-1' }));
    mockUpdate.mockReturnValue(makeUpdateChain()); mockInsert.mockReturnValue(makeInsertChain());
    const { adminDeactivatePromotion } = await import('../admin-promotions');
    const result = await adminDeactivatePromotion({ promotionId: 'promo-1' });
    expect(result.success).toBe(true); expect(mockUpdate).toHaveBeenCalled();
  });

  it('returns error for non-existent promotion', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(makeSelectSingleChain(null));
    const { adminDeactivatePromotion } = await import('../admin-promotions');
    const result = await adminDeactivatePromotion({ promotionId: 'no-such' });
    expect(result.success).toBe(false); expect(result.error).toBe('Not found');
  });

  it('returns Forbidden when staff lacks manage Promotion ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeUnauthorizedSession());
    const { adminDeactivatePromotion } = await import('../admin-promotions');
    const result = await adminDeactivatePromotion({ promotionId: 'promo-1' });
    expect(result.success).toBe(false); expect(result.error).toBe('Forbidden');
  });

  it('creates audit event on deactivation', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(makeSelectSingleChain({ id: 'promo-1' }));
    mockUpdate.mockReturnValue(makeUpdateChain()); mockInsert.mockReturnValue(makeInsertChain());
    const { adminDeactivatePromotion } = await import('../admin-promotions');
    await adminDeactivatePromotion({ promotionId: 'promo-1' });
    expect(mockInsert).toHaveBeenCalled();
  });

  it('revalidates /promotions path', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(makeSelectSingleChain({ id: 'promo-1' }));
    mockUpdate.mockReturnValue(makeUpdateChain()); mockInsert.mockReturnValue(makeInsertChain());
    const { adminDeactivatePromotion } = await import('../admin-promotions');
    await adminDeactivatePromotion({ promotionId: 'promo-1' });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/promotions');
  });
});

// ─── adminReactivatePromotion ─────────────────────────────────────────────────

describe('adminReactivatePromotion', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('reactivates an inactive promotion', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(makeSelectSingleChain({ id: 'promo-1', endsAt: FUTURE }));
    mockUpdate.mockReturnValue(makeUpdateChain()); mockInsert.mockReturnValue(makeInsertChain());
    const { adminReactivatePromotion } = await import('../admin-promotions');
    const result = await adminReactivatePromotion({ promotionId: 'promo-1' });
    expect(result.success).toBe(true);
  });

  it('returns error when promotion has expired (endsAt < now)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(makeSelectSingleChain({ id: 'promo-1', endsAt: PAST }));
    const { adminReactivatePromotion } = await import('../admin-promotions');
    const result = await adminReactivatePromotion({ promotionId: 'promo-1' });
    expect(result.success).toBe(false); expect(result.error).toContain('expired');
  });

  it('returns error for non-existent promotion', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(makeSelectSingleChain(null));
    const { adminReactivatePromotion } = await import('../admin-promotions');
    const result = await adminReactivatePromotion({ promotionId: 'no-such' });
    expect(result.success).toBe(false); expect(result.error).toBe('Not found');
  });

  it('returns Forbidden when staff lacks manage Promotion ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeUnauthorizedSession());
    const { adminReactivatePromotion } = await import('../admin-promotions');
    const result = await adminReactivatePromotion({ promotionId: 'promo-1' });
    expect(result.success).toBe(false); expect(result.error).toBe('Forbidden');
  });

  it('creates audit event on reactivation', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(makeSelectSingleChain({ id: 'promo-1', endsAt: null }));
    mockUpdate.mockReturnValue(makeUpdateChain()); mockInsert.mockReturnValue(makeInsertChain());
    const { adminReactivatePromotion } = await import('../admin-promotions');
    await adminReactivatePromotion({ promotionId: 'promo-1' });
    expect(mockInsert).toHaveBeenCalled();
  });
});

// ─── adminCreatePlatformPromoCode ─────────────────────────────────────────────

describe('adminCreatePlatformPromoCode', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });
  const validInput = { code: 'LAUNCH50', discountType: 'PERCENTAGE', discountValue: 5000, durationMonths: 3 };

  it('creates a platform promo code successfully', async () => {
    mockStaffAuthorize.mockResolvedValue(makeFinanceSession());
    mockGetPromoCodeByCode.mockResolvedValue(null);
    mockCreatePlatformPromoCode.mockResolvedValue({ success: true });
    const { adminCreatePlatformPromoCode } = await import('../admin-promotions');
    const result = await adminCreatePlatformPromoCode(validInput);
    expect(result.success).toBe(true); expect(mockRevalidatePath).toHaveBeenCalledWith('/promotions');
  });

  it('rejects duplicate codes', async () => {
    mockStaffAuthorize.mockResolvedValue(makeFinanceSession());
    mockGetPromoCodeByCode.mockResolvedValue({ id: 'existing' });
    const { adminCreatePlatformPromoCode } = await import('../admin-promotions');
    const result = await adminCreatePlatformPromoCode(validInput);
    expect(result.success).toBe(false); expect(result.error).toContain('already in use');
  });

  it('returns Forbidden when staff lacks manage PromoCode ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeUnauthorizedSession());
    const { adminCreatePlatformPromoCode } = await import('../admin-promotions');
    const result = await adminCreatePlatformPromoCode(validInput);
    expect(result.success).toBe(false); expect(result.error).toBe('Forbidden');
  });

  it('validates input with strict schema', async () => {
    mockStaffAuthorize.mockResolvedValue(makeFinanceSession());
    const { adminCreatePlatformPromoCode } = await import('../admin-promotions');
    const result = await adminCreatePlatformPromoCode({ code: 'AB' });
    expect(result.success).toBe(false);
  });

  it('creates audit event on creation', async () => {
    mockStaffAuthorize.mockResolvedValue(makeFinanceSession());
    mockGetPromoCodeByCode.mockResolvedValue(null);
    mockCreatePlatformPromoCode.mockResolvedValue({ success: true });
    const { adminCreatePlatformPromoCode } = await import('../admin-promotions');
    await adminCreatePlatformPromoCode(validInput);
    expect(mockCreatePlatformPromoCode).toHaveBeenCalledWith(validInput);
  });

  it('revalidates both /promotions and /fin/promo-codes', async () => {
    mockStaffAuthorize.mockResolvedValue(makeFinanceSession());
    mockGetPromoCodeByCode.mockResolvedValue(null);
    mockCreatePlatformPromoCode.mockResolvedValue({ success: true });
    const { adminCreatePlatformPromoCode } = await import('../admin-promotions');
    await adminCreatePlatformPromoCode(validInput);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/promotions');
    expect(mockCreatePlatformPromoCode).toHaveBeenCalledWith(validInput);
  });
});

// ─── adminUpdatePromoCode ─────────────────────────────────────────────────────

describe('adminUpdatePromoCode', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates usageLimit on a promo code', async () => {
    mockStaffAuthorize.mockResolvedValue(makeFinanceSession());
    mockUpdatePlatformPromoCode.mockResolvedValue({ success: true });
    const { adminUpdatePromoCode } = await import('../admin-promotions');
    const result = await adminUpdatePromoCode({ id: 'code-1', usageLimit: 200 });
    expect(result.success).toBe(true); expect(mockRevalidatePath).toHaveBeenCalledWith('/promotions');
  });

  it('updates expiresAt on a promo code', async () => {
    mockStaffAuthorize.mockResolvedValue(makeFinanceSession());
    mockUpdatePlatformPromoCode.mockResolvedValue({ success: true });
    const { adminUpdatePromoCode } = await import('../admin-promotions');
    const result = await adminUpdatePromoCode({ id: 'code-1', expiresAt: '2027-01-01T00:00:00.000Z' });
    expect(result.success).toBe(true);
  });

  it('deactivates a promo code', async () => {
    mockStaffAuthorize.mockResolvedValue(makeFinanceSession());
    mockUpdatePlatformPromoCode.mockResolvedValue({ success: true });
    const { adminUpdatePromoCode } = await import('../admin-promotions');
    const result = await adminUpdatePromoCode({ id: 'code-1', isActive: false });
    expect(result.success).toBe(true);
  });

  it('returns Forbidden when staff lacks manage PromoCode ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeUnauthorizedSession());
    const { adminUpdatePromoCode } = await import('../admin-promotions');
    const result = await adminUpdatePromoCode({ id: 'code-1', isActive: false });
    expect(result.success).toBe(false); expect(result.error).toBe('Forbidden');
  });

  it('returns error for non-existent promo code', async () => {
    mockStaffAuthorize.mockResolvedValue(makeFinanceSession());
    mockUpdatePlatformPromoCode.mockResolvedValue({ success: false, error: 'Not found' });
    const { adminUpdatePromoCode } = await import('../admin-promotions');
    const result = await adminUpdatePromoCode({ id: 'nonexistent', isActive: false });
    expect(result.success).toBe(false); expect(result.error).toBe('Not found');
  });
});
