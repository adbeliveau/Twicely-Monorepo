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
}));

vi.mock('@twicely/db/schema', () => ({
  providerInstance: { id: 'id', adapterId: 'adapter_id', status: 'status', priority: 'priority', displayName: 'display_name', lastHealthStatus: 'last_health_status', lastHealthCheckAt: 'last_health_check_at', lastHealthLatencyMs: 'last_health_latency_ms', updatedAt: 'updated_at', createdByStaffId: 'created_by_staff_id', configJson: 'config_json', lastHealthError: 'last_health_error' },
  providerSecret: { instanceId: 'instance_id', key: 'key', encryptedValue: 'encrypted_value', updatedAt: 'updated_at' },
  providerUsageMapping: { id: 'id', usageKey: 'usage_key', updatedAt: 'updated_at' },
  providerHealthLog: { instanceId: 'instance_id', status: 'status', latencyMs: 'latency_ms', detailsJson: 'details_json' },
  auditEvent: { id: 'id', action: 'action' },
}));

vi.mock('@/lib/crypto/provider-secrets', () => ({
  encryptSecret: vi.fn((v: string) => `enc:${v}`),
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

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function makeInsertChain(returning?: unknown[]) {
  if (returning !== undefined) {
    return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(returning) }) };
  }
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeInsertConflictChain() {
  return { values: vi.fn().mockReturnValue({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) }) };
}

function mockAdmin(extraAbility?: Record<string, boolean>) {
  const can = vi.fn((a: string, s: string) => {
    if (extraAbility && `${a}:${s}` in extraAbility) return extraAbility[`${a}:${s}`];
    return true; // admin can do everything
  });
  const session = { staffUserId: 'staff-admin-001', email: 'admin@twicely.co', displayName: 'Admin', isPlatformStaff: true as const, platformRoles: ['ADMIN'] };
  mockStaffAuthorize.mockResolvedValue({ ability: { can }, session });
}

function mockForbidden() {
  const session = { staffUserId: 'staff-x', email: 'x@twicely.co', displayName: 'X', isPlatformStaff: true as const, platformRoles: ['SUPPORT'] };
  mockStaffAuthorize.mockResolvedValue({ ability: { can: vi.fn().mockReturnValue(false) }, session });
}

// ─── createInstance ───────────────────────────────────────────────────────────

describe('createInstance', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies create ProviderInstance', async () => {
    mockForbidden();
    const { createInstance } = await import('../admin-providers');
    const result = await createInstance({ adapterId: 'a1', name: 'n', displayName: 'N' });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing adapterId', async () => {
    mockAdmin();
    const { createInstance } = await import('../admin-providers');
    const result = await createInstance({ name: 'n', displayName: 'N' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for empty name', async () => {
    mockAdmin();
    const { createInstance } = await import('../admin-providers');
    const result = await createInstance({ adapterId: 'a1', name: '', displayName: 'N' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields via strict schema', async () => {
    mockAdmin();
    const { createInstance } = await import('../admin-providers');
    const result = await createInstance({ adapterId: 'a1', name: 'n', displayName: 'N', extra: 'bad' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('creates instance and returns id on success', async () => {
    mockAdmin();
    const insertChain = makeInsertChain([{ id: 'inst-001' }]);
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(insertChain).mockReturnValueOnce(auditChain);

    const { createInstance } = await import('../admin-providers');
    const result = await createInstance({ adapterId: 'a1', name: 'stripe-main', displayName: 'Stripe Main' });
    expect(result).toEqual({ success: true, id: 'inst-001' });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/cfg/providers');
  });

  it('inserts secrets when provided', async () => {
    mockAdmin();
    const instanceChain = makeInsertChain([{ id: 'inst-002' }]);
    const secretChain = makeInsertChain();
    const auditChain = makeInsertChain();
    mockDbInsert
      .mockReturnValueOnce(instanceChain)
      .mockReturnValueOnce(secretChain)
      .mockReturnValueOnce(auditChain);

    const { createInstance } = await import('../admin-providers');
    const result = await createInstance({
      adapterId: 'a1',
      name: 'stripe-main',
      displayName: 'Stripe Main',
      secrets: { api_key: 'sk_live_xxx' },
    });
    expect(result).toEqual({ success: true, id: 'inst-002' });
    expect(mockDbInsert).toHaveBeenCalledTimes(3); // instance + secret + audit
  });
});

// ─── updateInstance ───────────────────────────────────────────────────────────

describe('updateInstance', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update ProviderInstance', async () => {
    mockForbidden();
    const { updateInstance } = await import('../admin-providers');
    const result = await updateInstance({ instanceId: 'inst-1', status: 'DISABLED' });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing instanceId', async () => {
    mockAdmin();
    const { updateInstance } = await import('../admin-providers');
    const result = await updateInstance({ status: 'DISABLED' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('rejects invalid status value', async () => {
    mockAdmin();
    const { updateInstance } = await import('../admin-providers');
    const result = await updateInstance({ instanceId: 'inst-1', status: 'INVALID' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('updates instance and creates audit event', async () => {
    mockAdmin();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(auditChain);

    const { updateInstance } = await import('../admin-providers');
    const result = await updateInstance({ instanceId: 'inst-1', status: 'DISABLED' });
    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });
});

// ─── testInstance ─────────────────────────────────────────────────────────────

describe('testInstance', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies read ProviderInstance', async () => {
    mockForbidden();
    const { testInstance } = await import('../admin-providers');
    const result = await testInstance('inst-1');
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns Instance not found for missing instance', async () => {
    mockAdmin();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { testInstance } = await import('../admin-providers');
    const result = await testInstance('inst-missing');
    expect(result).toEqual({ error: 'Instance not found' });
  });

  it('returns health check result for active instance', async () => {
    mockAdmin();
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: 'inst-1', status: 'ACTIVE' }]));
    const healthChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(healthChain);
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { testInstance } = await import('../admin-providers');
    const result = await testInstance('inst-1');
    expect(result).toMatchObject({ success: true, status: 'healthy' });
  });

  it('returns degraded status for non-ACTIVE instance', async () => {
    mockAdmin();
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: 'inst-2', status: 'DISABLED' }]));
    const healthChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(healthChain);
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { testInstance } = await import('../admin-providers');
    const result = await testInstance('inst-2');
    expect(result).toMatchObject({ success: true, status: 'degraded' });
  });
});

// ─── createUsageMapping ───────────────────────────────────────────────────────

describe('createUsageMapping', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies create ProviderUsageMapping', async () => {
    mockForbidden();
    const { createUsageMapping } = await import('../admin-providers');
    const result = await createUsageMapping({ usageKey: 'email.tx', serviceType: 'EMAIL', primaryInstanceId: 'i1' });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing usageKey', async () => {
    mockAdmin();
    const { createUsageMapping } = await import('../admin-providers');
    const result = await createUsageMapping({ serviceType: 'EMAIL', primaryInstanceId: 'i1' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for unknown serviceType', async () => {
    mockAdmin();
    const { createUsageMapping } = await import('../admin-providers');
    const result = await createUsageMapping({ usageKey: 'email.tx', serviceType: 'FOOBAR', primaryInstanceId: 'i1' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields via strict schema', async () => {
    mockAdmin();
    const { createUsageMapping } = await import('../admin-providers');
    const result = await createUsageMapping({ usageKey: 'k', serviceType: 'EMAIL', primaryInstanceId: 'i1', extra: 'bad' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('creates mapping and audit event on success', async () => {
    mockAdmin();
    const mappingChain = makeInsertChain([{ id: 'mapping-001' }]);
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(mappingChain).mockReturnValueOnce(auditChain);

    const { createUsageMapping } = await import('../admin-providers');
    const result = await createUsageMapping({
      usageKey: 'email.transactional',
      serviceType: 'EMAIL',
      primaryInstanceId: 'inst-001',
      autoFailover: false,
    });
    expect(result).toEqual({ success: true });
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
  });
});

// ─── updateUsageMapping ───────────────────────────────────────────────────────

describe('updateUsageMapping', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update ProviderUsageMapping', async () => {
    mockForbidden();
    const { updateUsageMapping } = await import('../admin-providers');
    const result = await updateUsageMapping({ mappingId: 'm1', autoFailover: true });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing mappingId', async () => {
    mockAdmin();
    const { updateUsageMapping } = await import('../admin-providers');
    const result = await updateUsageMapping({ autoFailover: true });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('updates mapping and creates audit event on success', async () => {
    mockAdmin();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(auditChain);

    const { updateUsageMapping } = await import('../admin-providers');
    const result = await updateUsageMapping({ mappingId: 'm1', autoFailover: true });
    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
  });
});

// ─── saveInstanceConfig ───────────────────────────────────────────────────────

describe('saveInstanceConfig', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update ProviderInstance', async () => {
    mockForbidden();
    const { saveInstanceConfig } = await import('../admin-providers');
    const result = await saveInstanceConfig({ instanceId: 'i1', configJson: {}, secrets: {} });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing instanceId', async () => {
    mockAdmin();
    const { saveInstanceConfig } = await import('../admin-providers');
    const result = await saveInstanceConfig({ configJson: {}, secrets: {} });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('updates config and upserts non-empty secrets', async () => {
    mockAdmin();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const secretConflictChain = makeInsertConflictChain();
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(secretConflictChain).mockReturnValueOnce(auditChain);

    const { saveInstanceConfig } = await import('../admin-providers');
    const result = await saveInstanceConfig({
      instanceId: 'inst-1',
      configJson: { env: 'live' },
      secrets: { api_key: 'sk_live_xxx' },
    });
    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/cfg/providers');
  });

  it('skips empty secret values', async () => {
    mockAdmin();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(auditChain);

    const { saveInstanceConfig } = await import('../admin-providers');
    const result = await saveInstanceConfig({
      instanceId: 'inst-1',
      configJson: {},
      secrets: { api_key: '' }, // empty — should be skipped
    });
    expect(result).toEqual({ success: true });
    // Only audit insert, no secret insert
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });
});
