/**
 * Tests for admin report target preview queries (I16)
 * Covers getReportTargetPreview for LISTING, REVIEW, MESSAGE, USER target types.
 * Also covers getContentReportById reporter name join and getReportsForTarget count.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', title: 'title', status: 'status' },
  review: { id: 'id', body: 'body', rating: 'rating' },
  message: { id: 'id', body: 'body' },
  user: { id: 'id', name: 'name', email: 'email', isBanned: 'is_banned' },
  contentReport: {
    id: 'id', reporterUserId: 'reporter_user_id', targetType: 'target_type',
    targetId: 'target_id', reason: 'reason', description: 'description',
    status: 'status', reviewedByStaffId: 'reviewed_by_staff_id',
    reviewedAt: 'reviewed_at', reviewNotes: 'review_notes',
    enforcementActionId: 'enforcement_action_id', createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const terminal = vi.fn().mockResolvedValue(rows);
  ['from', 'where'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['limit'] = terminal;
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getReportTargetPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns listing preview for LISTING target type', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ title: 'Nike Shoes', status: 'ACTIVE' }]));
    const { getReportTargetPreview } = await import('../admin-report-target');
    const result = await getReportTargetPreview('LISTING', 'listing-1');
    expect(result?.type).toBe('LISTING');
    if (result?.type === 'LISTING') {
      expect(result.title).toBe('Nike Shoes');
      expect(result.status).toBe('ACTIVE');
    }
  });

  it('returns review excerpt for REVIEW target type', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ body: 'Great seller!', rating: 5 }]));
    const { getReportTargetPreview } = await import('../admin-report-target');
    const result = await getReportTargetPreview('REVIEW', 'review-1');
    expect(result?.type).toBe('REVIEW');
    if (result?.type === 'REVIEW') {
      expect(result.rating).toBe(5);
      expect(result.excerpt).toBe('Great seller!');
    }
  });

  it('returns message excerpt for MESSAGE target type', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ body: 'Hello there, is this available?' }]));
    const { getReportTargetPreview } = await import('../admin-report-target');
    const result = await getReportTargetPreview('MESSAGE', 'msg-1');
    expect(result?.type).toBe('MESSAGE');
    if (result?.type === 'MESSAGE') {
      expect(result.excerpt).toBe('Hello there, is this available?');
    }
  });

  it('returns user info for USER target type', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ name: 'John Doe', email: 'john@example.com', isBanned: false }]));
    const { getReportTargetPreview } = await import('../admin-report-target');
    const result = await getReportTargetPreview('USER', 'user-1');
    expect(result?.type).toBe('USER');
    if (result?.type === 'USER') {
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.isBanned).toBe(false);
    }
  });

  it('returns null for non-existent target', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));
    const { getReportTargetPreview } = await import('../admin-report-target');
    const result = await getReportTargetPreview('LISTING', 'nonexistent-id');
    expect(result).toBeNull();
  });

  it('truncates review text to 200 chars', async () => {
    const longBody = 'x'.repeat(300);
    mockDbSelect.mockReturnValue(makeChain([{ body: longBody, rating: 3 }]));
    const { getReportTargetPreview } = await import('../admin-report-target');
    const result = await getReportTargetPreview('REVIEW', 'review-2');
    if (result?.type === 'REVIEW') {
      expect(result.excerpt.length).toBeLessThanOrEqual(202);
      expect(result.excerpt.endsWith('…')).toBe(true);
    }
  });

  it('truncates message body to 200 chars', async () => {
    const longBody = 'a'.repeat(250);
    mockDbSelect.mockReturnValue(makeChain([{ body: longBody }]));
    const { getReportTargetPreview } = await import('../admin-report-target');
    const result = await getReportTargetPreview('MESSAGE', 'msg-2');
    if (result?.type === 'MESSAGE') {
      expect(result.excerpt.length).toBeLessThanOrEqual(202);
    }
  });

  it('returns null for USER target that does not exist', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));
    const { getReportTargetPreview } = await import('../admin-report-target');
    const result = await getReportTargetPreview('USER', 'missing-user');
    expect(result).toBeNull();
  });
});

// ─── getContentReportById — reporter name join ─────────────────────────────────

describe('getContentReportById — reporter name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns reporter name from getContentReportById', async () => {
    const row = {
      id: 'rpt-1', reporterUserId: 'usr-1', reporterName: 'Jane Reporter',
      targetType: 'LISTING', targetId: 'lst-1', reason: 'PROHIBITED_ITEM',
      description: null, status: 'PENDING', reviewedByStaffId: null,
      reviewedAt: null, reviewNotes: null, enforcementActionId: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    const chain: Record<string, unknown> = {};
    const terminal = vi.fn().mockResolvedValue([row]);
    ['from', 'leftJoin', 'where'].forEach((k) => { chain[k] = vi.fn().mockReturnValue(chain); });
    chain['limit'] = terminal;
    mockDbSelect.mockReturnValue(chain);

    const { getContentReportById } = await import('../content-reports');
    const result = await getContentReportById('rpt-1');
    expect(result?.reporterName).toBe('Jane Reporter');
  });

  it('returns related report count for same target', async () => {
    const reports = [
      { id: 'rpt-1', reporterUserId: 'usr-1', reason: 'SPAM', status: 'PENDING', createdAt: new Date() },
      { id: 'rpt-2', reporterUserId: 'usr-2', reason: 'FAKE_ITEM', status: 'CONFIRMED', createdAt: new Date() },
    ];
    const chain: Record<string, unknown> = {};
    ['from', 'where', 'orderBy'].forEach((k) => { chain[k] = vi.fn().mockReturnValue(chain); });
    chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(reports).then(resolve);
    mockDbSelect.mockReturnValue(chain);

    const { getReportsForTarget } = await import('../content-reports');
    const result = await getReportsForTarget('LISTING', 'lst-1');
    expect(result).toHaveLength(2);
  });
});
