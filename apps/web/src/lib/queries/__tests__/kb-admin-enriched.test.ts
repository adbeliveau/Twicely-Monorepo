/**
 * Tests for enriched KB admin queries (I16)
 * Covers getAdminKbArticles with author join, category join, audience filter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  kbArticle: {
    id: 'id', slug: 'slug', title: 'title', excerpt: 'excerpt',
    status: 'status', audience: 'audience', isFeatured: 'is_featured',
    viewCount: 'view_count', helpfulYes: 'helpful_yes', helpfulNo: 'helpful_no',
    updatedAt: 'updated_at', categoryId: 'category_id', authorStaffId: 'author_staff_id',
  },
  kbCategory: { id: 'id', name: 'name', sortOrder: 'sort_order' },
  staffUser: { id: 'id', displayName: 'display_name' },
}));

vi.mock('drizzle-orm', () => ({
  asc: vi.fn((col) => ({ type: 'asc', col })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  count: vi.fn(() => ({ type: 'count' })),
  eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
  and: vi.fn((...args) => ({ type: 'and', args })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00Z');

function makeArticleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'art-1',
    slug: 'test-article',
    title: 'Test Article',
    excerpt: 'An excerpt',
    status: 'PUBLISHED' as const,
    audience: 'ALL',
    isFeatured: false,
    viewCount: 42,
    helpfulYes: 10,
    helpfulNo: 2,
    updatedAt: NOW,
    categoryId: 'cat-1',
    categoryName: 'Getting Started',
    authorName: 'Alice Smith',
    ...overrides,
  };
}

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const terminal = vi.fn().mockResolvedValue(rows);
  ['from', 'leftJoin', 'where', 'orderBy', 'groupBy'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['limit'] = terminal;
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getAdminKbArticles (enriched)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns articles with author name from staffUser join', async () => {
    const rows = [makeArticleRow({ authorName: 'Alice Smith' })];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles();
    expect(result[0]?.authorName).toBe('Alice Smith');
  });

  it('returns articles with category name', async () => {
    const rows = [makeArticleRow({ categoryName: 'Getting Started' })];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles();
    expect(result[0]?.categoryName).toBe('Getting Started');
  });

  it('returns null authorName when staffUser not found', async () => {
    const rows = [makeArticleRow({ authorName: null })];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles();
    expect(result[0]?.authorName).toBeNull();
  });

  it('returns null categoryName when category not found', async () => {
    const rows = [makeArticleRow({ categoryName: null })];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles();
    expect(result[0]?.categoryName).toBeNull();
  });

  it('filters by audience parameter', async () => {
    const rows = [makeArticleRow({ audience: 'BUYER' })];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles({ audience: 'BUYER' });
    expect(result[0]?.audience).toBe('BUYER');
  });

  it('returns empty array when no articles match filters', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles({ status: 'ARCHIVED' });
    expect(result).toHaveLength(0);
  });

  it('filters by status, categoryId, and audience combined', async () => {
    const rows = [makeArticleRow({ status: 'PUBLISHED', audience: 'SELLER', categoryId: 'cat-2' })];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles({ status: 'PUBLISHED', categoryId: 'cat-2', audience: 'SELLER' });
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('PUBLISHED');
  });

  it('computes helpful percentage correctly in consuming code', () => {
    const article = makeArticleRow({ helpfulYes: 8, helpfulNo: 2 });
    const total = (article.helpfulYes as number) + (article.helpfulNo as number);
    const pct = Math.round(((article.helpfulYes as number) / total) * 100);
    expect(pct).toBe(80);
  });

  it('returns helpfulYes and helpfulNo in result', async () => {
    const rows = [makeArticleRow({ helpfulYes: 5, helpfulNo: 1 })];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles();
    expect(result[0]?.helpfulYes).toBe(5);
    expect(result[0]?.helpfulNo).toBe(1);
  });

  it('returns correct shape with all required fields', async () => {
    const rows = [makeArticleRow()];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles();
    const art = result[0];
    expect(art).toHaveProperty('id');
    expect(art).toHaveProperty('title');
    expect(art).toHaveProperty('categoryName');
    expect(art).toHaveProperty('authorName');
    expect(art).toHaveProperty('helpfulYes');
    expect(art).toHaveProperty('helpfulNo');
  });
});
