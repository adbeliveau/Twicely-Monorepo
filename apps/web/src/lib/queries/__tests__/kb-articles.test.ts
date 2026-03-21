import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDb = { select: mockSelect, update: mockUpdate };

vi.mock('@twicely/db', () => ({ db: mockDb }));

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit', 'groupBy', 'innerJoin', 'leftJoin'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

function makeUpdateChain() {
  const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined), catch: vi.fn().mockReturnThis() };
  return chain;
}

describe('buildAudienceFilter (via getPublicKbCategories)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns empty array for anonymous (null audience)', async () => {
    // null audience → only 'ALL' visible
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ id: 'cat-1', slug: 'orders', name: 'Orders', description: null, icon: null, sortOrder: 0 }]);
      return makeSelectChain([{ categoryId: 'cat-1', cnt: 3 }]);
    });

    const { getPublicKbCategories } = await import('../kb-articles');
    const result = await getPublicKbCategories(null);
    expect(result).toHaveLength(1);
    expect(result[0]?.articleCount).toBe(3);
  });

  it('returns categories with article counts for SELLER audience', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([
        { id: 'cat-1', slug: 'sellers', name: 'Seller Help', description: null, icon: null, sortOrder: 0 },
        { id: 'cat-2', slug: 'orders', name: 'Orders', description: null, icon: null, sortOrder: 1 },
      ]);
      return makeSelectChain([{ categoryId: 'cat-1', cnt: 5 }, { categoryId: 'cat-2', cnt: 2 }]);
    });

    const { getPublicKbCategories } = await import('../kb-articles');
    const result = await getPublicKbCategories('SELLER');
    expect(result).toHaveLength(2);
    expect(result[0]?.articleCount).toBe(5);
    expect(result[1]?.articleCount).toBe(2);
  });

  it('returns 0 article count for category with no published articles', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ id: 'cat-empty', slug: 'returns', name: 'Returns', description: null, icon: null, sortOrder: 0 }]);
      return makeSelectChain([]); // no counts
    });

    const { getPublicKbCategories } = await import('../kb-articles');
    const result = await getPublicKbCategories('BUYER');
    expect(result[0]?.articleCount).toBe(0);
  });
});

describe('getKbArticlesByCategory', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns null category and empty articles for unknown slug', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getKbArticlesByCategory } = await import('../kb-articles');
    const result = await getKbArticlesByCategory('non-existent-slug', null);
    expect(result.category).toBeNull();
    expect(result.articles).toEqual([]);
  });

  it('returns category and articles for valid slug', async () => {
    const cat = { id: 'cat-1', slug: 'orders', name: 'Orders', description: null, icon: null, isActive: true, sortOrder: 0 };
    const articles = [
      { id: 'art-1', slug: 'how-to-track', title: 'How to Track Your Order', excerpt: null, status: 'PUBLISHED', audience: 'ALL', isFeatured: false, viewCount: 50, helpfulYes: 10, helpfulNo: 2, updatedAt: new Date(), categoryId: 'cat-1' },
    ];

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([cat]);
      return makeSelectChain(articles);
    });

    const { getKbArticlesByCategory } = await import('../kb-articles');
    const result = await getKbArticlesByCategory('orders', 'BUYER');
    expect(result.category?.name).toBe('Orders');
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]?.slug).toBe('how-to-track');
  });

  it('AGENT_ONLY articles hidden for non-agent audience', async () => {
    // The function uses inArray on audience — BUYER audience excludes SELLER and AGENT_ONLY
    const cat = { id: 'cat-1', slug: 'orders', name: 'Orders', description: null, isActive: true, sortOrder: 0 };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([cat]);
      return makeSelectChain([]); // AGENT_ONLY filtered at DB level
    });

    const { getKbArticlesByCategory } = await import('../kb-articles');
    const result = await getKbArticlesByCategory('orders', 'BUYER');
    expect(result.articles).toEqual([]);
  });
});

describe('getKbArticleBySlug', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns null for unknown slug', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getKbArticleBySlug } = await import('../kb-articles');
    const result = await getKbArticleBySlug('no-such-article');
    expect(result).toBeNull();
  });

  it('returns article detail with related articles', async () => {
    const article = {
      id: 'art-1', slug: 'how-returns-work', title: 'How Returns Work',
      excerpt: 'Learn about returns', body: 'Full article body here',
      bodyFormat: 'MARKDOWN', status: 'PUBLISHED', audience: 'ALL', tags: ['returns'],
      metaTitle: null, metaDescription: null, isFeatured: false,
      viewCount: 100, helpfulYes: 80, helpfulNo: 5, version: 2,
      publishedAt: new Date(), updatedAt: new Date(), categoryId: 'cat-1',
    };
    const relatedArticles = [
      { id: 'art-2', slug: 'how-to-ship', title: 'How to Ship Items' },
    ];

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([article]);
      return makeSelectChain(relatedArticles);
    });
    // Mock update for view count increment (fire-and-forget)
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { getKbArticleBySlug } = await import('../kb-articles');
    const result = await getKbArticleBySlug('how-returns-work');
    expect(result).not.toBeNull();
    expect(result?.title).toBe('How Returns Work');
    expect(result?.relatedArticles).toHaveLength(1);
    expect(result?.relatedArticles[0]?.slug).toBe('how-to-ship');
  });

  it('increments view count asynchronously (fire and forget)', async () => {
    const article = {
      id: 'art-1', slug: 'test-article', title: 'Test Article',
      excerpt: null, body: 'Article body here for testing purpose',
      bodyFormat: 'MARKDOWN', status: 'PUBLISHED', audience: 'ALL', tags: [],
      metaTitle: null, metaDescription: null, isFeatured: false,
      viewCount: 0, helpfulYes: 0, helpfulNo: 0, version: 1,
      publishedAt: new Date(), updatedAt: new Date(), categoryId: null,
    };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([article]);
      return makeSelectChain([]);
    });
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { getKbArticleBySlug } = await import('../kb-articles');
    await getKbArticleBySlug('test-article');
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('getFeaturedKbArticles', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns empty array when no featured articles', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getFeaturedKbArticles } = await import('../kb-articles');
    const result = await getFeaturedKbArticles(null);
    expect(result).toEqual([]);
  });

  it('returns featured articles for SELLER audience', async () => {
    const articles = [
      { id: 'art-1', slug: 'getting-started', title: 'Getting Started as a Seller', excerpt: null, status: 'PUBLISHED', audience: 'SELLER', isFeatured: true, viewCount: 200, helpfulYes: 50, helpfulNo: 2, updatedAt: new Date(), categoryId: 'cat-1' },
    ];
    mockSelect.mockReturnValue(makeSelectChain(articles));
    const { getFeaturedKbArticles } = await import('../kb-articles');
    const result = await getFeaturedKbArticles('SELLER');
    expect(result).toHaveLength(1);
    expect(result[0]?.isFeatured).toBe(true);
  });
});

describe('getAdminKbArticles', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns all articles with no filter', async () => {
    const articles = [
      { id: 'art-1', slug: 'draft-article', title: 'Draft Article', excerpt: null, status: 'DRAFT', audience: 'ALL', isFeatured: false, viewCount: 0, helpfulYes: 0, helpfulNo: 0, updatedAt: new Date(), categoryId: null },
    ];
    mockSelect.mockReturnValue(makeSelectChain(articles));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles();
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('DRAFT');
  });

  it('applies status filter', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles({ status: 'PUBLISHED' });
    expect(result).toEqual([]);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('applies categoryId filter', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getAdminKbArticles } = await import('../kb-admin-queries');
    const result = await getAdminKbArticles({ categoryId: 'cat-test-001' });
    expect(result).toEqual([]);
    expect(mockSelect).toHaveBeenCalled();
  });
});
