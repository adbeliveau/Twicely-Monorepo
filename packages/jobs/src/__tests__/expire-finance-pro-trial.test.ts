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
    insert: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  financeSubscription: {
    id: 'id',
    sellerProfileId: 'seller_profile_id',
    tier: 'tier',
    stripeSubscriptionId: 'stripe_subscription_id',
    storeTierTrialEndsAt: 'store_tier_trial_ends_at',
    updatedAt: 'updated_at',
  },
  sellerProfile: {
    id: 'id',
    userId: 'user_id',
    financeTier: 'finance_tier',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  isNull: vi.fn(),
  isNotNull: vi.fn(),
  lt: vi.fn(),
  lte: vi.fn(),
  gte: vi.fn(),
  sql: vi.fn(),
}));

import { db } from '@twicely/db';
import { logger } from '@twicely/logger';
import { notify } from '@twicely/notifications/service';
import {
  runExpireFinanceProTrial,
  runFinanceProTrialExpiryWarnings,
  registerExpireFinanceProTrialJob,
  expireFinanceProTrialQueue,
} from '../expire-finance-pro-trial';

// ─── Chain helpers ────────────────────────────────────────────────────────────

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EXPIRED_ROW = { id: 'fs-1', sellerProfileId: 'sp-1' };
const PROFILE_ROW = { userId: 'user-1' };

// ─── Tests: runExpireFinanceProTrial ─────────────────────────────────────────

describe('runExpireFinanceProTrial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downgrades PRO trials whose storeTierTrialEndsAt < now', async () => {
    // 1 expired row (< 100 → loop breaks after first batch)
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([EXPIRED_ROW]) as never)   // batch query
      .mockReturnValueOnce(makeSelectChain([PROFILE_ROW]) as never);  // profile lookup

    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await runExpireFinanceProTrial();

    // 2 updates: financeSubscription + sellerProfile
    expect(db.update).toHaveBeenCalledTimes(2);
    const firstSet = updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(firstSet.tier).toBe('FREE');
  });

  it('notifies user when trial expires', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([EXPIRED_ROW]) as never)
      .mockReturnValueOnce(makeSelectChain([PROFILE_ROW]) as never);

    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    await runExpireFinanceProTrial();

    expect(notify).toHaveBeenCalledWith('user-1', 'finance.trial.expired', {});
  });

  it('does NOT call update when no expired trials exist', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);

    await runExpireFinanceProTrial();

    expect(db.update).not.toHaveBeenCalled();
  });

  it('processes 250 expired trials in 3 batches (100 + 100 + 50)', async () => {
    const batch100 = Array.from({ length: 100 }, (_, i) => ({ id: `fs-${i}`, sellerProfileId: `sp-${i}` }));
    const batch50 = Array.from({ length: 50 }, (_, i) => ({ id: `fs-${100 + i}`, sellerProfileId: `sp-${100 + i}` }));

    // 3 batch queries + 250 profile lookups (interleaved)
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      // Batch queries: calls 1, 102, 203 (every 101st relative to batch logic)
      // but we simplify: first 3 batch selects return batches, remainder return profiles
      if (selectCallCount === 1) return makeSelectChain(batch100) as never;
      if (selectCallCount === 102) return makeSelectChain(batch100) as never;
      if (selectCallCount === 203) return makeSelectChain(batch50) as never;
      // Profile lookups: return PROFILE_ROW
      return makeSelectChain([PROFILE_ROW]) as never;
    });

    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    await runExpireFinanceProTrial();

    // 250 expired trials × 2 updates each = 500
    expect(db.update).toHaveBeenCalledTimes(500);
  });

  it('individual row failure logs error and continues batch', async () => {
    const batch = [
      { id: 'fs-ok', sellerProfileId: 'sp-ok' },
      { id: 'fs-fail', sellerProfileId: 'sp-fail' },
    ];

    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain(batch) as never)
      .mockReturnValueOnce(makeSelectChain([PROFILE_ROW]) as never)   // profile for sp-ok
      .mockReturnValueOnce(makeSelectChain([PROFILE_ROW]) as never);  // profile for sp-fail

    const goodChain = makeUpdateChain();
    const badChain = {
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('DB error')),
      }),
    };

    vi.mocked(db.update)
      .mockReturnValueOnce(goodChain as never)   // financeSubscription for sp-ok
      .mockReturnValueOnce(goodChain as never)   // sellerProfile for sp-ok
      .mockReturnValueOnce(badChain as never);   // financeSubscription for sp-fail throws

    await expect(runExpireFinanceProTrial()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      '[expireFinanceProTrial] Failed to expire trial',
      expect.objectContaining({ financeSubscriptionId: 'fs-fail' }),
    );
  });

  it('logs total count of expired trials', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([EXPIRED_ROW]) as never)
      .mockReturnValueOnce(makeSelectChain([PROFILE_ROW]) as never);

    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    await runExpireFinanceProTrial();

    expect(logger.info).toHaveBeenCalledWith(
      '[expireFinanceProTrial] Expired 1 Finance PRO trials',
    );
  });

  it('is idempotent — second run finds 0 rows after first run', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([EXPIRED_ROW]) as never)
      .mockReturnValueOnce(makeSelectChain([PROFILE_ROW]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never); // second run: empty

    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    await runExpireFinanceProTrial();
    await runExpireFinanceProTrial();

    // Only 2 updates from first run (financeSubscription + sellerProfile)
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('skips notification if profile not found', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([EXPIRED_ROW]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never); // no profile

    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    await runExpireFinanceProTrial();

    expect(notify).not.toHaveBeenCalled();
    // Updates still happen
    expect(db.update).toHaveBeenCalledTimes(2);
  });
});

// ─── Tests: runFinanceProTrialExpiryWarnings ──────────────────────────────────

describe('runFinanceProTrialExpiryWarnings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends expiring_soon notification for trials within 30-day window', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([EXPIRED_ROW]) as never)   // expiring-soon batch
      .mockReturnValueOnce(makeSelectChain([PROFILE_ROW]) as never);  // profile lookup

    await runFinanceProTrialExpiryWarnings();

    expect(notify).toHaveBeenCalledWith('user-1', 'finance.trial.expiring_soon', {});
  });

  it('sends no notifications when no trials are expiring soon', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);

    await runFinanceProTrialExpiryWarnings();

    expect(notify).not.toHaveBeenCalled();
  });
});

// ─── Tests: registerExpireFinanceProTrialJob ──────────────────────────────────

describe('registerExpireFinanceProTrialJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds the job to the queue with daily 02:00 UTC pattern', async () => {
    await registerExpireFinanceProTrialJob();

    expect(expireFinanceProTrialQueue.add).toHaveBeenCalledWith(
      'expire-finance-pro-trial',
      expect.objectContaining({ triggeredAt: expect.any(String) }),
      expect.objectContaining({
        jobId: 'expire-finance-pro-trial',
        repeat: { pattern: '0 2 * * *', tz: 'UTC' },
        removeOnComplete: true,
      }),
    );
  });
});
