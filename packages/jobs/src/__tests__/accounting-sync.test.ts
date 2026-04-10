import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

vi.mock('@twicely/db/schema', () => ({
  accountingIntegration: {
    id: 'id',
    status: 'status',
    syncFrequency: 'sync_frequency',
    userId: 'user_id',
    provider: 'provider',
    syncErrorCount: 'sync_error_count',
    lastSyncStatus: 'last_sync_status',
    updatedAt: 'updated_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback?: unknown) =>
    Promise.resolve(fallback),
  ),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'test-1' });
vi.mock('@twicely/jobs/queue', () => ({
  createQueue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  createWorker: vi.fn().mockReturnValue({ on: vi.fn(), close: vi.fn() }),
  connection: {},
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
}));

describe('accounting-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('returns zeroes when no integrations match frequency', async () => {
    const { processAccountingSync } = await import('../accounting-sync');
    const mockSync = vi.fn();
    const result = await processAccountingSync('HOURLY', mockSync);
    expect(result).toEqual({ synced: 0, failed: 0, disabled: 0 });
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('calls syncHandler for each matching integration', async () => {
    const integrations = [
      { id: 'int-1', userId: 'u-1', provider: 'QUICKBOOKS', syncErrorCount: 0 },
    ];

    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(integrations),
        }),
      }),
    });

    const mockSync = vi.fn().mockResolvedValue({
      success: true, logId: 'log-1', recordsSynced: 5, recordsFailed: 0,
    });

    const { processAccountingSync } = await import('../accounting-sync');
    const result = await processAccountingSync('HOURLY', mockSync);
    expect(result.synced).toBe(1);
    expect(mockSync).toHaveBeenCalledWith('int-1');
  });

  it('increments error count on sync failure', async () => {
    const integrations = [
      { id: 'int-1', userId: 'u-1', provider: 'XERO', syncErrorCount: 2 },
    ];

    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(integrations),
        }),
      }),
    });

    const mockSync = vi.fn().mockResolvedValue({
      success: false, logId: 'log-1', recordsSynced: 0, recordsFailed: 3,
    });

    const { processAccountingSync } = await import('../accounting-sync');
    const result = await processAccountingSync('DAILY', mockSync);
    expect(result.failed).toBe(1);
  });

  it('auto-disables integration after MAX_CONSECUTIVE_ERRORS', async () => {
    const integrations = [
      { id: 'int-1', userId: 'u-1', provider: 'QUICKBOOKS', syncErrorCount: 4 },
    ];

    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(integrations),
        }),
      }),
    });

    const mockSync = vi.fn().mockResolvedValue({
      success: false, logId: 'log-1', recordsSynced: 0, recordsFailed: 1,
    });

    const { processAccountingSync } = await import('../accounting-sync');
    const result = await processAccountingSync('HOURLY', mockSync);
    expect(result.disabled).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('registerAccountingSyncJobs registers hourly and daily cron jobs', async () => {
    const { registerAccountingSyncJobs } = await import('../accounting-sync');
    await registerAccountingSyncJobs();

    expect(mockQueueAdd).toHaveBeenCalledTimes(2);

    const hourlyCall = mockQueueAdd.mock.calls.find(
      (c: unknown[]) => c[0] === 'cron:accounting-sync-hourly',
    );
    expect(hourlyCall).toBeDefined();
    expect(hourlyCall![2]).toEqual(
      expect.objectContaining({
        jobId: 'cron-accounting-sync-hourly',
        repeat: { pattern: '0 * * * *', tz: 'UTC' },
      }),
    );

    const dailyCall = mockQueueAdd.mock.calls.find(
      (c: unknown[]) => c[0] === 'cron:accounting-sync-daily',
    );
    expect(dailyCall).toBeDefined();
    expect(dailyCall![2]).toEqual(
      expect.objectContaining({
        jobId: 'cron-accounting-sync-daily',
        repeat: { pattern: '0 2 * * *', tz: 'UTC' },
      }),
    );
  });

  it('reads batchSize from platform_settings', async () => {
    const { processAccountingSync } = await import('../accounting-sync');
    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');
    await processAccountingSync('HOURLY', vi.fn());
    expect(getPlatformSetting).toHaveBeenCalledWith('accounting.sync.batchSize', 50);
  });

  it('handles sync handler throwing an exception', async () => {
    const integrations = [
      { id: 'int-1', userId: 'u-1', provider: 'QUICKBOOKS', syncErrorCount: 0 },
    ];

    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(integrations),
        }),
      }),
    });

    const mockSync = vi.fn().mockRejectedValue(new Error('Network error'));

    const { processAccountingSync } = await import('../accounting-sync');
    const result = await processAccountingSync('HOURLY', mockSync);
    expect(result.failed).toBe(1);
    expect(result.synced).toBe(0);
  });
});
