import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', deletionRequestedAt: 'deletion_requested_at', anonymizedAt: 'anonymized_at' },
  dataExportRequest: {
    id: 'id',
    status: 'status',
    completedAt: 'completed_at',
    createdAt: 'created_at',
  },
  auditEvent: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  gte: vi.fn((col, val) => ({ op: 'gte', col, val })),
  isNotNull: vi.fn((col) => ({ op: 'isNotNull', col })),
  isNull: vi.fn((col) => ({ op: 'isNull', col })),
  inArray: vi.fn((col, arr) => ({ op: 'inArray', col, arr })),
  count: vi.fn(() => ({ type: 'count' })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: 'sql',
      strings,
      values,
    })),
    {
      join: vi.fn(() => ({ type: 'sql-join' })),
      raw: vi.fn((s: string) => ({ type: 'sql-raw', s })),
    }
  ),
}));

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSettingsByPrefix: vi.fn().mockResolvedValue(new Map()),
  getPlatformSetting: vi.fn().mockResolvedValue(30),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeAuthorizedAbility() {
  return {
    session: { staffUserId: 'staff-1' },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeSelectChain(value: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(value),
  };
  // Allow .from().where() to resolve directly too
  chain.where.mockReturnValue({
    ...chain,
    then: (resolve: (v: unknown) => void) => resolve(value),
    [Symbol.toStringTag]: 'Promise',
  });
  return chain;
}

describe('getGdprComplianceSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns correct summary shape with counts', async () => {
    const { staffAuthorize } = await import('@/lib/casl/staff-authorize');
    const { db } = await import('@/lib/db');

    vi.mocked(staffAuthorize).mockResolvedValue(makeAuthorizedAbility() as unknown as Awaited<ReturnType<typeof staffAuthorize>>);
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ c: 5 }]) as unknown as ReturnType<typeof db.select>);

    const { getGdprComplianceSummary } = await import('../admin-data-retention');
    const result = await getGdprComplianceSummary();

    expect(result).toHaveProperty('activeDeletionRequests');
    expect(result).toHaveProperty('pendingDataExports');
    expect(result).toHaveProperty('completedExportsLast30Days');
    expect(result).toHaveProperty('failedExportsRequiringAttention');
  });

  it('throws ForbiddenError when ability.can returns false', async () => {
    const { staffAuthorize } = await import('@/lib/casl/staff-authorize');

    vi.mocked(staffAuthorize).mockResolvedValue({
      session: { staffUserId: 'staff-2' },
      ability: { can: vi.fn().mockReturnValue(false) },
    } as unknown as Awaited<ReturnType<typeof staffAuthorize>>);

    const { getGdprComplianceSummary } = await import('../admin-data-retention');
    await expect(getGdprComplianceSummary()).rejects.toThrow('Access denied');
  });
});

describe('getGdprComplianceSummary — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns zero counts when no deletions or exports exist', async () => {
    const { staffAuthorize } = await import('@/lib/casl/staff-authorize');
    const { db } = await import('@/lib/db');

    vi.mocked(staffAuthorize).mockResolvedValue({
      session: { staffUserId: 'staff-3' },
      ability: { can: vi.fn().mockReturnValue(true) },
    } as unknown as Awaited<ReturnType<typeof staffAuthorize>>);

    // All count queries return 0
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ c: 0 }]) as unknown as ReturnType<typeof db.select>);

    const { getGdprComplianceSummary } = await import('../admin-data-retention');
    const result = await getGdprComplianceSummary();

    expect(result.activeDeletionRequests).toBe(0);
    expect(result.pendingDataExports).toBe(0);
    expect(result.completedExportsLast30Days).toBe(0);
    expect(result.failedExportsRequiringAttention).toBe(0);
  });
});

describe('getRetentionJobStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns status for all 4 cleanup jobs', async () => {
    const { staffAuthorize } = await import('@/lib/casl/staff-authorize');
    const { getPlatformSettingsByPrefix } = await import('@/lib/queries/platform-settings');

    vi.mocked(staffAuthorize).mockResolvedValue(makeAuthorizedAbility() as unknown as Awaited<ReturnType<typeof staffAuthorize>>);

    const settingsMap = new Map<string, unknown>([
      ['cleanup.sessionCleanup.lastRunAt', '2026-03-15T04:00:00Z'],
      ['cleanup.sessionCleanup.lastResult', 'Purged 42 expired sessions'],
      ['cleanup.auditArchive.lastRunAt', '2026-03-01T03:00:00Z'],
      ['cleanup.auditArchive.lastResult', 'Archived 1200 events'],
      ['cleanup.dataPurge.lastRunAt', '2026-03-15T04:30:00Z'],
      ['cleanup.dataPurge.lastResult', 'search_log:0, webhook_log:0'],
      ['cleanup.accountDeletion.lastRunAt', '2026-03-15T04:00:00Z'],
      ['cleanup.accountDeletion.lastResult', 'Processed 0 deletions'],
    ]);
    vi.mocked(getPlatformSettingsByPrefix).mockResolvedValue(settingsMap);

    const { getRetentionJobStatus } = await import('../admin-data-retention');
    const result = await getRetentionJobStatus();

    expect(result.sessionCleanup.lastRunAt).toBe('2026-03-15T04:00:00Z');
    expect(result.auditArchive.lastResult).toBe('Archived 1200 events');
    expect(result.dataPurge.lastRunAt).toBe('2026-03-15T04:30:00Z');
    expect(result.accountDeletion.lastRunAt).toBe('2026-03-15T04:00:00Z');
  });

  it('returns null for jobs that have never run', async () => {
    const { staffAuthorize } = await import('@/lib/casl/staff-authorize');
    const { getPlatformSettingsByPrefix } = await import('@/lib/queries/platform-settings');

    vi.mocked(staffAuthorize).mockResolvedValue(makeAuthorizedAbility() as unknown as Awaited<ReturnType<typeof staffAuthorize>>);
    vi.mocked(getPlatformSettingsByPrefix).mockResolvedValue(new Map());

    const { getRetentionJobStatus } = await import('../admin-data-retention');
    const result = await getRetentionJobStatus();

    expect(result.sessionCleanup.lastRunAt).toBeNull();
    expect(result.sessionCleanup.lastResult).toBeNull();
    expect(result.auditArchive.lastRunAt).toBeNull();
    expect(result.dataPurge.lastRunAt).toBeNull();
    expect(result.accountDeletion.lastRunAt).toBeNull();
  });
});
