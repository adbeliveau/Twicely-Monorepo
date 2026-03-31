import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    delete: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  session: { expiresAt: 'expires_at' },
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  lt: vi.fn((col, val) => ({ op: 'lt', col, val })),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/jobs/cleanup-helpers', () => ({
  upsertPlatformSetting: vi.fn().mockResolvedValue(undefined),
}));

function makeDeleteChain(count: number) {
  return { where: vi.fn().mockResolvedValue({ count }) };
}

describe('runSessionCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('deletes expired sessions from the session table', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain(8) as unknown as ReturnType<typeof db.delete>);

    const { runSessionCleanup } = await import('../cleanup-session');
    await runSessionCleanup();

    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it('returns count of purged sessions', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain(12) as unknown as ReturnType<typeof db.delete>);

    const { runSessionCleanup } = await import('../cleanup-session');
    const count = await runSessionCleanup();

    expect(count).toBe(12);
  });

  it('returns 0 when no expired sessions', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain(0) as unknown as ReturnType<typeof db.delete>);

    const { runSessionCleanup } = await import('../cleanup-session');
    const count = await runSessionCleanup();

    expect(count).toBe(0);
  });

  it('writes lastRunAt and lastResult to platform_settings', async () => {
    const { db } = await import('@twicely/db');
    const { upsertPlatformSetting } = await import('@twicely/jobs/cleanup-helpers');
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain(3) as unknown as ReturnType<typeof db.delete>);

    const { runSessionCleanup } = await import('../cleanup-session');
    await runSessionCleanup();

    expect(upsertPlatformSetting).toHaveBeenCalledWith(
      'cleanup.sessionCleanup.lastRunAt',
      expect.any(String)
    );
    expect(upsertPlatformSetting).toHaveBeenCalledWith(
      'cleanup.sessionCleanup.lastResult',
      expect.stringContaining('3')
    );
  });

  it('logs purge count', async () => {
    const { db } = await import('@twicely/db');
    const { logger } = await import('@twicely/logger');
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain(5) as unknown as ReturnType<typeof db.delete>);

    const { runSessionCleanup } = await import('../cleanup-session');
    await runSessionCleanup();

    expect(logger.info).toHaveBeenCalledWith(
      '[sessionCleanup] Purged expired sessions',
      expect.objectContaining({ count: 5 })
    );
  });
});
