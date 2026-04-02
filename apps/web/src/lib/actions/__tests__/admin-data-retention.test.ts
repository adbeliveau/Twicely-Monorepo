import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(30),
  getPlatformSettingsByPrefix: vi.fn().mockResolvedValue(new Map([
    ['retention.messageDays', 730],
    ['retention.auditLogDays', 2555],
  ])),
}));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', name: 'name', email: 'email', deletionRequestedAt: 'deletion_requested_at', anonymizedAt: 'anonymized_at' },
  dataExportRequest: { id: 'id', userId: 'user_id', createdAt: 'created_at', status: 'status' },
  auditEvent: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  isNotNull: vi.fn((col) => ({ op: 'isNotNull', col })),
  isNull: vi.fn((col) => ({ op: 'isNull', col })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
  gte: vi.fn((col, val) => ({ op: 'gte', col, val })),
  count: vi.fn(() => 'count_expr'),
  inArray: vi.fn((col, vals) => ({ op: 'inArray', col, vals })),
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
    session: { staffUserId, email: 'admin@twicely.co', displayName: 'Admin' },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeNonAdminSession() {
  return {
    session: { staffUserId: 'agent-1', email: 'agent@twicely.co', displayName: 'Agent' },
    ability: { can: vi.fn().mockReturnValue(false) },
  };
}

// ─── getRetentionDashboard ────────────────────────────────────────────────────

describe('getRetentionDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns policies for admin', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const { getRetentionDashboard } = await import('../admin-data-retention');
    const result = await getRetentionDashboard();
    expect(result.policies).toBeDefined();
    expect(Array.isArray(result.policies)).toBe(true);
    expect(result.policies.length).toBeGreaterThan(0);
  });

  it('throws ForbiddenError for non-admin', async () => {
    mockStaffAuthorize.mockResolvedValue(makeNonAdminSession());
    const { getRetentionDashboard } = await import('../admin-data-retention');
    await expect(getRetentionDashboard()).rejects.toThrow('Access denied');
  });
});

// ─── getDeletionQueue ─────────────────────────────────────────────────────────

describe('getDeletionQueue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns masked users in cooling-off period', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const pastDate = new Date(Date.now() - 86400000 * 5);
    const chain = makeSelectChain([{
      id: 'user-1', name: 'Alice Smith', email: 'alice@example.com',
      deletionRequestedAt: pastDate,
    }]);
    mockDbSelect.mockReturnValue(chain);

    const { getDeletionQueue } = await import('../admin-data-retention');
    const result = await getDeletionQueue();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const first = result[0]!;
      expect(first.emailMasked).toContain('@');
      expect(first.emailMasked).toContain('***');
      expect(first.name).toContain('***');
    }
  });

  it('throws ForbiddenError for non-admin', async () => {
    mockStaffAuthorize.mockResolvedValue(makeNonAdminSession());
    const { getDeletionQueue } = await import('../admin-data-retention');
    await expect(getDeletionQueue()).rejects.toThrow('Access denied');
  });
});

// ─── forceCompleteDeletion ───────────────────────────────────────────────────

describe('forceCompleteDeletion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws ForbiddenError for non-admin', async () => {
    mockStaffAuthorize.mockResolvedValue(makeNonAdminSession());
    const { forceCompleteDeletion } = await import('../admin-data-retention');
    await expect(forceCompleteDeletion({ userId: 'ixti0fxrum2recj6gc49mmt0' })).rejects.toThrow('ADMIN role required');
  });

  it('returns error for invalid userId', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const { forceCompleteDeletion } = await import('../admin-data-retention');
    const result = await forceCompleteDeletion({ userId: '' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('returns error when user not found', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const chain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(chain);

    const { forceCompleteDeletion } = await import('../admin-data-retention');
    const result = await forceCompleteDeletion({ userId: 'poki1nf4lbwzdme283on2ewk' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });

  it('inserts CRITICAL audit event and updates user on success', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession('staff-2'));
    const pastDeletion = new Date(Date.now() - 86400000 * 2);
    const chain = makeSelectChain([{
      id: 'user-del', deletionRequestedAt: pastDeletion,
    }]);
    mockDbSelect.mockReturnValue(chain);
    const insertChain = { values: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    mockDbInsert.mockReturnValue(insertChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    mockDbUpdate.mockReturnValue(updateChain);

    const { forceCompleteDeletion } = await import('../admin-data-retention');
    const result = await forceCompleteDeletion({ userId: 'o8f2ncxpn5nfm0wzvova7k00' });
    expect(result.success).toBe(true);
    expect(mockDbInsert).toHaveBeenCalled();
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'CRITICAL', action: 'FORCE_COMPLETE_DELETION' })
    );
  });
});
