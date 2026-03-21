import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  crossJob: {
    id: 'id',
    projectionId: 'projection_id',
    status: 'status',
    completedAt: 'completed_at',
    updatedAt: 'updated_at',
    lastError: 'last_error',
  },
  channelProjection: {
    id: 'id',
    status: 'status',
    channel: 'channel',
    externalId: 'external_id',
    accountId: 'account_id',
    pollTier: 'poll_tier',
    lastPolledAt: 'last_polled_at',
    updatedAt: 'updated_at',
  },
  crosslisterAccount: {
    id: 'id',
  },
}));

vi.mock('../../queue/circuit-breaker', () => ({
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('../poll-tier-manager', () => ({
  promoteTier: vi.fn().mockResolvedValue(undefined),
  scheduleNextPoll: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { db } from '@twicely/db';
import { recordSuccess } from '../../queue/circuit-breaker';
import { scheduleNextPoll } from '../poll-tier-manager';
import { executePoll } from '../poll-executor';

const MOCK_JOB = {
  id: 'job-1',
  projectionId: 'proj-1',
  status: 'PENDING',
  sellerId: 'seller-1',
  accountId: 'acc-1',
};

const MOCK_PROJECTION = {
  id: 'proj-1',
  status: 'ACTIVE',
  channel: 'POSHMARK',
  externalId: 'ext-123',
  accountId: 'acc-1',
  pollTier: 'COLD',
};

const MOCK_ACCOUNT = {
  id: 'acc-1',
  channel: 'POSHMARK',
};

const makeSelectChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

const makeUpdateChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

describe('poll-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ERROR when cross job not found', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);

    const result = await executePoll('job-missing');

    expect(result).toEqual({ outcome: 'ERROR', error: 'Cross job not found', retryable: false });
  });

  it('returns ERROR when job has no projectionId', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ ...MOCK_JOB, projectionId: null }]) as never
    );

    const result = await executePoll('job-1');

    expect(result).toEqual({ outcome: 'ERROR', error: 'No projection ID on job', retryable: false });
  });

  it('returns ERROR when projection not found', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([MOCK_JOB]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await executePoll('job-1');

    expect(result).toEqual({ outcome: 'ERROR', error: 'Projection not found', retryable: false });
    expect(db.update).toHaveBeenCalledTimes(1); // markJobFailed
  });

  it('returns NO_CHANGE and marks job completed when projection is not ACTIVE', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([MOCK_JOB]) as never)
      .mockReturnValueOnce(makeSelectChain([{ ...MOCK_PROJECTION, status: 'PAUSED' }]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await executePoll('job-1');

    expect(result).toEqual({ outcome: 'NO_CHANGE' });
    expect(db.update).toHaveBeenCalledTimes(1); // markJobCompleted
  });

  it('returns ERROR when projection has no externalId', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([MOCK_JOB]) as never)
      .mockReturnValueOnce(makeSelectChain([{ ...MOCK_PROJECTION, externalId: null }]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await executePoll('job-1');

    expect(result).toEqual({ outcome: 'ERROR', error: 'No external ID', retryable: false });
  });

  it('returns ERROR when account not found', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([MOCK_JOB]) as never)
      .mockReturnValueOnce(makeSelectChain([MOCK_PROJECTION]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await executePoll('job-1');

    expect(result).toEqual({ outcome: 'ERROR', error: 'Account not found', retryable: false });
  });

  it('returns NO_CHANGE and updates lastPolledAt on successful poll', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([MOCK_JOB]) as never)
      .mockReturnValueOnce(makeSelectChain([MOCK_PROJECTION]) as never)
      .mockReturnValueOnce(makeSelectChain([MOCK_ACCOUNT]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await executePoll('job-1');

    expect(result).toEqual({ outcome: 'NO_CHANGE' });
    expect(db.update).toHaveBeenCalledTimes(2); // lastPolledAt + markJobCompleted
  });

  it('calls recordSuccess on successful poll', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([MOCK_JOB]) as never)
      .mockReturnValueOnce(makeSelectChain([MOCK_PROJECTION]) as never)
      .mockReturnValueOnce(makeSelectChain([MOCK_ACCOUNT]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    await executePoll('job-1');

    expect(recordSuccess).toHaveBeenCalledWith('POSHMARK');
  });

  it('calls scheduleNextPoll with current tier on success', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([MOCK_JOB]) as never)
      .mockReturnValueOnce(makeSelectChain([MOCK_PROJECTION]) as never)
      .mockReturnValueOnce(makeSelectChain([MOCK_ACCOUNT]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    await executePoll('job-1');

    expect(scheduleNextPoll).toHaveBeenCalledWith('proj-1', 'COLD');
  });

  it('calls recordFailure on unhandled exception', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('DB crashed')),
          }),
        }),
      } as never)
      .mockReturnValueOnce(makeSelectChain([{ projectionId: 'proj-1' }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ channel: 'POSHMARK' }]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await executePoll('job-1');

    expect(result.outcome).toBe('ERROR');
    expect((result as { outcome: 'ERROR'; error: string; retryable: boolean }).retryable).toBe(true);
  });

  it('marks job FAILED with error message on exception', async () => {
    const updateChain = makeUpdateChain();
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([MOCK_JOB]) as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Projection query failed')),
          }),
        }),
      } as never)
      .mockReturnValueOnce(makeSelectChain([{ projectionId: 'proj-1' }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ channel: 'POSHMARK' }]) as never);
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await executePoll('job-1');

    const firstCall = updateChain.set.mock.calls[0];
    expect(firstCall).toBeDefined();
    const setCall = firstCall![0] as Record<string, unknown>;
    expect(setCall.status).toBe('FAILED');
    expect(typeof setCall.lastError).toBe('string');
  });
});
