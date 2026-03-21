import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  localReliabilityEvent: {
    id: 'id',
    userId: 'user_id',
    transactionId: 'transaction_id',
    eventType: 'event_type',
    marksApplied: 'marks_applied',
    decaysAt: 'decays_at',
    createdAt: 'created_at',
  },
  localTransaction: {
    id: 'id',
    buyerId: 'buyer_id',
    sellerId: 'seller_id',
    status: 'status',
  },
  user: {
    id: 'id',
    localReliabilityMarks: 'local_reliability_marks',
    localTransactionCount: 'local_transaction_count',
    localCompletionRate: 'local_completion_rate',
    localSuspendedUntil: 'local_suspended_until',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation(
    (_key: string, fallback: unknown) => Promise.resolve(fallback),
  ),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { db } from '@twicely/db';
import {
  recalculateReliabilityMarks,
  isUserSuspendedFromLocal,
  getReliabilityDisplay,
  getReliabilityEvents,
} from '../local-reliability';

function makeDirect(rows: unknown[]) {
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) }) };
}

function makeUpdate() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

// ─── Chain Helpers ────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'cuserid0001abc';
const FUTURE = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);

// ─── recalculateReliabilityMarks ──────────────────────────────────────────────

describe('recalculateReliabilityMarks', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sums only non-decayed events (decaysAt > now)', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeDirect([{ total: '-6' }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ localSuspendedUntil: null }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '0' }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '0' }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '0' }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '0' }]) as never);
    const upd = makeUpdate();
    vi.mocked(db.update).mockReturnValue(upd as never);
    await recalculateReliabilityMarks(USER_ID);
    const set = upd.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(set.localReliabilityMarks).toBe(6);
  });

  it('ignores decayed events — result is 0 when all decayed', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeDirect([{ total: null }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ localSuspendedUntil: null }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '0' }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '0' }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '0' }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '0' }]) as never);
    const upd = makeUpdate();
    vi.mocked(db.update).mockReturnValue(upd as never);
    await recalculateReliabilityMarks(USER_ID);
    const set = upd.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(set.localReliabilityMarks).toBe(0);
  });

  it('updates localTransactionCount and localCompletionRate', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeDirect([{ total: '0' }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ localSuspendedUntil: null }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '4' }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '6' }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '3' }]) as never)
      .mockReturnValueOnce(makeDirect([{ total: '4' }]) as never);
    const upd = makeUpdate();
    vi.mocked(db.update).mockReturnValue(upd as never);
    await recalculateReliabilityMarks(USER_ID);
    const set = upd.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(set.localTransactionCount).toBe(10);
    expect(set.localCompletionRate).toBeCloseTo(0.7);
  });
});

// ─── isUserSuspendedFromLocal ─────────────────────────────────────────────────

describe('isUserSuspendedFromLocal', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns suspended: false when localSuspendedUntil is null', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ localSuspendedUntil: null }]) as never,
    );

    const result = await isUserSuspendedFromLocal(USER_ID);

    expect(result.suspended).toBe(false);
    expect(result.resumesAt).toBeUndefined();
  });

  it('returns suspended: false when localSuspendedUntil is in the past', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ localSuspendedUntil: PAST }]) as never,
    );

    const result = await isUserSuspendedFromLocal(USER_ID);

    expect(result.suspended).toBe(false);
    expect(result.resumesAt).toBeUndefined();
  });

  it('returns suspended: true with resumesAt when localSuspendedUntil is in the future', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ localSuspendedUntil: FUTURE }]) as never,
    );

    const result = await isUserSuspendedFromLocal(USER_ID);

    expect(result.suspended).toBe(true);
    expect(result.resumesAt).toEqual(FUTURE);
  });

  it('returns suspended: false when user row not found', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([]) as never,
    );

    const result = await isUserSuspendedFromLocal(USER_ID);

    expect(result.suspended).toBe(false);
  });
});

// ─── getReliabilityDisplay ────────────────────────────────────────────────────

describe('getReliabilityDisplay', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns RELIABLE when marks < 3', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{
        localReliabilityMarks: 2,
        localTransactionCount: 10,
        localCompletionRate: 0.9,
        localSuspendedUntil: null,
      }]) as never,
    );

    const result = await getReliabilityDisplay(USER_ID);

    expect(result.tier).toBe('RELIABLE');
    expect(result.isSuspended).toBe(false);
  });

  it('returns INCONSISTENT when marks >= 3 and < 9', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{
        localReliabilityMarks: 5,
        localTransactionCount: 8,
        localCompletionRate: 0.75,
        localSuspendedUntil: null,
      }]) as never,
    );

    const result = await getReliabilityDisplay(USER_ID);

    expect(result.tier).toBe('INCONSISTENT');
  });

  it('returns UNRELIABLE when marks >= 9', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{
        localReliabilityMarks: 9,
        localTransactionCount: 5,
        localCompletionRate: 0.4,
        localSuspendedUntil: FUTURE,
      }]) as never,
    );

    const result = await getReliabilityDisplay(USER_ID);

    expect(result.tier).toBe('UNRELIABLE');
  });

  it('returns isSuspended: true when localSuspendedUntil > now', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{
        localReliabilityMarks: 9,
        localTransactionCount: 5,
        localCompletionRate: 0.4,
        localSuspendedUntil: FUTURE,
      }]) as never,
    );

    const result = await getReliabilityDisplay(USER_ID);

    expect(result.isSuspended).toBe(true);
    expect(result.suspendedUntil).toEqual(FUTURE);
  });

  it('returns completedCount and completionRate from user fields', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{
        localReliabilityMarks: 0,
        localTransactionCount: 20,
        localCompletionRate: 0.85,
        localSuspendedUntil: null,
      }]) as never,
    );

    const result = await getReliabilityDisplay(USER_ID);

    expect(result.completedCount).toBe(20);
    expect(result.completionRate).toBe(0.85);
  });

});

// ─── getReliabilityEvents ─────────────────────────────────────────────────────

describe('getReliabilityEvents', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns events ordered by createdAt DESC', async () => {
    const events = [
      { id: 'e2', userId: USER_ID, createdAt: new Date('2026-03-10') },
      { id: 'e1', userId: USER_ID, createdAt: new Date('2026-03-01') },
    ];
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(events) }),
      }),
    } as never);
    expect(await getReliabilityEvents(USER_ID)).toEqual(events);
  });

  it('respects limit parameter', async () => {
    const events = [{ id: 'e1', userId: USER_ID, createdAt: new Date() }];
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(events) }),
        }),
      }),
    } as never);
    expect(await getReliabilityEvents(USER_ID, 1)).toEqual(events);
  });
});
