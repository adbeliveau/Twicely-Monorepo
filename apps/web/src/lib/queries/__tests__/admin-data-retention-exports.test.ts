/**
 * Admin Data Retention Export Request Query Tests (I13)
 * Covers getExportRequestAdminSummary, getExportRequestAdminList, getExportSlaBreachCount.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getExportRequestAdminSummary,
  getExportRequestAdminList,
  getExportSlaBreachCount,
} from '../admin-data-retention-exports';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  dataExportRequest: {
    id: 'id', userId: 'user_id', status: 'status', format: 'format',
    createdAt: 'created_at', completedAt: 'completed_at',
    downloadUrl: 'download_url', downloadExpiresAt: 'download_expires_at',
  },
  user: { id: 'id', name: 'name', email: 'email' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (_a: unknown, _b: unknown) => ({ type: 'eq' }),
  desc: (_a: unknown) => ({ type: 'desc' }),
  inArray: (_a: unknown, _b: unknown) => ({ type: 'inArray' }),
  ilike: (_a: unknown, _b: unknown) => ({ type: 'ilike' }),
  and: (..._args: unknown[]) => ({ type: 'and' }),
  count: () => ({ type: 'count' }),
  sql: Object.assign(
    (_strings: TemplateStringsArray, ..._vals: unknown[]) => ({ type: 'sql' }),
    { raw: (v: string) => v }
  ),
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

function makeExportRow(status: string) {
  return {
    id: `export-${status}`,
    userId: 'user-1',
    userName: 'Test User',
    userEmail: 'test@example.com',
    format: 'json',
    status,
    createdAt: NOW,
    completedAt: status === 'COMPLETED' ? NOW : null,
    downloadUrl: status === 'COMPLETED' ? 'https://cdn.example.com/export.zip' : null,
    downloadExpiresAt: status === 'COMPLETED' ? new Date(NOW.getTime() + 86400000) : null,
  };
}

// ─── getExportRequestAdminSummary ─────────────────────────────────────────────

describe('getExportRequestAdminSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correct counts for all states', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ c: 10 }])) // total
      .mockReturnValueOnce(makeChain([{ c: 3 }]))  // pending
      .mockReturnValueOnce(makeChain([{ c: 5 }]))  // completed
      .mockReturnValueOnce(makeChain([{ c: 2 }])); // failed

    const result = await getExportRequestAdminSummary();

    expect(result.total).toBe(10);
    expect(result.pending).toBe(3);
    expect(result.completed).toBe(5);
    expect(result.failed).toBe(2);
  });

  it('returns zeros when no rows exist', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ c: 0 }]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]));

    const result = await getExportRequestAdminSummary();

    expect(result.total).toBe(0);
    expect(result.pending).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('uses fallback of 0 when count row is missing', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]));

    const result = await getExportRequestAdminSummary();

    expect(result.total).toBe(0);
  });
});

// ─── getExportRequestAdminList ────────────────────────────────────────────────

describe('getExportRequestAdminList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated results with joined user data', async () => {
    const rows = [makeExportRow('COMPLETED'), makeExportRow('PENDING')];
    mockDbSelect
      .mockReturnValueOnce(makeChain(rows))
      .mockReturnValueOnce(makeChain([{ c: 2 }]));

    const result = await getExportRequestAdminList({ page: 1, pageSize: 25 });

    expect(result.requests).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('returns empty list when no exports exist', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]));

    const result = await getExportRequestAdminList({});

    expect(result.requests).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('filters by status when provided', async () => {
    const rows = [makeExportRow('FAILED')];
    mockDbSelect
      .mockReturnValueOnce(makeChain(rows))
      .mockReturnValueOnce(makeChain([{ c: 1 }]));

    const result = await getExportRequestAdminList({ status: 'FAILED' });

    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]?.status).toBe('FAILED');
  });

  it('applies search filter', async () => {
    const rows = [makeExportRow('COMPLETED')];
    mockDbSelect
      .mockReturnValueOnce(makeChain(rows))
      .mockReturnValueOnce(makeChain([{ c: 1 }]));

    const result = await getExportRequestAdminList({ search: 'test@example' });

    expect(result.requests).toHaveLength(1);
  });

  it('uses page and pageSize for offset calculation', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ c: 50 }]));

    const result = await getExportRequestAdminList({ page: 3, pageSize: 10 });

    expect(result.total).toBe(50);
    expect(result.requests).toHaveLength(0);
  });

  it('joins user table in query', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([makeExportRow('PENDING')]))
      .mockReturnValueOnce(makeChain([{ c: 1 }]));

    const result = await getExportRequestAdminList({});

    expect(result.requests[0]?.userName).toBe('Test User');
    expect(result.requests[0]?.userEmail).toBe('test@example.com');
  });
});

// ─── getExportSlaBreachCount ──────────────────────────────────────────────────

describe('getExportSlaBreachCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns breach count for given slaHours', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ c: 7 }]));

    const result = await getExportSlaBreachCount(48);

    expect(result).toBe(7);
  });

  it('returns 0 when no breaches', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ c: 0 }]));

    const result = await getExportSlaBreachCount(24);

    expect(result).toBe(0);
  });

  it('uses fallback 0 when count row is missing', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));

    const result = await getExportSlaBreachCount(72);

    expect(result).toBe(0);
  });
});
