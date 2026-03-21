import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock('@twicely/db/schema', () => ({
  platformSetting: { id: 'id', key: 'key', value: 'value', updatedByStaffId: 'updated_by_staff_id', updatedAt: 'updated_at' },
  platformSettingHistory: { id: 'id', settingId: 'setting_id' },
  auditEvent: { id: 'id', action: 'action' },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
    }),
  };
}

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function mockCanUpdateSetting() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'update' && s === 'Setting') };
  const session = {
    staffUserId: 'staff-admin-001',
    email: 'admin@twicely.co',
    displayName: 'Admin',
    isPlatformStaff: true as const,
    platformRoles: ['ADMIN'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = {
    staffUserId: 'staff-support-001',
    email: 'support@twicely.co',
    displayName: 'Support',
    isPlatformStaff: true as const,
    platformRoles: ['SUPPORT'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

// ─── updateSettingAction ──────────────────────────────────────────────────────

describe('updateSettingAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  // A. Authorization
  it('returns Forbidden when CASL denies update on Setting', async () => {
    mockForbidden();
    const { updateSettingAction } = await import('../admin-settings');
    const result = await updateSettingAction({ settingId: 'setting-1', value: 10, reason: 'adjustment' });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  // B. Validation
  it('returns Invalid input for missing settingId', async () => {
    mockCanUpdateSetting();
    const { updateSettingAction } = await import('../admin-settings');
    const result = await updateSettingAction({ value: 10, reason: 'adjustment' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for empty settingId', async () => {
    mockCanUpdateSetting();
    const { updateSettingAction } = await import('../admin-settings');
    const result = await updateSettingAction({ settingId: '', value: 10, reason: 'r' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for empty reason', async () => {
    mockCanUpdateSetting();
    const { updateSettingAction } = await import('../admin-settings');
    const result = await updateSettingAction({ settingId: 'setting-1', value: 10, reason: '' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for reason over 500 chars', async () => {
    mockCanUpdateSetting();
    const { updateSettingAction } = await import('../admin-settings');
    const result = await updateSettingAction({ settingId: 'setting-1', value: 10, reason: 'r'.repeat(501) });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra (unknown) fields via strict schema', async () => {
    mockCanUpdateSetting();
    const { updateSettingAction } = await import('../admin-settings');
    const result = await updateSettingAction({ settingId: 'setting-1', value: 10, reason: 'r', extra: 'bad' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  // C. Not found
  it('returns Setting not found when no matching setting exists', async () => {
    mockCanUpdateSetting();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { updateSettingAction } = await import('../admin-settings');
    const result = await updateSettingAction({ settingId: 'missing-id', value: 10, reason: 'fix' });
    expect(result).toEqual({ error: 'Setting not found' });
  });

  // D. Happy path
  it('saves history, updates setting, and creates HIGH audit event', async () => {
    mockCanUpdateSetting();
    const existingSetting = { id: 'setting-1', key: 'commerce.payout.minimumCents', value: 1500, updatedByStaffId: null };
    mockDbSelect.mockReturnValue(makeSelectChain([existingSetting]));
    const historyChain = makeInsertChain();
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(historyChain).mockReturnValueOnce(auditChain);
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateSettingAction } = await import('../admin-settings');
    const result = await updateSettingAction({ settingId: 'setting-1', value: 2000, reason: 'Raise minimum payout' });

    expect(result).toEqual({ success: true });

    // Two insert calls: history + audit
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);

    // History record
    const historyValues = historyChain.values.mock.calls[0]![0];
    expect(historyValues.settingId).toBe('setting-1');
    expect(historyValues.previousValue).toBe(1500);
    expect(historyValues.newValue).toBe(2000);
    expect(historyValues.changedByStaffId).toBe('staff-admin-001');
    expect(historyValues.reason).toBe('Raise minimum payout');

    // Update record
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.value).toBe(2000);
    expect(updateSet.updatedByStaffId).toBe('staff-admin-001');
    expect(updateSet.updatedAt).toBeInstanceOf(Date);

    // Audit event
    const auditValues = auditChain.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('UPDATE_SETTING');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.subject).toBe('Setting');
    expect(auditValues.subjectId).toBe('setting-1');
    expect(auditValues.actorType).toBe('STAFF');
    expect(auditValues.actorId).toBe('staff-admin-001');
    expect(auditValues.detailsJson.key).toBe('commerce.payout.minimumCents');
    expect(auditValues.detailsJson.reason).toBe('Raise minimum payout');
  });

  // G. Business rules — value can be any type (z.unknown())
  it('accepts string value for setting update', async () => {
    mockCanUpdateSetting();
    const existingSetting = { id: 'setting-2', key: 'platform.maintenance.message', value: 'old msg', updatedByStaffId: null };
    mockDbSelect.mockReturnValue(makeSelectChain([existingSetting]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateSettingAction } = await import('../admin-settings');
    const result = await updateSettingAction({ settingId: 'setting-2', value: 'new msg', reason: 'Update msg' });
    expect(result).toEqual({ success: true });
  });

  it('accepts boolean value for setting update', async () => {
    mockCanUpdateSetting();
    const existingSetting = { id: 'setting-3', key: 'platform.maintenance.enabled', value: false, updatedByStaffId: null };
    mockDbSelect.mockReturnValue(makeSelectChain([existingSetting]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateSettingAction } = await import('../admin-settings');
    const result = await updateSettingAction({ settingId: 'setting-3', value: true, reason: 'Enable maintenance' });
    expect(result).toEqual({ success: true });
  });

  it('accepts null value for setting update', async () => {
    mockCanUpdateSetting();
    const existingSetting = { id: 'setting-4', key: 'platform.banner', value: 'text', updatedByStaffId: null };
    mockDbSelect.mockReturnValue(makeSelectChain([existingSetting]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateSettingAction } = await import('../admin-settings');
    const result = await updateSettingAction({ settingId: 'setting-4', value: null, reason: 'Clear banner' });
    expect(result).toEqual({ success: true });
  });
});
