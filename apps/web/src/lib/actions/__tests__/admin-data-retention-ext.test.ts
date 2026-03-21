import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Extended admin-data-retention tests.
 * Covers: getDataExportRequests, forceCompleteDeletion paths not in base file.
 * Uses vi.clearAllMocks() (preserves mock implementations) to avoid
 * resetting platform-settings mock return values between tests.
 */

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: mockStaffAuthorize,
}));

vi.mock('@twicely/casl', () => ({
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg = 'Forbidden') { super(msg); this.name = 'ForbiddenError'; }
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGetPlatformSetting = vi.fn().mockResolvedValue(30);
const mockGetPlatformSettingsByPrefix = vi.fn().mockResolvedValue(new Map([
  ['retention.messageDays', 730],
  ['retention.auditLogDays', 2555],
]));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
  getPlatformSettingsByPrefix: mockGetPlatformSettingsByPrefix,
}));

vi.mock('@twicely/db/schema', () => ({
  user: {
    id: 'id', name: 'name', email: 'email',
    deletionRequestedAt: 'deletion_requested_at',
  },
  dataExportRequest: {
    id: 'id', userId: 'user_id', createdAt: 'created_at', status: 'status',
  },
  auditEvent: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  isNotNull: vi.fn((col) => ({ op: 'isNotNull', col })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
}));

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate },
}));

function makeSelectChain(results: unknown[]) {
  const chain = {
    from: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(results),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain;
}

function makeAdminSession(staffUserId = 'staff-1') {
  return {
    session: { staffUserId, email: 'admin@twicely.co', displayName: 'Admin', isPlatformStaff: true as const, platformRoles: [] as never[] },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeNonAdminSession() {
  return {
    session: { staffUserId: 'agent-99', email: 'agent@twicely.co', displayName: 'Agent', isPlatformStaff: false as const, platformRoles: [] as never[] },
    ability: { can: vi.fn().mockReturnValue(false) },
  };
}

// Re-apply stable mock return values after any reset
function restoreMocks() {
  mockGetPlatformSetting.mockResolvedValue(30);
  mockGetPlatformSettingsByPrefix.mockResolvedValue(new Map([
    ['retention.messageDays', 730],
    ['retention.auditLogDays', 2555],
    ['retention.searchLogDays', 90],
    ['retention.webhookLogDays', 90],
    ['retention.analyticsEventDays', 365],
    ['retention.notificationLogDays', 180],
    ['gdpr.deletionGracePeriodDays', 30],
  ]));
}

// ─── getDataExportRequests ────────────────────────────────────────────────────

describe('getDataExportRequests', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); restoreMocks(); });

  it('throws ForbiddenError for non-admin', async () => {
    mockStaffAuthorize.mockResolvedValue(makeNonAdminSession());
    const { getDataExportRequests } = await import('../admin-data-retention');
    await expect(getDataExportRequests()).rejects.toThrow('Access denied');
  });

  it('returns list of export requests for admin', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const records = [
      { id: 'der-1', userId: 'user-a', status: 'COMPLETED', format: 'json' },
      { id: 'der-2', userId: 'user-b', status: 'PENDING', format: 'csv' },
    ];
    const chain = {
      from: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn().mockResolvedValue(records),
      then: (resolve: (v: unknown) => void) => Promise.resolve(records).then(resolve),
    };
    chain.from.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    mockDbSelect.mockReturnValue(chain);

    const { getDataExportRequests } = await import('../admin-data-retention');
    const result = await getDataExportRequests();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── forceCompleteDeletion — additional paths ─────────────────────────────────

describe('forceCompleteDeletion — user not in deletion queue', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); restoreMocks(); });

  it('returns error when user exists but has no deletionRequestedAt', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const chain = makeSelectChain([{
      id: 'user-no-del', deletionRequestedAt: null,
    }]);
    mockDbSelect.mockReturnValue(chain);

    const { forceCompleteDeletion } = await import('../admin-data-retention');
    const result = await forceCompleteDeletion({ userId: 'poki1nf4lbwzdme283on2ewk' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('User has not requested deletion');
  });

  it('sets deletionRequestedAt to far past date to trigger immediate deletion pipeline', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession('staff-force'));
    const pastDeletion = new Date(Date.now() - 86400000 * 3);
    const chain = makeSelectChain([{
      id: 'user-force-del', deletionRequestedAt: pastDeletion,
    }]);
    mockDbSelect.mockReturnValue(chain);
    const insertChain = { values: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    mockDbInsert.mockReturnValue(insertChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    mockDbUpdate.mockReturnValue(updateChain);

    const { forceCompleteDeletion } = await import('../admin-data-retention');
    await forceCompleteDeletion({ userId: 'o8f2ncxpn5nfm0wzvova7k00' });

    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    const deletionDate = setArgs.deletionRequestedAt as Date;
    // Should be set to 2000-01-01 (far past)
    expect(deletionDate.getUTCFullYear()).toBe(2000);
  });
});

// ─── getDeletionQueue — PII masking logic ─────────────────────────────────────

describe('getDeletionQueue — PII masking', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); restoreMocks(); });

  it('masks email keeping first char and domain', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const pastDate = new Date(Date.now() - 86400000 * 10);
    const chain = makeSelectChain([{
      id: 'user-pii-1', name: 'Bob Jones', email: 'bob@example.com',
      deletionRequestedAt: pastDate,
    }]);
    mockDbSelect.mockReturnValue(chain);

    const { getDeletionQueue } = await import('../admin-data-retention');
    const result = await getDeletionQueue();
    expect(result.length).toBe(1);
    const entry = result[0]!;
    expect(entry.emailMasked).toBe('b***@example.com');
    expect(entry.name).toBe('B***');
  });

  it('calculates daysRemaining as 0 when deletion date has passed', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const longPastDate = new Date(Date.now() - 86400000 * 60);
    const chain = makeSelectChain([{
      id: 'user-overdue', name: 'Carol Smith', email: 'carol@test.org',
      deletionRequestedAt: longPastDate,
    }]);
    mockDbSelect.mockReturnValue(chain);

    const { getDeletionQueue } = await import('../admin-data-retention');
    const result = await getDeletionQueue();
    expect(result[0]!.daysRemaining).toBe(0);
  });

  it('calculates daysRemaining > 0 for recent deletion request', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const recentDate = new Date(Date.now() - 86400000 * 5);
    const chain = makeSelectChain([{
      id: 'user-recent', name: 'Dan Park', email: 'dan@domain.io',
      deletionRequestedAt: recentDate,
    }]);
    mockDbSelect.mockReturnValue(chain);

    const { getDeletionQueue } = await import('../admin-data-retention');
    const result = await getDeletionQueue();
    expect(result[0]!.daysRemaining).toBeGreaterThan(0);
    expect(result[0]!.daysRemaining).toBeLessThanOrEqual(25);
  });
});

// ─── getRetentionDashboard — policy count ─────────────────────────────────────

describe('getRetentionDashboard — policy entries', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); restoreMocks(); });

  it('returns 7 policy entries', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const { getRetentionDashboard } = await import('../admin-data-retention');
    const result = await getRetentionDashboard();
    expect(result.policies).toHaveLength(7);
  });

  it('policy entries include gdpr.deletionGracePeriodDays', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const { getRetentionDashboard } = await import('../admin-data-retention');
    const result = await getRetentionDashboard();
    const keys = result.policies.map((p) => p.key);
    expect(keys).toContain('gdpr.deletionGracePeriodDays');
    expect(keys).toContain('retention.messageDays');
    expect(keys).toContain('retention.auditLogDays');
  });
});
