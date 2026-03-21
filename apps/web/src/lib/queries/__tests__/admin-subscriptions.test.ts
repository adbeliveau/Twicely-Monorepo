/**
 * Admin Subscriptions Queries Tests (I3)
 * Covers getSubscriptionStats and getRecentSubscriptionChanges
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSubscriptionStats, getRecentSubscriptionChanges } from '../admin-subscriptions';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));
vi.mock('@twicely/db/schema', () => ({
  storeSubscription: { sellerProfileId: 'sp_id', tier: 'tier', status: 'status', updatedAt: 'updated_at' },
  listerSubscription: { sellerProfileId: 'sp_id', tier: 'tier', status: 'status', updatedAt: 'updated_at' },
  automationSubscription: { sellerProfileId: 'sp_id', status: 'status', updatedAt: 'updated_at' },
  financeSubscription: { sellerProfileId: 'sp_id', tier: 'tier', status: 'status', updatedAt: 'updated_at' },
  bundleSubscription: { sellerProfileId: 'sp_id', tier: 'tier', status: 'status', updatedAt: 'updated_at' },
  sellerProfile: { id: 'id', userId: 'user_id' },
  user: { id: 'id', name: 'name' },
}));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
  desc: (_col: unknown) => ({ type: 'desc' }),
  count: () => ({ type: 'count' }),
  inArray: (_col: unknown, _arr: unknown) => ({ type: 'inArray' }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00Z');

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'innerJoin', 'leftJoin'].forEach((key) => {
    chain[key] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

// ─── getSubscriptionStats ─────────────────────────────────────────────────────

describe('getSubscriptionStats', () => {
  beforeEach(() => vi.resetAllMocks());

  it('aggregates counts from all 5 subscription tables', async () => {
    // store, lister, automation, finance, bundle
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ tier: 'STARTER', total: 10 }, { tier: 'PRO', total: 5 }]))
      .mockReturnValueOnce(makeSelectChain([{ tier: 'FREE', total: 20 }, { tier: 'PRO', total: 8 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 15 }]))
      .mockReturnValueOnce(makeSelectChain([{ tier: 'PRO', total: 3 }]))
      .mockReturnValueOnce(makeSelectChain([{ tier: 'STARTER', total: 7 }]));

    const stats = await getSubscriptionStats();

    expect(stats.store.STARTER).toBe(10);
    expect(stats.store.PRO).toBe(5);
    expect(stats.lister.FREE).toBe(20);
    expect(stats.lister.PRO).toBe(8);
    expect(stats.automation.active).toBe(15);
    expect(stats.finance.PRO).toBe(3);
    expect(stats.bundle.STARTER).toBe(7);
  });

  it('handles empty tables returning zero counts', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const stats = await getSubscriptionStats();

    expect(stats.totalActiveSubscriptions).toBe(0);
    expect(stats.store.STARTER).toBe(0);
    expect(stats.lister.PRO).toBe(0);
    expect(stats.automation.active).toBe(0);
  });

  it('calculates totalActiveSubscriptions correctly across all axes', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ tier: 'PRO', total: 2 }]))
      .mockReturnValueOnce(makeSelectChain([{ tier: 'LITE', total: 3 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 1 }]))
      .mockReturnValueOnce(makeSelectChain([{ tier: 'PRO', total: 1 }]))
      .mockReturnValueOnce(makeSelectChain([{ tier: 'POWER', total: 2 }]));

    const stats = await getSubscriptionStats();

    // 2 + 3 + 1 + 1 + 2 = 9
    expect(stats.totalActiveSubscriptions).toBe(9);
  });
});

// ─── getRecentSubscriptionChanges ────────────────────────────────────────────

describe('getRecentSubscriptionChanges', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns changes across all subscription axes ordered by updatedAt', async () => {
    const storeRow = { sellerProfileId: 'sp-1', tier: 'PRO', status: 'ACTIVE', updatedAt: new Date('2026-01-10') };
    const listerRow = { sellerProfileId: 'sp-2', tier: 'FREE', status: 'ACTIVE', updatedAt: new Date('2026-01-05') };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([storeRow]))
      .mockReturnValueOnce(makeSelectChain([listerRow]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'sp-1', userId: 'user-1' }, { id: 'sp-2', userId: 'user-2' }]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'user-1', name: 'Alice' }, { id: 'user-2', name: 'Bob' }]));

    const changes = await getRecentSubscriptionChanges(50);

    expect(changes.length).toBeGreaterThan(0);
    // Most recent first
    expect(changes[0]?.updatedAt).toEqual(new Date('2026-01-10'));
    expect(changes[0]?.axis).toBe('Store');
    expect(changes[1]?.axis).toBe('Lister');
  });

  it('resolves seller names via sellerProfile -> user JOIN', async () => {
    const storeRow = { sellerProfileId: 'sp-1', tier: 'STARTER', status: 'ACTIVE', updatedAt: NOW };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([storeRow]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'sp-1', userId: 'user-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'user-1', name: 'Alice' }]));

    const changes = await getRecentSubscriptionChanges(50);

    const storeChange = changes.find((c) => c.axis === 'Store');
    expect(storeChange?.userName).toBe('Alice');
    expect(storeChange?.userId).toBe('user-1');
  });

  it('returns empty array when no subscription changes exist', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const changes = await getRecentSubscriptionChanges(50);

    expect(changes).toHaveLength(0);
  });
});
