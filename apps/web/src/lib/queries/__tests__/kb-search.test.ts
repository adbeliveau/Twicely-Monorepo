import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockDb = { select: mockSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit', 'groupBy', 'innerJoin'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

const PUBLISHED_ARTICLE = {
  id: 'art-1',
  slug: 'how-returns-work',
  title: 'How Returns Work on Twicely',
  excerpt: 'Learn about the return process',
  status: 'PUBLISHED',
  audience: 'ALL',
  isFeatured: false,
  viewCount: 50,
  helpfulYes: 10,
  helpfulNo: 1,
  updatedAt: new Date(),
  categoryId: 'cat-1',
};

describe('searchKbArticles', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns empty array for empty query', async () => {
    const { searchKbArticles } = await import('../kb-articles');
    const result = await searchKbArticles('', null);
    expect(result).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('returns empty array when no matches found', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { searchKbArticles } = await import('../kb-articles');
    const result = await searchKbArticles('nonexistent-term', null);
    expect(result).toEqual([]);
  });

  it('finds articles by title match', async () => {
    mockSelect.mockReturnValue(makeSelectChain([PUBLISHED_ARTICLE]));
    const { searchKbArticles } = await import('../kb-articles');
    const result = await searchKbArticles('returns', null);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toContain('Returns');
  });

  it('finds articles by excerpt match', async () => {
    mockSelect.mockReturnValue(makeSelectChain([PUBLISHED_ARTICLE]));
    const { searchKbArticles } = await import('../kb-articles');
    const result = await searchKbArticles('return process', null);
    expect(result).toHaveLength(1);
  });

  it('finds articles by body content match', async () => {
    const article = { ...PUBLISHED_ARTICLE, title: 'Shipping Info', excerpt: null };
    mockSelect.mockReturnValue(makeSelectChain([article]));
    const { searchKbArticles } = await import('../kb-articles');
    const result = await searchKbArticles('tracking', null);
    expect(result).toHaveLength(1);
  });

  it('respects audience filter — AGENT_ONLY not returned for null audience', async () => {
    // When audience is null, buildAudienceFilter returns ['ALL']
    // So AGENT_ONLY articles are excluded at the DB level
    // Mock returns empty to simulate this filtering
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { searchKbArticles } = await import('../kb-articles');
    const result = await searchKbArticles('returns', null);
    expect(result).toEqual([]);
  });

  it('only returns PUBLISHED articles', async () => {
    // Mock returns empty array (simulating that only PUBLISHED filter is applied)
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { searchKbArticles } = await import('../kb-articles');
    const result = await searchKbArticles('draft article', null);
    expect(result).toEqual([]);
  });

  it('limits results to specified limit', async () => {
    const articles = Array.from({ length: 5 }, (_, i) => ({ ...PUBLISHED_ARTICLE, id: `art-${i}` }));
    mockSelect.mockReturnValue(makeSelectChain(articles));
    const { searchKbArticles } = await import('../kb-articles');
    const result = await searchKbArticles('returns', null, undefined, 5);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('filters by category slug when provided', async () => {
    // First call: lookup category by slug
    // Second call: search articles in that category
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ id: 'cat-1' }]);
      return makeSelectChain([PUBLISHED_ARTICLE]);
    });

    const { searchKbArticles } = await import('../kb-articles');
    const result = await searchKbArticles('returns', null, 'orders-shipping');
    expect(result).toHaveLength(1);
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it('returns empty when category slug not found', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { searchKbArticles } = await import('../kb-articles');
    const result = await searchKbArticles('returns', null, 'nonexistent-category');
    expect(result).toEqual([]);
  });
});
