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
  like: vi.fn((_col: unknown, _val: unknown) => ({ type: 'like' })),
}));

vi.mock('@twicely/db/schema', () => ({
  platformSetting: { id: 'id', key: 'key', value: 'value', updatedByStaffId: 'updated_by_staff_id', updatedAt: 'updated_at' },
  platformSettingHistory: { id: 'id', settingId: 'setting_id' },
  auditEvent: { id: 'id', action: 'action' },
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
    }),
  };
}

function makeSelectChainNoLimit(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
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

function mockCanReadSetting() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'read' && s === 'Setting') };
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

// ─── updateConnectorSettings ──────────────────────────────────────────────────

describe('updateConnectorSettings', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when unauthenticated (no update Setting ability)', async () => {
    mockForbidden();
    const { updateConnectorSettings } = await import('../admin-connector-settings');
    const result = await updateConnectorSettings({ connectorCode: 'ebay', settings: {} });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input when connectorCode is missing', async () => {
    mockCanUpdateSetting();
    const { updateConnectorSettings } = await import('../admin-connector-settings');
    const result = await updateConnectorSettings({ settings: {} });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input when settings is missing', async () => {
    mockCanUpdateSetting();
    const { updateConnectorSettings } = await import('../admin-connector-settings');
    const result = await updateConnectorSettings({ connectorCode: 'ebay' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields via strict schema', async () => {
    mockCanUpdateSetting();
    const { updateConnectorSettings } = await import('../admin-connector-settings');
    const result = await updateConnectorSettings({ connectorCode: 'ebay', settings: {}, extra: 'bad' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('updates matching settings and creates history entries', async () => {
    mockCanUpdateSetting();
    const existingSetting = {
      id: 'setting-ebay-1',
      key: 'crosslister.ebay.clientId',
      value: 'old-client-id',
      updatedByStaffId: null,
    };
    mockDbSelect.mockReturnValue(makeSelectChain([existingSetting]));
    const historyChain = makeInsertChain();
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(historyChain).mockReturnValueOnce(auditChain);
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateConnectorSettings } = await import('../admin-connector-settings');
    const result = await updateConnectorSettings({
      connectorCode: 'ebay',
      settings: { 'crosslister.ebay.clientId': 'new-client-id' },
    });

    expect(result).toEqual({ success: true });
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);

    const historyValues = historyChain.values.mock.calls[0]![0];
    expect(historyValues.settingId).toBe('setting-ebay-1');
    expect(historyValues.previousValue).toBe('old-client-id');
    expect(historyValues.newValue).toBe('new-client-id');
    expect(historyValues.changedByStaffId).toBe('staff-admin-001');
    expect(historyValues.reason).toBe('Connector settings update: ebay');
  });

  it('skips keys that do not match the connector prefix', async () => {
    mockCanUpdateSetting();
    // No DB select will be called for non-matching key
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(auditChain);

    const { updateConnectorSettings } = await import('../admin-connector-settings');
    const result = await updateConnectorSettings({
      connectorCode: 'ebay',
      settings: {
        'crosslister.poshmark.clientId': 'wrong-connector',
        'platform.fees.tf': 'forbidden',
      },
    });

    expect(result).toEqual({ success: true });
    // select should NOT be called for mismatched keys
    expect(mockDbSelect).not.toHaveBeenCalled();
    // Only audit insert, no history insert
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });

  it('creates audit event with severity HIGH', async () => {
    mockCanUpdateSetting();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(auditChain);

    const { updateConnectorSettings } = await import('../admin-connector-settings');
    await updateConnectorSettings({
      connectorCode: 'ebay',
      settings: { 'crosslister.ebay.clientId': 'abc' },
    });

    const auditValues = auditChain.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('UPDATE_CONNECTOR_SETTINGS');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.subject).toBe('Setting');
    expect(auditValues.subjectId).toBe('ebay');
    expect(auditValues.actorType).toBe('STAFF');
    expect(auditValues.actorId).toBe('staff-admin-001');
    expect(auditValues.detailsJson.connectorCode).toBe('ebay');
  });

  it('revalidates the connector cfg path', async () => {
    mockCanUpdateSetting();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateConnectorSettings } = await import('../admin-connector-settings');
    await updateConnectorSettings({
      connectorCode: 'ebay',
      settings: { 'crosslister.ebay.clientId': 'abc' },
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/cfg/ebay');
  });
});

// ─── testConnectorConnection ──────────────────────────────────────────────────

describe('testConnectorConnection', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when unauthenticated (no read Setting ability)', async () => {
    mockForbidden();
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'ebay' });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input when connectorCode is missing', async () => {
    mockCanReadSetting();
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({});
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input when connectorCode exceeds 50 chars', async () => {
    mockCanReadSetting();
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'x'.repeat(51) });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns failure for unknown connector code', async () => {
    mockCanReadSetting();
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([]));
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'unknown-platform' });
    expect(result).toMatchObject({ success: false, message: expect.stringContaining('Unknown connector') });
  });

  it('returns success when OAuth connector has clientId and clientSecret', async () => {
    mockCanReadSetting();
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([
      { key: 'crosslister.ebay.clientId', value: 'my-client-id' },
      { key: 'crosslister.ebay.clientSecret', value: 'my-client-secret' },
      { key: 'crosslister.ebay.importEnabled', value: true },
    ]));
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'ebay' });
    expect(result).toMatchObject({ success: true, checks: { hasCredentials: true } });
  });

  it('returns failure when OAuth connector has empty clientId', async () => {
    mockCanReadSetting();
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([
      { key: 'crosslister.ebay.clientId', value: '' },
      { key: 'crosslister.ebay.clientSecret', value: 'my-secret' },
    ]));
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'ebay' });
    expect(result).toMatchObject({ success: false, checks: { hasCredentials: false } });
  });

  it('returns failure when OAuth connector has no settings at all', async () => {
    mockCanReadSetting();
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([]));
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'etsy' });
    expect(result).toMatchObject({ success: false, checks: { hasCredentials: false } });
  });

  it('returns success when session connector has apiBase', async () => {
    mockCanReadSetting();
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([
      { key: 'crosslister.poshmark.apiBase', value: 'https://api.poshmark.com' },
      { key: 'crosslister.poshmark.importEnabled', value: true },
    ]));
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'poshmark' });
    expect(result).toMatchObject({ success: true, checks: { hasCredentials: true } });
  });

  it('returns failure when session connector has empty apiBase', async () => {
    mockCanReadSetting();
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([
      { key: 'crosslister.poshmark.apiBase', value: '' },
    ]));
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'poshmark' });
    expect(result).toMatchObject({ success: false, checks: { hasCredentials: false } });
  });

  it('returns success for therealreal session connector with apiBase', async () => {
    mockCanReadSetting();
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([
      { key: 'crosslister.therealreal.apiBase', value: 'https://api.therealreal.com' },
    ]));
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'therealreal' });
    expect(result).toMatchObject({ success: true, checks: { hasCredentials: true } });
  });

  it('checks for at least one enabled feature (hasEnabledFeature=true)', async () => {
    mockCanReadSetting();
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([
      { key: 'crosslister.ebay.clientId', value: 'id' },
      { key: 'crosslister.ebay.clientSecret', value: 'secret' },
      { key: 'crosslister.ebay.crosslistEnabled', value: true },
    ]));
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'ebay' });
    expect(result).toMatchObject({ checks: { hasEnabledFeature: true } });
  });

  it('returns hasEnabledFeature=false when all feature flags are disabled', async () => {
    mockCanReadSetting();
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([
      { key: 'crosslister.ebay.clientId', value: 'id' },
      { key: 'crosslister.ebay.clientSecret', value: 'secret' },
      { key: 'crosslister.ebay.importEnabled', value: false },
      { key: 'crosslister.ebay.crosslistEnabled', value: false },
      { key: 'crosslister.ebay.automationEnabled', value: false },
    ]));
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'ebay' });
    expect(result).toMatchObject({ checks: { hasEnabledFeature: false } });
  });

  it('rejects extra fields via strict schema', async () => {
    mockCanReadSetting();
    const { testConnectorConnection } = await import('../admin-connector-settings');
    const result = await testConnectorConnection({ connectorCode: 'ebay', extra: 'bad' });
    expect(result).toEqual({ error: 'Invalid input' });
  });
});
