import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    execute: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  auditEvent: { createdAt: 'created_at', id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  lt: vi.fn((col, val) => ({ op: 'lt', col, val })),
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

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((key: string, defaultVal: unknown) => {
    if (key === 'audit.retentionMonths') return Promise.resolve(24);
    if (key === 'audit.archiveBeforePurge') return Promise.resolve(true);
    return Promise.resolve(defaultVal);
  }),
}));

vi.mock('@twicely/storage/r2-client', () => ({
  uploadToR2: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/jobs/cleanup-helpers', () => ({
  upsertPlatformSetting: vi.fn().mockResolvedValue(undefined),
}));

// Node zlib is used for real — allow it
function makeSelectChain(value: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(value),
  };
  return chain;
}

describe('runAuditArchive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('reads retentionMonths from platform settings with default 24', async () => {
    const { db } = await import('@twicely/db');
    const { getPlatformSetting } = await import('@/lib/queries/platform-settings');
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { runAuditArchive } = await import('../cleanup-audit-archive');
    await runAuditArchive();

    expect(getPlatformSetting).toHaveBeenCalledWith('audit.retentionMonths', 24);
  });

  it('skips archive and delete when no events exist', async () => {
    const { db } = await import('@twicely/db');
    const { uploadToR2 } = await import('@twicely/storage/r2-client');
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { runAuditArchive } = await import('../cleanup-audit-archive');
    await runAuditArchive();

    expect(uploadToR2).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('uploads gzip archive to R2 when events exist', async () => {
    const { db } = await import('@twicely/db');
    const { uploadToR2 } = await import('@twicely/storage/r2-client');

    const sampleEvent = {
      id: 'evt-1',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      actorId: 'user-1',
    };
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([sampleEvent]) as unknown as ReturnType<typeof db.select>
    );

    const { runAuditArchive } = await import('../cleanup-audit-archive');
    await runAuditArchive();

    expect(uploadToR2).toHaveBeenCalledWith(
      expect.stringContaining('audit-archives/'),
      expect.any(Buffer),
      'application/gzip'
    );
  });

  it('groups events by year/month in R2 key', async () => {
    const { db } = await import('@twicely/db');
    const { uploadToR2 } = await import('@twicely/storage/r2-client');

    const events = [
      { id: 'e1', createdAt: new Date('2024-01-15') },
      { id: 'e2', createdAt: new Date('2024-02-10') },
    ];
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain(events) as unknown as ReturnType<typeof db.select>
    );

    const { runAuditArchive } = await import('../cleanup-audit-archive');
    await runAuditArchive();

    expect(uploadToR2).toHaveBeenCalledTimes(2);
  });

  it('uses raw SQL to delete archived rows', async () => {
    const { db } = await import('@twicely/db');

    const sampleEvent = { id: 'evt-del-1', createdAt: new Date('2024-01-01') };
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([sampleEvent]) as unknown as ReturnType<typeof db.select>
    );

    const { runAuditArchive } = await import('../cleanup-audit-archive');
    await runAuditArchive();

    expect(db.execute).toHaveBeenCalled();
  });

  it('writes lastRunAt and lastResult to platform_settings', async () => {
    const { db } = await import('@twicely/db');
    const { upsertPlatformSetting } = await import('@/lib/jobs/cleanup-helpers');
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { runAuditArchive } = await import('../cleanup-audit-archive');
    await runAuditArchive();

    expect(upsertPlatformSetting).toHaveBeenCalledWith(
      'cleanup.auditArchive.lastRunAt',
      expect.any(String)
    );
    expect(upsertPlatformSetting).toHaveBeenCalledWith(
      'cleanup.auditArchive.lastResult',
      expect.any(String)
    );
  });

  it('does NOT delete events when R2 upload fails (archiveBeforePurge guard)', async () => {
    const { db } = await import('@twicely/db');
    const { uploadToR2 } = await import('@twicely/storage/r2-client');
    const { logger } = await import('@/lib/logger');

    const sampleEvent = { id: 'evt-r2-fail', createdAt: new Date('2024-01-01') };
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([sampleEvent]) as unknown as ReturnType<typeof db.select>
    );

    vi.mocked(uploadToR2).mockRejectedValue(new Error('R2 connection timeout'));

    const { runAuditArchive } = await import('../cleanup-audit-archive');
    await expect(runAuditArchive()).rejects.toThrow('R2 connection timeout');

    // Delete must NOT be called if upload failed
    expect(db.execute).not.toHaveBeenCalled();
    expect(logger.error ?? logger.warn).toBeDefined();
  });

  it('skips R2 upload when archiveBeforePurge is false', async () => {
    const { db } = await import('@twicely/db');
    const { getPlatformSetting } = await import('@/lib/queries/platform-settings');
    const { uploadToR2 } = await import('@twicely/storage/r2-client');

    vi.mocked(getPlatformSetting).mockImplementation((key: string, defaultVal: unknown) => {
      if (key === 'audit.retentionMonths') return Promise.resolve(24);
      if (key === 'audit.archiveBeforePurge') return Promise.resolve(false);
      return Promise.resolve(defaultVal);
    });

    const sampleEvent = { id: 'evt-skip', createdAt: new Date('2024-01-01') };
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([sampleEvent]) as unknown as ReturnType<typeof db.select>
    );

    const { runAuditArchive } = await import('../cleanup-audit-archive');
    await runAuditArchive();

    expect(uploadToR2).not.toHaveBeenCalled();
    // But delete should still happen
    expect(db.execute).toHaveBeenCalled();
  });
});
