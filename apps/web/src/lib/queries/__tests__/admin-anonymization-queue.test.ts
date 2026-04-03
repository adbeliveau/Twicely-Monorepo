/**
 * Admin Anonymization Queue Query Tests (I13)
 * Covers getAnonymizationQueueSummary and getAnonymizationQueueAdmin.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAnonymizationQueueSummary,
  getAnonymizationQueueAdmin,
} from '../admin-anonymization-queue';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  user: {
    id: 'id', name: 'name', email: 'email',
    deletionRequestedAt: 'deletion_requested_at',
    anonymizedAt: 'anonymized_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  isNotNull: (_a: unknown) => ({ type: 'isNotNull' }),
  isNull: (_a: unknown) => ({ type: 'isNull' }),
  desc: (_a: unknown) => ({ type: 'desc' }),
  count: () => ({ type: 'count' }),
  ilike: (_a: unknown, _b: unknown) => ({ type: 'ilike' }),
  or: (..._args: unknown[]) => ({ type: 'or' }),
  and: (..._args: unknown[]) => ({ type: 'and' }),
  lt: (_a: unknown, _b: unknown) => ({ type: 'lt' }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChain(result: unknown[]) {
  const c: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const key of [
    'from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit', 'offset',
    'groupBy', 'having',
  ]) {
    c[key] = vi.fn().mockReturnValue(c);
  }
  return c;
}

const NOW = new Date('2026-01-01T00:00:00Z');
const FORTY_DAYS_AGO = new Date(NOW.getTime() - 40 * 86400000);
const TEN_DAYS_AGO = new Date(NOW.getTime() - 10 * 86400000);

function makeUserRow(deletionRequestedAt: Date) {
  return {
    userId: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    deletionRequestedAt,
  };
}

// ─── getAnonymizationQueueSummary ─────────────────────────────────────────────

describe('getAnonymizationQueueSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending, processed, and total counts', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ c: 3 }]))  // pending (deletionRequested + not anonymized)
      .mockReturnValueOnce(makeChain([{ c: 2 }]))  // processed (deletionRequested + anonymized)
      .mockReturnValueOnce(makeChain([{ c: 5 }])); // total

    const result = await getAnonymizationQueueSummary();

    expect(result.total).toBe(5);
    expect(result.processed).toBe(2);
    expect(result.pendingDeletions).toBe(3);
  });

  it('returns zeros when no deletion requests exist', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ c: 0 }]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]));

    const result = await getAnonymizationQueueSummary();

    expect(result.pendingDeletions).toBe(0);
    expect(result.processed).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles missing count rows with fallback 0', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]));

    const result = await getAnonymizationQueueSummary();

    expect(result.total).toBe(0);
    expect(result.processed).toBe(0);
    expect(result.pendingDeletions).toBe(0);
  });
});

// ─── getAnonymizationQueueAdmin ───────────────────────────────────────────────

describe('getAnonymizationQueueAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated queue results', async () => {
    const rows = [makeUserRow(TEN_DAYS_AGO), makeUserRow(FORTY_DAYS_AGO)];
    mockDbSelect
      .mockReturnValueOnce(makeChain(rows))
      .mockReturnValueOnce(makeChain([{ c: 2 }]));

    const result = await getAnonymizationQueueAdmin({ page: 1, pageSize: 25 });

    expect(result.queue).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('returns real anonymizedAt from user column', async () => {
    const row = { ...makeUserRow(TEN_DAYS_AGO), anonymizedAt: null };
    mockDbSelect
      .mockReturnValueOnce(makeChain([row]))
      .mockReturnValueOnce(makeChain([{ c: 1 }]));

    const result = await getAnonymizationQueueAdmin({});

    expect(result.queue[0]?.anonymizedAt).toBeNull();

    // When anonymizedAt is set, it passes through
    const row2 = { ...makeUserRow(TEN_DAYS_AGO), anonymizedAt: new Date('2026-01-15') };
    mockDbSelect
      .mockReturnValueOnce(makeChain([row2]))
      .mockReturnValueOnce(makeChain([{ c: 1 }]));

    const result2 = await getAnonymizationQueueAdmin({});
    expect(result2.queue[0]?.anonymizedAt).toEqual(new Date('2026-01-15'));
  });

  it('filters by pending status', async () => {
    const rows = [makeUserRow(TEN_DAYS_AGO)];
    mockDbSelect
      .mockReturnValueOnce(makeChain(rows))
      .mockReturnValueOnce(makeChain([{ c: 1 }]));

    const result = await getAnonymizationQueueAdmin({ status: 'pending' });

    expect(result.queue).toHaveLength(1);
  });

  it('filters by processed status', async () => {
    const rows = [makeUserRow(FORTY_DAYS_AGO)];
    mockDbSelect
      .mockReturnValueOnce(makeChain(rows))
      .mockReturnValueOnce(makeChain([{ c: 1 }]));

    const result = await getAnonymizationQueueAdmin({ status: 'processed' });

    expect(result.queue).toHaveLength(1);
  });

  it('applies search by email', async () => {
    const rows = [makeUserRow(TEN_DAYS_AGO)];
    mockDbSelect
      .mockReturnValueOnce(makeChain(rows))
      .mockReturnValueOnce(makeChain([{ c: 1 }]));

    const result = await getAnonymizationQueueAdmin({ search: 'user@example' });

    expect(result.queue).toHaveLength(1);
  });

  it('returns empty queue when no matching rows', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]));

    const result = await getAnonymizationQueueAdmin({});

    expect(result.queue).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('filters out rows with null deletionRequestedAt', async () => {
    const rowWithNull = { userId: 'u-1', email: 'a@b.com', name: 'A', deletionRequestedAt: null };
    const rowWithDate = makeUserRow(TEN_DAYS_AGO);
    mockDbSelect
      .mockReturnValueOnce(makeChain([rowWithNull, rowWithDate]))
      .mockReturnValueOnce(makeChain([{ c: 2 }]));

    const result = await getAnonymizationQueueAdmin({});

    expect(result.queue).toHaveLength(1);
    expect(result.queue[0]?.userId).toBe('user-1');
  });

  it('paginates correctly with page and pageSize', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ c: 100 }]));

    const result = await getAnonymizationQueueAdmin({ page: 2, pageSize: 10 });

    expect(result.total).toBe(100);
    expect(result.queue).toHaveLength(0);
  });
});
