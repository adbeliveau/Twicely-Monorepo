/**
 * Tests for accounting-integration.ts server actions — G10.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
const mockGetFinanceTier = vi.fn();
const mockRunFullSync = vi.fn();
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockDbInsert = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (type: string, conditions: Record<string, unknown>) => ({
    ...conditions,
    __caslSubjectType__: type,
  }),
}));

vi.mock('@/lib/queries/finance-center', () => ({
  getFinanceTier: (...args: unknown[]) => mockGetFinanceTier(...args),
}));

vi.mock('@/lib/accounting/sync-engine', () => ({
  runFullSync: (...args: unknown[]) => mockRunFullSync(...args),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  accountingIntegration: { id: 'id', userId: 'userId', provider: 'provider', status: 'status' },
  accountingSyncLog: { id: 'id', integrationId: 'integrationId', startedAt: 'startedAt' },
  accountingEntityMap: { id: 'id', integrationId: 'integrationId' },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const INTEGRATION_ID = 'abc123integration0001';
const USER_ID = 'user-test-001';

const INTEGRATION_ROW = {
  id: INTEGRATION_ID,
  provider: 'QUICKBOOKS',
  status: 'CONNECTED',
  externalAccountId: 'realm-123',
  companyName: 'Test Co',
  lastSyncAt: null,
  lastSyncStatus: null,
  syncFrequency: 'DAILY',
  syncErrorCount: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function mockAuth(overrides?: Record<string, unknown>) {
  mockAuthorize.mockResolvedValue({
    session: {
      userId: USER_ID,
      delegationId: null,
      onBehalfOfSellerId: null,
      ...overrides,
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  });
}

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
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
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

function makeDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── getAccountingIntegrations ──────────────────────────────────────────────

describe('getAccountingIntegrations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { getAccountingIntegrations } = await import('../accounting-integration');
    const result = await getAccountingIntegrations();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns Forbidden when CASL denies', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: USER_ID, delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { getAccountingIntegrations } = await import('../accounting-integration');
    const result = await getAccountingIntegrations();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns integrations without tokens', async () => {
    mockAuth();
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([INTEGRATION_ROW]));
    const { getAccountingIntegrations } = await import('../accounting-integration');
    const result = await getAccountingIntegrations();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.integrations).toHaveLength(1);
      expect(result.integrations[0]).not.toHaveProperty('accessToken');
      expect(result.integrations[0]).not.toHaveProperty('refreshToken');
    }
  });

  it('returns empty array when no integrations exist', async () => {
    mockAuth();
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([]));
    const { getAccountingIntegrations } = await import('../accounting-integration');
    const result = await getAccountingIntegrations();
    expect(result.success).toBe(true);
    if (result.success) expect(result.integrations).toHaveLength(0);
  });
});

// ─── disconnectAccountingIntegration ────────────────────────────────────────

describe('disconnectAccountingIntegration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { disconnectAccountingIntegration } = await import('../accounting-integration');
    const result = await disconnectAccountingIntegration({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns Forbidden when CASL denies', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: USER_ID, delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { disconnectAccountingIntegration } = await import('../accounting-integration');
    const result = await disconnectAccountingIntegration({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns validation error for missing integrationId', async () => {
    mockAuth();
    const { disconnectAccountingIntegration } = await import('../accounting-integration');
    const result = await disconnectAccountingIntegration({});
    expect(result.success).toBe(false);
  });

  it('returns not found when integration does not exist', async () => {
    mockAuth();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { disconnectAccountingIntegration } = await import('../accounting-integration');
    const result = await disconnectAccountingIntegration({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Integration not found');
  });

  it('sets DISCONNECTED, clears tokens, deletes mappings', async () => {
    mockAuth();
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: INTEGRATION_ID }]));
    mockDbDelete.mockReturnValue(makeDeleteChain());
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const { disconnectAccountingIntegration } = await import('../accounting-integration');
    const result = await disconnectAccountingIntegration({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(true);
    expect(mockDbDelete).toHaveBeenCalled();
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances/integrations');
  });
});

// ─── triggerAccountingSync ──────────────────────────────────────────────────

describe('triggerAccountingSync', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { triggerAccountingSync } = await import('../accounting-integration');
    const result = await triggerAccountingSync({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns error when finance tier is FREE', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('FREE');
    const { triggerAccountingSync } = await import('../accounting-integration');
    const result = await triggerAccountingSync({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain('Finance Pro');
  });

  it('returns not found when integration does not exist', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { triggerAccountingSync } = await import('../accounting-integration');
    const result = await triggerAccountingSync({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Integration not found');
  });

  it('calls runFullSync and returns result', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: INTEGRATION_ID }]));
    mockRunFullSync.mockResolvedValue({
      success: true,
      logId: 'log-001',
      recordsSynced: 5,
      recordsFailed: 0,
    });
    const { triggerAccountingSync } = await import('../accounting-integration');
    const result = await triggerAccountingSync({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.recordsSynced).toBe(5);
      expect(result.logId).toBe('log-001');
    }
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances/integrations');
  });
});

// ─── getAccountingSyncHistory ────────────────────────────────────────────────

describe('getAccountingSyncHistory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { getAccountingSyncHistory } = await import('../accounting-integration');
    const result = await getAccountingSyncHistory({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(false);
  });

  it('returns not found when integration is not owned by user', async () => {
    mockAuth();
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))  // ownership check
      .mockReturnValueOnce(makeSelectChain([])); // logs query
    const { getAccountingSyncHistory } = await import('../accounting-integration');
    const result = await getAccountingSyncHistory({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Integration not found');
  });

  it('returns sync logs for integration', async () => {
    const logRow = {
      id: 'log-001',
      integrationId: INTEGRATION_ID,
      syncType: 'FULL',
      status: 'COMPLETED',
      recordsSynced: 3,
      recordsFailed: 0,
      errorMessage: null,
      startedAt: new Date('2026-01-01'),
      completedAt: new Date('2026-01-01'),
    };
    mockAuth();
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: INTEGRATION_ID }]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([logRow]),
            }),
          }),
        }),
      });
    const { getAccountingSyncHistory } = await import('../accounting-integration');
    const result = await getAccountingSyncHistory({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]?.syncType).toBe('FULL');
    }
  });
});

// ─── updateSyncFrequency ─────────────────────────────────────────────────────

describe('updateSyncFrequency', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('returns validation error for invalid frequency', async () => {
    mockAuth();
    const { updateSyncFrequency } = await import('../accounting-integration');
    const result = await updateSyncFrequency({ integrationId: INTEGRATION_ID, frequency: 'WEEKLY' });
    expect(result.success).toBe(false);
  });

  it('accepts valid frequency values', async () => {
    mockAuth();
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: INTEGRATION_ID }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const { updateSyncFrequency } = await import('../accounting-integration');

    for (const freq of ['HOURLY', 'DAILY', 'MANUAL']) {
      vi.resetAllMocks();
      mockAuth();
      mockDbSelect.mockReturnValue(makeSelectChain([{ id: INTEGRATION_ID }]));
      mockDbUpdate.mockReturnValue(makeUpdateChain());
      const result = await updateSyncFrequency({ integrationId: INTEGRATION_ID, frequency: freq });
      expect(result.success).toBe(true);
    }
  });

  it('returns not found when integration does not exist', async () => {
    mockAuth();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { updateSyncFrequency } = await import('../accounting-integration');
    const result = await updateSyncFrequency({ integrationId: INTEGRATION_ID, frequency: 'DAILY' });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Integration not found');
  });
});

// ─── getAccountingSyncStatus ─────────────────────────────────────────────────

describe('getAccountingSyncStatus', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { getAccountingSyncStatus } = await import('../accounting-integration');
    const result = await getAccountingSyncStatus({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns sync status fields', async () => {
    mockAuth();
    mockDbSelect.mockReturnValue(
      makeSelectChain([{
        status: 'CONNECTED',
        lastSyncAt: null,
        lastSyncStatus: null,
        syncErrorCount: 0,
        userId: USER_ID,
      }]),
    );
    const { getAccountingSyncStatus } = await import('../accounting-integration');
    const result = await getAccountingSyncStatus({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.status).toBe('CONNECTED');
      expect(result.syncErrorCount).toBe(0);
    }
  });

  it('returns not found when integration is not owned by user', async () => {
    mockAuth();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { getAccountingSyncStatus } = await import('../accounting-integration');
    const result = await getAccountingSyncStatus({ integrationId: INTEGRATION_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Integration not found');
  });
});
