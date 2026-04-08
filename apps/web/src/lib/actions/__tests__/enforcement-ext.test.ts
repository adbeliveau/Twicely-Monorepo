import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  contentReport: {},
  enforcementAction: {
    id: 'id', userId: 'user_id', actionType: 'action_type',
    status: 'status', liftedAt: 'lifted_at', liftedByStaffId: 'lifted_by_staff_id',
    liftedReason: 'lifted_reason', updatedAt: 'updated_at',
  },
  sellerProfile: {
    userId: 'user_id', status: 'status', enforcementLevel: 'enforcement_level',
    enforcementStartedAt: 'enforcement_started_at', updatedAt: 'updated_at',
    bandOverride: 'band_override', bandOverrideReason: 'band_override_reason',
    bandOverrideBy: 'band_override_by', bandOverrideExpiresAt: 'band_override_expires_at',
  },
  auditEvent: {},
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(async <T>(_key: string, fallback: T): Promise<T> => fallback),
}));

import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { liftEnforcementActionAction, updateSellerBandOverrideAction } from '../enforcement';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STAFF_ID = 'staff-001';
const USER_ID = 'user-001';
const ACTION_ID = 'action-001';

function makeStaffSession(allow = true) {
  return {
    session: { staffUserId: STAFF_ID, email: 'staff@twicely.com', displayName: 'Staff', isPlatformStaff: true, platformRoles: ['MODERATION'] },
    ability: { can: vi.fn().mockReturnValue(allow) },
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  const chain = { values: vi.fn(), returning: vi.fn().mockResolvedValue([]) };
  chain.values.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  chain.set.mockReturnValue(chain);
  return chain;
}

const mockStaffAuthorize = vi.mocked(staffAuthorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbInsert = vi.mocked(db.insert);
const mockDbUpdate = vi.mocked(db.update);

// ─── liftEnforcementActionAction ──────────────────────────────────────────────

describe('liftEnforcementActionAction', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('rejects non-MODERATION staff (Forbidden)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession(false) as never);

    const result = await liftEnforcementActionAction({ actionId: ACTION_ID, liftedReason: 'Resolved' });

    expect(result.error).toBe('Forbidden');
  });

  it('rejects non-existent enforcement action', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);

    const result = await liftEnforcementActionAction({ actionId: ACTION_ID, liftedReason: 'Resolved' });

    expect(result.error).toBe('Enforcement action not found');
  });

  it('rejects already-lifted action', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: ACTION_ID, userId: USER_ID, actionType: 'WARNING', status: 'LIFTED',
    }]) as never);

    const result = await liftEnforcementActionAction({ actionId: ACTION_ID, liftedReason: 'Duplicate' });

    expect(result.error).toBe('Action is already lifted');
  });

  it('lifts a SUSPENSION and sets sellerProfile.status to ACTIVE', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: ACTION_ID, userId: USER_ID, actionType: 'SUSPENSION', status: 'ACTIVE',
    }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await liftEnforcementActionAction({ actionId: ACTION_ID, liftedReason: 'Appeal approved' });

    expect(result.success).toBe(true);
    const setCalls = vi.mocked(updateChain.set).mock.calls;
    const statusCall = setCalls.find((c) => (c[0] as Record<string, unknown>).status === 'ACTIVE');
    expect(statusCall).toBeDefined();
  });

  it('lifts a WARNING and clears enforcementLevel on sellerProfile', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: ACTION_ID, userId: USER_ID, actionType: 'WARNING', status: 'ACTIVE',
    }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await liftEnforcementActionAction({ actionId: ACTION_ID, liftedReason: 'Resolved' });

    expect(result.success).toBe(true);
    const setCalls = vi.mocked(updateChain.set).mock.calls;
    const clearCall = setCalls.find((c) => (c[0] as Record<string, unknown>).enforcementLevel === null);
    expect(clearCall).toBeDefined();
  });

  it('sets liftedByStaffId and liftedAt on the enforcement action', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: ACTION_ID, userId: USER_ID, actionType: 'RESTRICTION', status: 'ACTIVE',
    }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await liftEnforcementActionAction({ actionId: ACTION_ID, liftedReason: 'Pardoned' });

    const setCalls = vi.mocked(updateChain.set).mock.calls;
    const liftCall = setCalls.find((c) => (c[0] as Record<string, unknown>).status === 'LIFTED');
    expect((liftCall?.[0] as Record<string, unknown>)?.liftedByStaffId).toBe(STAFF_ID);
    expect((liftCall?.[0] as Record<string, unknown>)?.liftedAt).toBeInstanceOf(Date);
  });
});

// ─── updateSellerBandOverrideAction ───────────────────────────────────────────

describe('updateSellerBandOverrideAction', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('rejects staff without SellerProfile permission', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession(false) as never);

    const result = await updateSellerBandOverrideAction({ userId: USER_ID, bandOverride: 'TOP_RATED', bandOverrideReason: 'Manual' });

    expect(result.error).toBe('Forbidden');
  });

  it('sets bandOverride and bandOverrideBy on sellerProfile', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await updateSellerBandOverrideAction({
      userId: USER_ID,
      bandOverride: 'TOP_RATED',
      bandOverrideReason: 'Exceptional seller',
    });

    expect(result.success).toBe(true);
    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.bandOverride).toBe('TOP_RATED');
    expect(setArgs?.bandOverrideBy).toBe(STAFF_ID);
  });

  // R5: when bandOverride is set, expiry MUST be populated or recalc job ignores it
  it('R5: sets bandOverrideExpiresAt to a future date when bandOverride is provided', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await updateSellerBandOverrideAction({
      userId: USER_ID,
      bandOverride: 'TOP_RATED',
      bandOverrideReason: 'R5 expiry test',
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    const expiresAt = setArgs?.bandOverrideExpiresAt;
    expect(expiresAt).toBeInstanceOf(Date);
    expect((expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('R5: honors caller-supplied bandOverrideExpiresInDays', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const before = Date.now();
    await updateSellerBandOverrideAction({
      userId: USER_ID,
      bandOverride: 'POWER_SELLER',
      bandOverrideReason: 'Custom 30-day override',
      bandOverrideExpiresInDays: 30,
    });
    const after = Date.now();

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    const expiresAt = setArgs?.bandOverrideExpiresAt as Date;
    // ~30 days from now (with a fudge factor for execution time)
    const expectedMin = before + 29.5 * 24 * 60 * 60 * 1000;
    const expectedMax = after + 30.5 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it('R5: leaves bandOverrideExpiresAt null when bandOverride is omitted', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await updateSellerBandOverrideAction({
      userId: USER_ID,
      bandOverrideReason: 'Clearing override',
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.bandOverrideExpiresAt).toBeNull();
  });

  it('clears bandOverride when omitted (sets to null in DB)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    // bandOverride is optional — omitting it means the action sets null in the DB
    const result = await updateSellerBandOverrideAction({
      userId: USER_ID,
      bandOverrideReason: 'Removing override',
    });

    expect(result.success).toBe(true);
    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    // bandOverride ?? null => null since bandOverride is undefined
    expect(setArgs?.bandOverride).toBeNull();
  });

  it('also updates enforcementLevel when provided', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await updateSellerBandOverrideAction({
      userId: USER_ID,
      enforcementLevel: 'WARNING',
      bandOverride: 'ESTABLISHED',
      bandOverrideReason: 'Combined override',
    });

    // Two update calls: one for bandOverride, one for enforcementLevel
    expect(vi.mocked(updateChain.set).mock.calls.length).toBeGreaterThanOrEqual(2);
    const levelCall = vi.mocked(updateChain.set).mock.calls.find(
      (c) => (c[0] as Record<string, unknown>).enforcementLevel !== undefined,
    );
    expect((levelCall?.[0] as Record<string, unknown>)?.enforcementLevel).toBe('WARNING');
  });

  it('creates audit event with BAND_OVERRIDE_SET action', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await updateSellerBandOverrideAction({
      userId: USER_ID,
      bandOverride: 'TOP_RATED',
      bandOverrideReason: 'Audit test',
    });

    expect(mockDbInsert).toHaveBeenCalled();
  });
});
