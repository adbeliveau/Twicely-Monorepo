/**
 * Poll executor edge cases — connector errors, non-retryable paths.
 * Split from poll-executor.test.ts to keep each file under 250 lines.
 */

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
import { recordFailure } from '../../queue/circuit-breaker';
import { executePoll } from '../poll-executor';

const MOCK_JOB = {
  id: 'job-edge-1',
  projectionId: 'proj-edge-1',
  status: 'PENDING',
  sellerId: 'seller-edge-1',
  accountId: 'acc-edge-1',
};

const MOCK_PROJECTION = {
  id: 'proj-edge-1',
  status: 'ACTIVE',
  channel: 'POSHMARK',
  externalId: 'ext-123',
  accountId: 'acc-edge-1',
  pollTier: 'COLD',
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

describe('poll-executor — edge cases (connector errors, non-retryable paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('missing connector → account fetch throws → returns ERROR gracefully (retryable: true)', async () => {
    // Simulate account query throwing — mimics connector registry failure path
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([MOCK_JOB]) as never)
      .mockReturnValueOnce(makeSelectChain([MOCK_PROJECTION]) as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(
              new Error('No connector registered for channel: POSHMARK'),
            ),
          }),
        }),
      } as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await executePoll('job-edge-1');

    expect(result.outcome).toBe('ERROR');
    expect((result as { outcome: 'ERROR'; error: string; retryable: boolean }).retryable).toBe(true);
    expect((result as { outcome: 'ERROR'; error: string; retryable: boolean }).error).toContain(
      'No connector registered',
    );
  });

  it('non-retryable error path: projection not found → markJobFailed, no recordFailure', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([MOCK_JOB]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never); // no projection
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await executePoll('job-edge-1');

    expect(result).toEqual({ outcome: 'ERROR', error: 'Projection not found', retryable: false });
    // Non-retryable errors do NOT go through the catch block — no recordFailure call
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('circuit breaker: connector error in catch block calls recordFailure', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('DB timeout')),
          }),
        }),
      } as never)
      // Recovery queries in catch block
      .mockReturnValueOnce(makeSelectChain([{ projectionId: 'proj-edge-1' }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ channel: 'POSHMARK' }]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    await executePoll('job-edge-1');

    expect(recordFailure).toHaveBeenCalledWith('POSHMARK');
  });
});
