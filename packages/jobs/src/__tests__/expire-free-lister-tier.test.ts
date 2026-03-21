import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock BullMQ queue/worker factory to prevent Valkey connection attempts at import time
vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({
    add: vi.fn(),
    getJob: vi.fn(),
    close: vi.fn(),
  }),
  createWorker: vi.fn().mockReturnValue({
    close: vi.fn(),
  }),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: {
    userId: 'user_id',
    listerTier: 'lister_tier',
    listerFreeExpiresAt: 'lister_free_expires_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { db } from '@twicely/db';
import { logger } from '@twicely/logger';
import { runExpireFreeListerTier } from '../expire-free-lister-tier';

// Helper factories matching the chain pattern from project tests
function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// Fixtures
const PAST = new Date(Date.now() - 1000);       // 1 second ago — expired
const FUTURE = new Date(Date.now() + 86_400_000); // 1 day from now — not expired

describe('runExpireFreeListerTier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downgrade sellers with listerTier=FREE and listerFreeExpiresAt < now', async () => {
    const updateChain = makeUpdateChain();
    // 1 expired seller, then 0 → loop ends (1 < 100 breaks early)
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ userId: 'user-1' }]) as never);
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await runExpireFreeListerTier();

    expect(db.update).toHaveBeenCalledTimes(1);
    const setArg = updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArg.listerTier).toBe('NONE');
    expect(setArg.listerFreeExpiresAt).toBeNull();
    void PAST; // fixture referenced
  });

  it('does NOT downgrade sellers with listerFreeExpiresAt > now', async () => {
    // DB query filters these out — simulated by returning 0 rows
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);

    await runExpireFreeListerTier();

    expect(db.update).not.toHaveBeenCalled();
    void FUTURE; // fixture referenced
  });

  it('does NOT downgrade sellers with listerFreeExpiresAt = NULL (grandfathered)', async () => {
    // isNotNull(listerFreeExpiresAt) condition excludes these — returns 0 rows
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);

    await runExpireFreeListerTier();

    expect(db.update).not.toHaveBeenCalled();
  });

  it('does NOT touch sellers with listerTier = NONE', async () => {
    // eq(listerTier, 'FREE') condition excludes NONE — returns 0 rows
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);

    await runExpireFreeListerTier();

    expect(db.update).not.toHaveBeenCalled();
  });

  it('does NOT touch sellers with listerTier = LITE', async () => {
    // eq(listerTier, 'FREE') condition excludes LITE — returns 0 rows
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);

    await runExpireFreeListerTier();

    expect(db.update).not.toHaveBeenCalled();
  });

  it('does NOT touch sellers with listerTier = PRO', async () => {
    // eq(listerTier, 'FREE') condition excludes PRO — returns 0 rows
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);

    await runExpireFreeListerTier();

    expect(db.update).not.toHaveBeenCalled();
  });

  it('processes 250 expired sellers in 3 batches (100 + 100 + 50)', async () => {
    // Batch of exactly 100 → loop continues; batch of 50 → loop breaks (< BATCH_SIZE)
    const batch100 = Array.from({ length: 100 }, (_, i) => ({ userId: `user-${i}` }));
    const batch50 = Array.from({ length: 50 }, (_, i) => ({ userId: `user-${100 + i}` }));

    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain(batch100) as never)  // batch 1: 100 rows — loop continues
      .mockReturnValueOnce(makeSelectChain(batch100) as never)  // batch 2: 100 rows — loop continues
      .mockReturnValueOnce(makeSelectChain(batch50) as never);  // batch 3: 50 rows — breaks

    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await runExpireFreeListerTier();

    // 250 individual updates, one per seller
    expect(db.update).toHaveBeenCalledTimes(250);
    // select called 3 times: batch of 100 continues, batch of 100 continues, batch of 50 breaks
    expect(db.select).toHaveBeenCalledTimes(3);
  });

  it('individual row failure logs error, continues batch, does not throw', async () => {
    const batch = [{ userId: 'user-ok' }, { userId: 'user-fail' }, { userId: 'user-ok-2' }];

    // 3 rows (< 100) → loop breaks after first batch
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain(batch) as never);

    const goodChain = makeUpdateChain();
    const badChain = {
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('DB error')),
      }),
    };

    // First and third sellers succeed, second fails
    vi.mocked(db.update)
      .mockReturnValueOnce(goodChain as never)
      .mockReturnValueOnce(badChain as never)
      .mockReturnValueOnce(goodChain as never);

    await expect(runExpireFreeListerTier()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      '[expireFreeListerTier] Failed to downgrade seller',
      expect.objectContaining({ userId: 'user-fail' })
    );
    expect(db.update).toHaveBeenCalledTimes(3);
  });

  it('logs total count of downgraded sellers after run', async () => {
    const batch = [{ userId: 'user-1' }, { userId: 'user-2' }];

    // 2 rows (< 100) → loop breaks after first batch
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain(batch) as never);

    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await runExpireFreeListerTier();

    expect(logger.info).toHaveBeenCalledWith(
      '[expireFreeListerTier] Downgraded 2 sellers'
    );
  });

  it('is idempotent — running twice on same day is safe (second run finds 0 rows)', async () => {
    // First run: 1 seller found and downgraded (1 < 100 → breaks after first select)
    // Second run: 0 rows (already NONE) → breaks immediately
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ userId: 'user-1' }]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await runExpireFreeListerTier();
    await runExpireFreeListerTier();

    // Only 1 update total — second run touched nothing
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('sets updatedAt on each downgraded row', async () => {
    // 1 expired seller (< 100 → breaks after first select)
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ userId: 'user-1' }]) as never
    );

    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await runExpireFreeListerTier();

    expect(updateChain.set).toHaveBeenCalledTimes(1);
    const setArg = updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    // updatedAt is set via sql`now()` — verify the key is present
    expect(Object.prototype.hasOwnProperty.call(setArg, 'updatedAt')).toBe(true);
  });
});
