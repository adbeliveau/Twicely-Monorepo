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
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { postReliabilityMark, recalculateReliabilityMarks } from '../local-reliability';

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

function makeSelectChainDirect(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'cuserid0001abc';
const TX_ID = 'ctxid00000001a';
const FUTURE = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
const NOW = new Date();

// Shared mock sequence: marks sum + user row + 4 tx count queries
function setupRecalcMocks(marksTotal: string | null, suspendedUntil: Date | null) {
  vi.mocked(db.select)
    .mockReturnValueOnce(makeSelectChainDirect([{ total: marksTotal }]) as never)
    .mockReturnValueOnce(makeSelectChain([{ localSuspendedUntil: suspendedUntil }]) as never)
    .mockReturnValueOnce(makeSelectChainDirect([{ total: '0' }]) as never)
    .mockReturnValueOnce(makeSelectChainDirect([{ total: '0' }]) as never)
    .mockReturnValueOnce(makeSelectChainDirect([{ total: '0' }]) as never)
    .mockReturnValueOnce(makeSelectChainDirect([{ total: '0' }]) as never);
}

// ─── postReliabilityMark ──────────────────────────────────────────────────────

describe('postReliabilityMark', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts a row with correct eventType and marksApplied', async () => {
    const insertChain = makeInsertChain();
    vi.mocked(db.insert).mockReturnValue(insertChain as never);
    setupRecalcMocks('0', null);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    await postReliabilityMark({
      userId: USER_ID, transactionId: TX_ID,
      eventType: 'BUYER_NOSHOW', marksApplied: -3,
    });

    expect(db.insert).toHaveBeenCalledOnce();
    const insertArg = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg.userId).toBe(USER_ID);
    expect(insertArg.transactionId).toBe(TX_ID);
    expect(insertArg.eventType).toBe('BUYER_NOSHOW');
    expect(insertArg.marksApplied).toBe(-3);
  });

  it('computes decaysAt as now + 180 days (default markDecayDays)', async () => {
    const insertChain = makeInsertChain();
    vi.mocked(db.insert).mockReturnValue(insertChain as never);
    setupRecalcMocks('0', null);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const before = Date.now();
    await postReliabilityMark({
      userId: USER_ID, transactionId: TX_ID,
      eventType: 'SELLER_NOSHOW', marksApplied: -3,
    });
    const after = Date.now();

    const insertArg = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    const decaysAt = insertArg.decaysAt as Date;
    const expected = 180 * 24 * 60 * 60 * 1000;
    expect(decaysAt.getTime()).toBeGreaterThanOrEqual(before + expected - 1000);
    expect(decaysAt.getTime()).toBeLessThanOrEqual(after + expected + 1000);
  });

  it('uses custom markDecayDays from platform_settings', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValueOnce(90 as never);
    const insertChain = makeInsertChain();
    vi.mocked(db.insert).mockReturnValue(insertChain as never);
    setupRecalcMocks('0', null);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const before = Date.now();
    await postReliabilityMark({
      userId: USER_ID, transactionId: TX_ID,
      eventType: 'BUYER_CANCEL_LATE', marksApplied: -1,
    });
    const after = Date.now();

    const insertArg = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    const decaysAt = insertArg.decaysAt as Date;
    const expected = 90 * 24 * 60 * 60 * 1000;
    expect(decaysAt.getTime()).toBeGreaterThanOrEqual(before + expected - 1000);
    expect(decaysAt.getTime()).toBeLessThanOrEqual(after + expected + 1000);
  });

  it('calls db.update to recalculate user.localReliabilityMarks after insert', async () => {
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    setupRecalcMocks('-3', null);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    await postReliabilityMark({
      userId: USER_ID, transactionId: TX_ID,
      eventType: 'BUYER_NOSHOW', marksApplied: -3,
    });

    expect(db.update).toHaveBeenCalled();
  });

  it('sets localSuspendedUntil when marks reach threshold (>= 9)', async () => {
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    setupRecalcMocks('-9', null);
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await postReliabilityMark({
      userId: USER_ID, transactionId: TX_ID,
      eventType: 'BUYER_NOSHOW', marksApplied: -3,
    });

    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg.localSuspendedUntil).toBeInstanceOf(Date);
    expect((setArg.localSuspendedUntil as Date).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('does NOT set localSuspendedUntil when marks are below threshold', async () => {
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    setupRecalcMocks('-3', null);
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await postReliabilityMark({
      userId: USER_ID, transactionId: TX_ID,
      eventType: 'BUYER_NOSHOW', marksApplied: -3,
    });

    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg.localSuspendedUntil).toBeNull();
  });

  it('is a no-op for 0 marksApplied (graceful cancellation)', async () => {
    await postReliabilityMark({
      userId: USER_ID, transactionId: TX_ID,
      eventType: 'BUYER_CANCEL_GRACEFUL', marksApplied: 0,
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('postReliabilityMark with 0 marksApplied is a no-op', async () => {
    await postReliabilityMark({
      userId: USER_ID, transactionId: TX_ID,
      eventType: 'BUYER_CANCEL_GRACEFUL', marksApplied: 0,
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('mark decay boundary: decaysAt exactly at now is NOT counted', async () => {
    setupRecalcMocks(null, null);
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await recalculateReliabilityMarks(USER_ID);

    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg.localReliabilityMarks).toBe(0);
  });

  it('already suspended — marks still recorded, suspendedUntil not re-extended', async () => {
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    setupRecalcMocks('-12', FUTURE);
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await postReliabilityMark({
      userId: USER_ID, transactionId: TX_ID,
      eventType: 'BUYER_NOSHOW', marksApplied: -3,
    });

    expect(db.insert).toHaveBeenCalledOnce();
    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg.localSuspendedUntil).toEqual(FUTURE);
  });

  it('multiple marks on the same transaction are both recorded', async () => {
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    setupRecalcMocks('-1', null);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    setupRecalcMocks('-4', null);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    await postReliabilityMark({
      userId: USER_ID, transactionId: TX_ID,
      eventType: 'RESCHEDULE_EXCESS', marksApplied: -1,
    });
    await postReliabilityMark({
      userId: USER_ID, transactionId: TX_ID,
      eventType: 'BUYER_NOSHOW', marksApplied: -3,
    });

    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});
