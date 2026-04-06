import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  dataExportRequest: {
    id: 'id',
    downloadUrl: 'download_url',
    status: 'status',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ op: 'and', args })),
  lt: vi.fn((col, val) => ({ op: 'lt', col, val })),
  inArray: vi.fn((col, arr) => ({ op: 'inArray', col, arr })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: 'sql',
      strings,
      values,
    })),
    {
      identifier: vi.fn((s: string) => ({ type: 'identifier', s })),
      join: vi.fn(() => ({ type: 'sql-join' })),
      raw: vi.fn((s: string) => ({ type: 'sql-raw', s })),
    }
  ),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, defaultVal: unknown) =>
    Promise.resolve(defaultVal)
  ),
}));

vi.mock('@twicely/storage/r2-client', () => ({
  deleteFromR2: vi.fn().mockResolvedValue(undefined),
  extractKeyFromUrl: vi.fn((url: string) => url ? `exports/${url.split('/').pop()}` : null),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@twicely/jobs/cleanup-helpers', () => ({
  upsertPlatformSetting: vi.fn().mockResolvedValue(undefined),
}));

function makeSelectChain(value: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(value),
  };
  return chain;
}

function makeDeleteChain() {
  return { where: vi.fn().mockResolvedValue({ count: 1 }) };
}

describe('runDataPurge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('reads retention settings from platform_settings', async () => {
    const { db } = await import('@/lib/db');
    const { getPlatformSetting } = await import('@/lib/queries/platform-settings');

    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);

    const { runDataPurge } = await import('../cleanup-data-purge');
    await runDataPurge();

    expect(getPlatformSetting).toHaveBeenCalledWith('privacy.retention.searchLogDays', 90);
    expect(getPlatformSetting).toHaveBeenCalledWith('privacy.retention.webhookLogDays', 90);
    expect(getPlatformSetting).toHaveBeenCalledWith('privacy.retention.analyticsEventDays', 365);
    expect(getPlatformSetting).toHaveBeenCalledWith('privacy.retention.notificationLogDays', 180);
  });

  it('gracefully skips tables that do not exist', async () => {
    const { db } = await import('@/lib/db');
    const { logger } = await import('@/lib/logger');

    vi.mocked(db.execute).mockRejectedValue(new Error('relation "search_log" does not exist'));
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);

    const { runDataPurge } = await import('../cleanup-data-purge');
    await expect(runDataPurge()).resolves.not.toThrow();

    expect(logger.debug).toHaveBeenCalledWith(
      '[dataPurge] Table not yet created, skipping',
      expect.objectContaining({ tableName: 'search_log' })
    );
  });

  it('purges expired data export requests', async () => {
    const { db } = await import('@/lib/db');

    vi.mocked(db.execute).mockResolvedValue({ count: 0, rows: [] } as unknown as Awaited<ReturnType<typeof db.execute>>);

    const expiredExport = { id: 'exp-1', downloadUrl: 'https://r2.example.com/exports/file.zip' };
    vi.mocked(db.select).mockReturnValue(makeSelectChain([expiredExport]) as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);

    const { runDataPurge } = await import('../cleanup-data-purge');
    await runDataPurge();

    expect(db.delete).toHaveBeenCalled();
  });

  it('deletes R2 files for expired exports that have a downloadUrl', async () => {
    const { db } = await import('@/lib/db');
    const { deleteFromR2 } = await import('@/lib/storage/r2-client');

    vi.mocked(db.execute).mockResolvedValue({ count: 0, rows: [] } as unknown as Awaited<ReturnType<typeof db.execute>>);

    const expiredExport = { id: 'exp-2', downloadUrl: 'https://r2.example.com/exports/data.zip' };
    vi.mocked(db.select).mockReturnValue(makeSelectChain([expiredExport]) as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);

    const { runDataPurge } = await import('../cleanup-data-purge');
    await runDataPurge();

    expect(deleteFromR2).toHaveBeenCalled();
  });

  it('writes lastRunAt and lastResult to platform_settings', async () => {
    const { db } = await import('@/lib/db');
    const { upsertPlatformSetting } = await import('@/lib/jobs/cleanup-helpers');

    vi.mocked(db.execute).mockResolvedValue({ count: 0, rows: [] } as unknown as Awaited<ReturnType<typeof db.execute>>);
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);

    const { runDataPurge } = await import('../cleanup-data-purge');
    await runDataPurge();

    expect(upsertPlatformSetting).toHaveBeenCalledWith(
      'cleanup.dataPurge.lastRunAt',
      expect.any(String)
    );
    expect(upsertPlatformSetting).toHaveBeenCalledWith(
      'cleanup.dataPurge.lastResult',
      expect.any(String)
    );
  });

  it('does not throw when no expired exports exist', async () => {
    const { db } = await import('@/lib/db');

    vi.mocked(db.execute).mockResolvedValue({ count: 5, rows: [] } as unknown as Awaited<ReturnType<typeof db.execute>>);
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { runDataPurge } = await import('../cleanup-data-purge');
    await expect(runDataPurge()).resolves.not.toThrow();
  });
});
