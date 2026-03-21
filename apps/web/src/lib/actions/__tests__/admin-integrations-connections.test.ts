import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
  and: vi.fn((..._args: unknown[]) => ({ type: 'and' })),
}));

vi.mock('@twicely/db/schema', () => ({
  platformSetting: { id: 'id', key: 'key', value: 'value' },
  platformSettingHistory: { id: 'id', settingId: 'setting_id' },
  providerInstance: { id: 'id', name: 'name', adapterId: 'adapter_id', displayName: 'display_name', createdByStaffId: 'created_by_staff_id' },
  providerSecret: { id: 'id', instanceId: 'instance_id', key: 'key', encryptedValue: 'encrypted_value', updatedAt: 'updated_at' },
  auditEvent: { id: 'id', action: 'action' },
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-cuid',
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChainLimit(rows: unknown[]) {
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

function mockCanReadSetting() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'read' && s === 'Setting') };
  const session = { staffUserId: 'staff-admin-001', email: 'admin@twicely.co', displayName: 'Admin', isPlatformStaff: true as const, platformRoles: ['ADMIN'] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = { staffUserId: 'staff-001', email: 'a@b.co', displayName: 'A', isPlatformStaff: true as const, platformRoles: [] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

// ─── testStripeConnection ─────────────────────────────────────────────────────

describe('testStripeConnection', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when unauthenticated', async () => {
    mockForbidden();
    const { testStripeConnection } = await import('../admin-integrations');
    expect(await testStripeConnection()).toEqual({ error: 'Forbidden' });
  });

  it('returns failure when no Stripe instance exists', async () => {
    mockCanReadSetting();
    mockDbSelect.mockReturnValue(makeSelectChainLimit([]));

    const { testStripeConnection } = await import('../admin-integrations');
    const result = await testStripeConnection();

    expect(result).toMatchObject({ success: false, message: 'No Stripe instance configured' });
  });

  it('returns failure when no API keys are configured', async () => {
    mockCanReadSetting();
    const instance = { id: 'instance-stripe-1' };
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainLimit([instance]))
      .mockReturnValueOnce(makeSelectChainNoLimit([]));

    const { testStripeConnection } = await import('../admin-integrations');
    const result = await testStripeConnection();

    expect(result).toMatchObject({ success: false, message: 'No API keys configured' });
  });

  it('returns success when test_secret_key exists', async () => {
    mockCanReadSetting();
    const instance = { id: 'instance-stripe-1' };
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainLimit([instance]))
      .mockReturnValueOnce(makeSelectChainNoLimit([{ key: 'test_secret_key' }]));

    const { testStripeConnection } = await import('../admin-integrations');
    const result = await testStripeConnection();

    expect(result).toMatchObject({ success: true, message: 'Stripe keys are configured' });
  });

  it('returns success when live_secret_key exists', async () => {
    mockCanReadSetting();
    const instance = { id: 'instance-stripe-1' };
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainLimit([instance]))
      .mockReturnValueOnce(makeSelectChainNoLimit([{ key: 'live_secret_key' }]));

    const { testStripeConnection } = await import('../admin-integrations');
    const result = await testStripeConnection();

    expect(result).toMatchObject({ success: true });
  });
});

// ─── testShippoConnection ─────────────────────────────────────────────────────

describe('testShippoConnection', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when unauthenticated', async () => {
    mockForbidden();
    const { testShippoConnection } = await import('../admin-integrations');
    expect(await testShippoConnection()).toEqual({ error: 'Forbidden' });
  });

  it('returns failure when no Shippo instance exists', async () => {
    mockCanReadSetting();
    mockDbSelect.mockReturnValue(makeSelectChainLimit([]));

    const { testShippoConnection } = await import('../admin-integrations');
    const result = await testShippoConnection();

    expect(result).toMatchObject({ success: false, message: 'No Shippo instance configured' });
  });

  it('returns failure when no API keys are configured', async () => {
    mockCanReadSetting();
    const instance = { id: 'instance-shippo-1' };
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainLimit([instance]))
      .mockReturnValueOnce(makeSelectChainNoLimit([]));

    const { testShippoConnection } = await import('../admin-integrations');
    const result = await testShippoConnection();

    expect(result).toMatchObject({ success: false, message: 'No API keys configured' });
  });

  it('returns success when live_secret_key exists', async () => {
    mockCanReadSetting();
    const instance = { id: 'instance-shippo-1' };
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainLimit([instance]))
      .mockReturnValueOnce(makeSelectChainNoLimit([{ key: 'live_secret_key' }]));

    const { testShippoConnection } = await import('../admin-integrations');
    const result = await testShippoConnection();

    expect(result).toMatchObject({ success: true, message: 'Shippo keys are configured' });
  });

  it('returns success when test_secret_key exists for Shippo', async () => {
    mockCanReadSetting();
    const instance = { id: 'instance-shippo-1' };
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainLimit([instance]))
      .mockReturnValueOnce(makeSelectChainNoLimit([{ key: 'test_secret_key' }]));

    const { testShippoConnection } = await import('../admin-integrations');
    const result = await testShippoConnection();

    expect(result).toMatchObject({ success: true });
  });
});
