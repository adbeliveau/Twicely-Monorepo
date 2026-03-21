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
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
  and: vi.fn((..._args: unknown[]) => ({ type: 'and' })),
}));

vi.mock('@twicely/db/schema', () => ({
  platformSetting: { id: 'id', key: 'key', value: 'value', updatedByStaffId: 'updated_by_staff_id', updatedAt: 'updated_at', type: 'type', category: 'category', description: 'description' },
  platformSettingHistory: { id: 'id', settingId: 'setting_id' },
  providerInstance: { id: 'id', name: 'name', adapterId: 'adapter_id', displayName: 'display_name', createdByStaffId: 'created_by_staff_id' },
  providerSecret: { id: 'id', instanceId: 'instance_id', key: 'key', encryptedValue: 'encrypted_value', updatedAt: 'updated_at' },
  auditEvent: { id: 'id', action: 'action' },
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-cuid',
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
  const session = { staffUserId: 'staff-admin-001', email: 'admin@twicely.co', displayName: 'Admin', isPlatformStaff: true as const, platformRoles: ['ADMIN'] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = { staffUserId: 'staff-001', email: 'a@b.co', displayName: 'A', isPlatformStaff: true as const, platformRoles: [] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

// ─── updateIntegrationKeys ────────────────────────────────────────────────────

describe('updateIntegrationKeys', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when unauthenticated', async () => {
    mockForbidden();
    const { updateIntegrationKeys } = await import('../admin-integrations');
    expect(await updateIntegrationKeys({ provider: 'stripe' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for invalid provider value', async () => {
    mockCanUpdateSetting();
    const { updateIntegrationKeys } = await import('../admin-integrations');
    expect(await updateIntegrationKeys({ provider: 'paypal' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input when provider is missing', async () => {
    mockCanUpdateSetting();
    const { updateIntegrationKeys } = await import('../admin-integrations');
    expect(await updateIntegrationKeys({})).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields via strict schema', async () => {
    mockCanUpdateSetting();
    const { updateIntegrationKeys } = await import('../admin-integrations');
    expect(await updateIntegrationKeys({ provider: 'stripe', extra: 'bad' })).toEqual({ error: 'Invalid input' });
  });

  it('gets or creates provider instance and upserts secret for Stripe', async () => {
    mockCanUpdateSetting();
    const instanceRow = { id: 'instance-stripe-1' };
    // getOrCreateInstance select
    mockDbSelect.mockReturnValueOnce(makeSelectChain([instanceRow]));
    // upsertSecret select (existing secret)
    const existingSecret = { id: 'secret-1' };
    mockDbSelect.mockReturnValueOnce(makeSelectChain([existingSecret]));
    // audit insert
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(auditChain);
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateIntegrationKeys } = await import('../admin-integrations');
    const result = await updateIntegrationKeys({ provider: 'stripe', testSecretKey: 'sk_test_abc123' });

    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
  });

  it('creates new provider instance when none exists', async () => {
    mockCanUpdateSetting();
    // getOrCreateInstance — no existing instance
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    // upsertSecret — no existing secret
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const insertInstanceChain = makeInsertChain();
    const insertSecretChain = makeInsertChain();
    const insertAuditChain = makeInsertChain();
    mockDbInsert
      .mockReturnValueOnce(insertInstanceChain)
      .mockReturnValueOnce(insertSecretChain)
      .mockReturnValueOnce(insertAuditChain);

    const { updateIntegrationKeys } = await import('../admin-integrations');
    const result = await updateIntegrationKeys({ provider: 'stripe', liveSecretKey: 'sk_live_xyz' });

    expect(result).toEqual({ success: true });
    expect(mockDbInsert).toHaveBeenCalledTimes(3);
  });

  it('creates audit event for key update', async () => {
    mockCanUpdateSetting();
    const instanceRow = { id: 'instance-stripe-1' };
    mockDbSelect.mockReturnValueOnce(makeSelectChain([instanceRow]));
    // No keys to upsert (all optional fields empty)
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(auditChain);

    const { updateIntegrationKeys } = await import('../admin-integrations');
    await updateIntegrationKeys({ provider: 'stripe' });

    const auditValues = auditChain.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('UPDATE_INTEGRATION_KEYS');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.subject).toBe('Setting');
    expect(auditValues.actorType).toBe('STAFF');
    expect(auditValues.detailsJson.provider).toBe('stripe');
  });

  it('skips empty key values (testSecretKey empty string = no upsert)', async () => {
    mockCanUpdateSetting();
    const instanceRow = { id: 'instance-shippo-1' };
    mockDbSelect.mockReturnValueOnce(makeSelectChain([instanceRow]));
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(auditChain);

    const { updateIntegrationKeys } = await import('../admin-integrations');
    // Empty testSecretKey is falsy — upsertSecret should NOT be called
    const result = await updateIntegrationKeys({ provider: 'shippo' });

    expect(result).toEqual({ success: true });
    // Only audit insert — no secret inserts or updates
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });
});

// ─── toggleIntegrationModule ──────────────────────────────────────────────────

describe('toggleIntegrationModule', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when unauthenticated', async () => {
    mockForbidden();
    const { toggleIntegrationModule } = await import('../admin-integrations');
    expect(await toggleIntegrationModule({ moduleKey: 'integrations.shippo.enabled', enabled: true })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input when moduleKey is missing', async () => {
    mockCanUpdateSetting();
    const { toggleIntegrationModule } = await import('../admin-integrations');
    expect(await toggleIntegrationModule({ enabled: true })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input when enabled is missing', async () => {
    mockCanUpdateSetting();
    const { toggleIntegrationModule } = await import('../admin-integrations');
    expect(await toggleIntegrationModule({ moduleKey: 'integrations.shippo.enabled' })).toEqual({ error: 'Invalid input' });
  });

  it('creates new setting when it does not exist', async () => {
    mockCanUpdateSetting();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const insertChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(insertChain);

    const { toggleIntegrationModule } = await import('../admin-integrations');
    const result = await toggleIntegrationModule({ moduleKey: 'integrations.shippo.enabled', enabled: true });

    expect(result).toEqual({ success: true });
    const insertValues = insertChain.values.mock.calls[0]![0];
    expect(insertValues.key).toBe('integrations.shippo.enabled');
    expect(insertValues.value).toBe(true);
    expect(insertValues.type).toBe('boolean');
    expect(insertValues.category).toBe('integrations');
  });

  it('updates existing setting with history entry', async () => {
    mockCanUpdateSetting();
    const existingSetting = { id: 'setting-mod-1', key: 'integrations.shippo.enabled', value: true };
    mockDbSelect.mockReturnValue(makeSelectChain([existingSetting]));
    const historyChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(historyChain);
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { toggleIntegrationModule } = await import('../admin-integrations');
    const result = await toggleIntegrationModule({ moduleKey: 'integrations.shippo.enabled', enabled: false });

    expect(result).toEqual({ success: true });
    const historyValues = historyChain.values.mock.calls[0]![0];
    expect(historyValues.settingId).toBe('setting-mod-1');
    expect(historyValues.previousValue).toBe(true);
    expect(historyValues.newValue).toBe(false);
    expect(historyValues.changedByStaffId).toBe('staff-admin-001');
  });

  it('toggles from enabled to disabled', async () => {
    mockCanUpdateSetting();
    const existingSetting = { id: 'setting-mod-2', key: 'integrations.stripe.enabled', value: true };
    mockDbSelect.mockReturnValue(makeSelectChain([existingSetting]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { toggleIntegrationModule } = await import('../admin-integrations');
    const result = await toggleIntegrationModule({ moduleKey: 'integrations.stripe.enabled', enabled: false });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.value).toBe(false);
  });
});
