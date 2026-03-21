import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localReliabilityEvent: { userId: 'user_id', marksApplied: 'marks_applied', decaysAt: 'decays_at' },
  localTransaction: { buyerId: 'buyer_id', sellerId: 'seller_id', status: 'status' },
  user: {
    id: 'id',
    localSuspendedUntil: 'local_suspended_until',
    localFraudBannedAt: 'local_fraud_banned_at',
    localReliabilityMarks: 'local_reliability_marks',
    localTransactionCount: 'local_transaction_count',
    localCompletionRate: 'local_completion_rate',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(9),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { db } from '@twicely/db';
import { isUserSuspendedFromLocal } from '../local-reliability';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'usr-001';

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

const mockDbSelect = vi.mocked(db.select);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('isUserSuspendedFromLocal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns fraud_ban when localFraudBannedAt is set', async () => {
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{
        localSuspendedUntil: null,
        localFraudBannedAt: new Date('2026-01-01'),
      }]) as never,
    );

    const result = await isUserSuspendedFromLocal(USER_ID);

    expect(result.suspended).toBe(true);
    expect(result.reason).toBe('fraud_ban');
    expect(result.resumesAt).toBeUndefined();
  });

  it('returns reliability suspension when localSuspendedUntil is in future', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{
        localSuspendedUntil: futureDate,
        localFraudBannedAt: null,
      }]) as never,
    );

    const result = await isUserSuspendedFromLocal(USER_ID);

    expect(result.suspended).toBe(true);
    expect(result.reason).toBe('reliability');
    expect(result.resumesAt).toEqual(futureDate);
  });

  it('returns not suspended when neither flag is set', async () => {
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{
        localSuspendedUntil: null,
        localFraudBannedAt: null,
      }]) as never,
    );

    const result = await isUserSuspendedFromLocal(USER_ID);

    expect(result.suspended).toBe(false);
  });

  it('returns not suspended when localSuspendedUntil is in the past', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{
        localSuspendedUntil: pastDate,
        localFraudBannedAt: null,
      }]) as never,
    );

    const result = await isUserSuspendedFromLocal(USER_ID);

    expect(result.suspended).toBe(false);
  });

  it('prioritizes fraud_ban over reliability suspension', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{
        localSuspendedUntil: futureDate,
        localFraudBannedAt: new Date('2026-01-01'),
      }]) as never,
    );

    const result = await isUserSuspendedFromLocal(USER_ID);

    expect(result.suspended).toBe(true);
    expect(result.reason).toBe('fraud_ban');
  });
});
