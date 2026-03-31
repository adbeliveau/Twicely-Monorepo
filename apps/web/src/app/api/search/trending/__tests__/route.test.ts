/**
 * Tests for GET /api/search/trending — trending search queries (G10.6)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('@twicely/db/schema', () => ({
  browsingHistory: { searchQuery: 'search_query', lastViewedAt: 'last_viewed_at' },
}));

vi.mock('drizzle-orm', () => ({
  isNotNull: vi.fn(),
  gte: vi.fn(),
  sql: Object.assign(vi.fn((strings: TemplateStringsArray) => strings[0]), { raw: vi.fn() }),
}));

vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn().mockReturnValue({
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  }),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeChain(results: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(results),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/search/trending', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDbSelect.mockReturnValue(makeChain([]));
  });

  it('returns trending queries from browsing history', async () => {
    mockDbSelect.mockReturnValue(makeChain([
      { query: 'Nike Air Jordan', count: 50 },
      { query: 'Vintage Levi\'s', count: 40 },
      { query: 'Supreme hoodie', count: 35 },
      { query: 'Prada bag', count: 20 },
    ]));

    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json() as { trending: string[] };

    expect(body.trending).toContain('Nike Air Jordan');
    expect(body.trending).toContain('Vintage Levi\'s');
  });

  it('pads with fallback terms when fewer than 4 real results', async () => {
    mockDbSelect.mockReturnValue(makeChain([
      { query: 'Nike', count: 5 },
    ]));

    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json() as { trending: string[] };

    expect(body.trending.length).toBeGreaterThan(1);
    expect(body.trending[0]).toBe('Nike');
    // Padded with fallbacks
    expect(body.trending.length).toBeLessThanOrEqual(8);
  });

  it('returns only fallbacks when DB has no data', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));

    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json() as { trending: string[] };

    expect(body.trending.length).toBeGreaterThan(0);
    expect(body.trending.length).toBeLessThanOrEqual(8);
  });

  it('returns fallback trending on DB error (graceful)', async () => {
    mockDbSelect.mockImplementation(() => {
      throw new Error('DB down');
    });

    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json() as { trending: string[] };

    expect(body.trending.length).toBeGreaterThan(0);
  });

  it('caps result at 8 items', async () => {
    mockDbSelect.mockReturnValue(makeChain(
      Array.from({ length: 20 }, (_, i) => ({ query: `term-${i}`, count: 10 - i })),
    ));

    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json() as { trending: string[] };

    expect(body.trending.length).toBeLessThanOrEqual(8);
  });

  it('includes Cache-Control header', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));

    const { GET } = await import('../route');
    const res = await GET();
    expect(res.headers.get('cache-control')).toContain('max-age=');
  });

  it('filters out null/empty query strings', async () => {
    mockDbSelect.mockReturnValue(makeChain([
      { query: null, count: 100 },
      { query: '', count: 50 },
      { query: 'Nike', count: 10 },
    ]));

    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json() as { trending: string[] };

    expect(body.trending).not.toContain(null);
    expect(body.trending).not.toContain('');
    expect(body.trending).toContain('Nike');
  });
});
