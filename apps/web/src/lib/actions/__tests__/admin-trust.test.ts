/**
 * Admin Trust Action Tests (I7)
 * Tests for updateBandOverride and revokeBandOverride.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockStaffAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { id: 'id', userId: 'userId', performanceBand: 'performanceBand', bandOverride: 'bandOverride' },
  auditEvent: {},
  platformSetting: { key: 'key', id: 'id', category: 'category' },
  platformSettingHistory: {},
}));
vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAdminSession() {
  return {
    session: { staffUserId: 'staff-admin-1' },
    ability: { can: () => true },
  };
}

function makeForbiddenSession() {
  return {
    session: { staffUserId: 'staff-mod-1' },
    ability: { can: () => false },
  };
}

function chainSelect(result: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(result) };
}

function chainUpdate() {
  return { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
}

function chainInsert() {
  return { values: vi.fn().mockResolvedValue([]) };
}

function makeSellerProfile(overrides: Record<string, unknown> = {}) {
  return { id: 'sp-1', performanceBand: 'EMERGING', bandOverride: null, ...overrides };
}

// ─── updateBandOverride ───────────────────────────────────────────────────────

describe('updateBandOverride', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('sets all override fields on sellerProfile', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockDbSelect.mockReturnValue(chainSelect([makeSellerProfile()]));
    const mockSetChain = vi.fn().mockReturnThis();
    const mockWhereChain = vi.fn().mockResolvedValue([]);
    mockDbUpdate.mockReturnValue({ set: mockSetChain, where: mockWhereChain });
    mockSetChain.mockReturnValue({ where: mockWhereChain });
    mockDbInsert.mockReturnValue(chainInsert());

    const { updateBandOverride } = await import('../admin-trust');
    const result = await updateBandOverride({ userId: 'u1', newBand: 'TOP_RATED', reason: 'Excellent seller performance', expiresInDays: 60 });
    expect(result).toEqual({ success: true });
    const setCall = mockSetChain.mock.calls[0]?.[0];
    expect(setCall?.bandOverride).toBe('TOP_RATED');
    expect(setCall?.bandOverrideReason).toBe('Excellent seller performance');
    expect(setCall?.bandOverrideExpiresAt).toBeInstanceOf(Date);
  });

  it('rejects invalid band values', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const { updateBandOverride } = await import('../admin-trust');
    const result = await updateBandOverride({ userId: 'u1', newBand: 'SUSPENDED', reason: 'Test reason here', expiresInDays: 30 });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('rejects reason shorter than 10 chars', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const { updateBandOverride } = await import('../admin-trust');
    const result = await updateBandOverride({ userId: 'u1', newBand: 'TOP_RATED', reason: 'Short' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('requires ability.can update SellerProfile', async () => {
    mockStaffAuthorize.mockResolvedValue(makeForbiddenSession());
    const { updateBandOverride } = await import('../admin-trust');
    const result = await updateBandOverride({ userId: 'u1', newBand: 'TOP_RATED', reason: 'A valid reason here' });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('sets bandOverrideBy from session, not input', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockDbSelect.mockReturnValue(chainSelect([makeSellerProfile()]));
    const mockSetChain = vi.fn().mockReturnThis();
    const mockWhereChain = vi.fn().mockResolvedValue([]);
    mockDbUpdate.mockReturnValue({ set: mockSetChain, where: mockWhereChain });
    mockSetChain.mockReturnValue({ where: mockWhereChain });
    mockDbInsert.mockReturnValue(chainInsert());

    const { updateBandOverride } = await import('../admin-trust');
    await updateBandOverride({ userId: 'u1', newBand: 'POWER_SELLER', reason: 'Outstanding performance record', expiresInDays: 90 });
    const setCall = mockSetChain.mock.calls[0]?.[0];
    expect(setCall?.bandOverrideBy).toBe('staff-admin-1');
  });

  it('calculates expiry date correctly', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockDbSelect.mockReturnValue(chainSelect([makeSellerProfile()]));
    const mockSetChain = vi.fn().mockReturnThis();
    const mockWhereChain = vi.fn().mockResolvedValue([]);
    mockDbUpdate.mockReturnValue({ set: mockSetChain, where: mockWhereChain });
    mockSetChain.mockReturnValue({ where: mockWhereChain });
    mockDbInsert.mockReturnValue(chainInsert());

    const before = new Date();
    const { updateBandOverride } = await import('../admin-trust');
    await updateBandOverride({ userId: 'u1', newBand: 'ESTABLISHED', reason: 'Manually adjusted band override', expiresInDays: 30 });
    const setCall = mockSetChain.mock.calls[0]?.[0];
    const expiry = setCall?.bandOverrideExpiresAt as Date;
    const diffDays = Math.round((expiry.getTime() - before.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  it('logs audit event with severity HIGH', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockDbSelect.mockReturnValue(chainSelect([makeSellerProfile()]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const mockInsertValues = vi.fn().mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: mockInsertValues });

    const { updateBandOverride } = await import('../admin-trust');
    await updateBandOverride({ userId: 'u1', newBand: 'TOP_RATED', reason: 'Verified performance history', expiresInDays: 90 });
    const insertCall = mockInsertValues.mock.calls[0]?.[0];
    expect(insertCall?.severity).toBe('HIGH');
    expect(insertCall?.action).toBe('trust.band_override');
  });

  it('returns error when seller not found', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockDbSelect.mockReturnValue(chainSelect([]));
    const { updateBandOverride } = await import('../admin-trust');
    const result = await updateBandOverride({ userId: 'nonexistent', newBand: 'TOP_RATED', reason: 'A valid reason here for override', expiresInDays: 90 });
    expect(result).toEqual({ error: 'Seller not found' });
  });
});

// ─── revokeBandOverride ───────────────────────────────────────────────────────

describe('revokeBandOverride', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('clears all override fields', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockDbSelect.mockReturnValue(chainSelect([makeSellerProfile({ bandOverride: 'TOP_RATED' })]));
    const mockSetChain = vi.fn().mockReturnThis();
    const mockWhereChain = vi.fn().mockResolvedValue([]);
    mockDbUpdate.mockReturnValue({ set: mockSetChain, where: mockWhereChain });
    mockSetChain.mockReturnValue({ where: mockWhereChain });
    mockDbInsert.mockReturnValue(chainInsert());

    const { revokeBandOverride } = await import('../admin-trust');
    const result = await revokeBandOverride({ userId: 'u1', reason: 'Override expired' });
    expect(result).toEqual({ success: true });
    const setCall = mockSetChain.mock.calls[0]?.[0];
    expect(setCall?.bandOverride).toBeNull();
    expect(setCall?.bandOverrideExpiresAt).toBeNull();
    expect(setCall?.bandOverrideReason).toBeNull();
    expect(setCall?.bandOverrideBy).toBeNull();
  });

  it('requires ADMIN role', async () => {
    mockStaffAuthorize.mockResolvedValue(makeForbiddenSession());
    const { revokeBandOverride } = await import('../admin-trust');
    const result = await revokeBandOverride({ userId: 'u1', reason: 'reason' });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('logs audit event', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockDbSelect.mockReturnValue(chainSelect([makeSellerProfile({ bandOverride: 'TOP_RATED' })]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const mockInsertValues = vi.fn().mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: mockInsertValues });

    const { revokeBandOverride } = await import('../admin-trust');
    await revokeBandOverride({ userId: 'u1', reason: 'Override no longer needed' });
    const insertCall = mockInsertValues.mock.calls[0]?.[0];
    expect(insertCall?.action).toBe('trust.band_override_revoked');
    expect(insertCall?.severity).toBe('MEDIUM');
  });

  it('rejects missing reason (less than 5 chars)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const { revokeBandOverride } = await import('../admin-trust');
    const result = await revokeBandOverride({ userId: 'u1', reason: 'no' });
    expect(result).toEqual({ error: 'Invalid input' });
  });
});
