import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
});

vi.mock('@twicely/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

vi.mock('@twicely/db/schema', () => ({
  authenticationRequest: {
    id: 'id',
    status: 'status',
    createdAt: 'created_at',
    listingId: 'listing_id',
    sellerId: 'seller_id',
  },
  listing: { id: 'id', authenticationStatus: 'authentication_status', updatedAt: 'updated_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  lt: vi.fn(),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(24),
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

describe('ai-auth-timeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when no stale requests exist', async () => {
    const { processAiAuthTimeout } = await import('../ai-auth-timeout');
    const count = await processAiAuthTimeout();
    expect(count).toBe(0);
  });

  it('reads aiMaxTurnaroundHours from platform_settings', async () => {
    const { processAiAuthTimeout } = await import('../ai-auth-timeout');
    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');
    await processAiAuthTimeout();
    expect(getPlatformSetting).toHaveBeenCalledWith('trust.authentication.aiMaxTurnaroundHours', 24);
  });

  it('processes stale AI_PENDING requests and returns count', async () => {
    const staleRequests = [
      { id: 'req-1', listingId: 'lst-1', sellerId: 'user-1' },
      { id: 'req-2', listingId: 'lst-2', sellerId: 'user-2' },
    ];

    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(staleRequests),
      }),
    });

    const { processAiAuthTimeout } = await import('../ai-auth-timeout');
    const count = await processAiAuthTimeout();
    expect(count).toBe(2);
  });

  it('registerAiAuthTimeoutJob adds a repeating cron job', async () => {
    const { registerAiAuthTimeoutJob } = await import('../ai-auth-timeout');
    await registerAiAuthTimeoutJob();

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'cron:ai-auth-timeout',
      expect.objectContaining({ triggeredAt: expect.any(String) }),
      expect.objectContaining({
        jobId: 'cron-ai-auth-timeout',
        repeat: { pattern: '0 * * * *', tz: 'UTC' },
      }),
    );
  });
});
