/**
 * Tests for GET /api/search/suggestions — search typeahead (G10.6)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockDbSelectDistinct, mockDbSelect } = vi.hoisted(() => ({
  mockDbSelectDistinct: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: {
    selectDistinct: mockDbSelectDistinct,
    select: mockDbSelect,
  },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { title: 'title', brand: 'brand', status: 'status' },
  category: { name: 'name', isActive: 'isActive', depth: 'depth' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => ({ eq: true })),
  ilike: vi.fn((_col, _pat) => ({ ilike: true })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  sql: Object.assign(vi.fn((strings: TemplateStringsArray) => strings[0]), { raw: vi.fn() }),
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn() },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(q: string) {
  return new NextRequest(`http://localhost/api/search/suggestions?q=${encodeURIComponent(q)}`);
}

function makeChain(results: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(results),
  };
  return chain;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/search/suggestions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDbSelectDistinct.mockImplementation(() => makeChain([]));
    mockDbSelect.mockImplementation(() => makeChain([]));
  });

  it('returns empty array for query shorter than 2 chars', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeRequest('a'));
    const body = await res.json() as { suggestions: unknown[] };
    expect(body.suggestions).toEqual([]);
    expect(mockDbSelectDistinct).not.toHaveBeenCalled();
  });

  it('returns empty array for empty query', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeRequest(''));
    const body = await res.json() as { suggestions: unknown[] };
    expect(body.suggestions).toEqual([]);
  });

  it('queries listings, brands and categories in parallel', async () => {
    mockDbSelectDistinct.mockImplementation(() => makeChain([]));
    mockDbSelect.mockImplementation(() => makeChain([]));
    const { GET } = await import('../route');
    await GET(makeRequest('nike'));
    // 2 selectDistinct calls (title, brand) + 1 select call (category)
    expect(mockDbSelectDistinct).toHaveBeenCalledTimes(2);
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });

  it('merges and deduplicates results across types', async () => {
    mockDbSelectDistinct
      .mockImplementationOnce(() => makeChain([{ text: 'Nike Air Max' }, { text: 'Nike SB' }]))
      .mockImplementationOnce(() => makeChain([{ text: 'Nike' }]));
    mockDbSelect.mockImplementation(() => makeChain([{ text: 'Sneakers' }]));

    const { GET } = await import('../route');
    const res = await GET(makeRequest('nike'));
    const body = await res.json() as { suggestions: { text: string; type: string }[] };

    expect(body.suggestions.length).toBe(4);
    expect(body.suggestions[0]).toEqual({ text: 'Nike Air Max', type: 'listing' });
    expect(body.suggestions[2]).toEqual({ text: 'Nike', type: 'brand' });
    expect(body.suggestions[3]).toEqual({ text: 'Sneakers', type: 'category' });
  });

  it('deduplicates case-insensitively', async () => {
    mockDbSelectDistinct
      .mockImplementationOnce(() => makeChain([{ text: 'Nike' }]))
      .mockImplementationOnce(() => makeChain([{ text: 'NIKE' }]));
    mockDbSelect.mockImplementation(() => makeChain([]));

    const { GET } = await import('../route');
    const res = await GET(makeRequest('nike'));
    const body = await res.json() as { suggestions: unknown[] };
    expect(body.suggestions).toHaveLength(1);
  });

  it('returns empty suggestions on DB error (graceful)', async () => {
    mockDbSelectDistinct.mockImplementation(() => {
      throw new Error('DB connection error');
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest('nike'));
    const body = await res.json() as { suggestions: unknown[] };
    expect(body.suggestions).toEqual([]);
  });

  it('truncates query to 100 chars', async () => {
    mockDbSelectDistinct.mockImplementation(() => makeChain([]));
    mockDbSelect.mockImplementation(() => makeChain([]));

    const longQuery = 'a'.repeat(200);
    const { GET } = await import('../route');
    await GET(makeRequest(longQuery));
    // Should proceed without error (query truncated to 100)
    expect(mockDbSelectDistinct).toHaveBeenCalledTimes(2);
  });

  it('includes Cache-Control header on success', async () => {
    mockDbSelectDistinct.mockImplementation(() => makeChain([]));
    mockDbSelect.mockImplementation(() => makeChain([]));

    const { GET } = await import('../route');
    const res = await GET(makeRequest('test'));
    expect(res.headers.get('cache-control')).toContain('max-age=60');
  });
});
