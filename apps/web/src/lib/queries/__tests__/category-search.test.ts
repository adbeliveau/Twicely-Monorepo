import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  category: {
    id: 'id', name: 'name', slug: 'slug', parentId: 'parent_id',
    isActive: 'is_active', isLeaf: 'is_leaf', depth: 'depth', sortOrder: 'sort_order',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  isNull: vi.fn((col) => ({ op: 'isNull', col })),
  ilike: vi.fn((col, pat) => ({ op: 'ilike', col, pat })),
  sql: Object.assign(
    (tpl: TemplateStringsArray) => ({ sql: tpl[0] }),
    { as: vi.fn(), join: vi.fn() }
  ),
}));

import { searchCategories, getCategoryById } from '../category-search';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

// Chain for the empty-query path: .from().where().orderBy().limit() → resolves
function makeTopLevelChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['leftJoin'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['orderBy'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(data);
  chain['as'] = vi.fn().mockReturnValue(chain); // for subquery
  return chain;
}

// Chain for the search path: db.select().from().as() acts as a subquery (not awaited directly)
// Then the outer query: .from().leftJoin().where().orderBy().limit()
function makeSubqueryChain() {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['as'] = vi.fn().mockReturnValue(chain);
  chain['id'] = 'cat_id_col';
  chain['name'] = 'cat_name_col';
  return chain;
}

function makeSearchChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['leftJoin'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['orderBy'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(data);
  return chain;
}

const topLevelRows = [
  { id: 'cat-1', name: 'Clothing', slug: 'clothing', parentId: null, isLeaf: false, depth: 0 },
  { id: 'cat-2', name: 'Electronics', slug: 'electronics', parentId: null, isLeaf: false, depth: 0 },
];

describe('searchCategories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns top-level categories when query is empty string', async () => {
    mockSelect.mockReturnValueOnce(makeTopLevelChain(topLevelRows) as never);

    const result = await searchCategories('');
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe('Clothing');
    expect(result[0]!.parentName).toBeNull();
  });

  it('returns top-level categories when query is whitespace only', async () => {
    mockSelect.mockReturnValueOnce(makeTopLevelChain(topLevelRows) as never);

    const result = await searchCategories('   ');
    expect(result).toHaveLength(2);
  });

  it('returns search results with parentName for non-empty query', async () => {
    const searchRows = [
      { id: 'cat-3', name: 'Tops', slug: 'tops', parentId: 'cat-1', parentName: 'Clothing', isLeaf: true, depth: 1 },
      { id: 'cat-4', name: 'Tops & Tees', slug: 'tops-tees', parentId: 'cat-1', parentName: 'Clothing', isLeaf: true, depth: 1 },
    ];
    // First call is the subquery (db.select().from().as())
    mockSelect.mockReturnValueOnce(makeSubqueryChain() as never);
    // Second call is the main search query
    mockSelect.mockReturnValueOnce(makeSearchChain(searchRows) as never);

    const result = await searchCategories('tops');
    expect(result).toHaveLength(2);
    expect(result[0]!.parentName).toBe('Clothing');
    expect(result[0]!.isLeaf).toBe(true);
    expect(result[0]!.depth).toBe(1);
  });

  it('returns empty array when no categories match the query', async () => {
    mockSelect.mockReturnValueOnce(makeSubqueryChain() as never);
    mockSelect.mockReturnValueOnce(makeSearchChain([]) as never);

    const result = await searchCategories('xyznonexistent');
    expect(result).toHaveLength(0);
  });

  it('preserves depth and isLeaf in results', async () => {
    mockSelect.mockReturnValueOnce(makeSubqueryChain() as never);
    mockSelect.mockReturnValueOnce(makeSearchChain([
      { id: 'cat-5', name: 'Sneakers', slug: 'sneakers', parentId: 'cat-shoe', parentName: 'Shoes', isLeaf: true, depth: 2 },
    ]) as never);

    const result = await searchCategories('sneaker');
    expect(result[0]!.isLeaf).toBe(true);
    expect(result[0]!.depth).toBe(2);
  });
});

describe('getCategoryById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when ID not found', async () => {
    // First call: subquery; second call: main query
    mockSelect.mockReturnValueOnce(makeSubqueryChain() as never);
    mockSelect.mockReturnValueOnce(makeSearchChain([]) as never);

    const result = await getCategoryById('nonexistent-id');
    expect(result).toBeNull();
  });

  it('returns category with parentName when parent exists', async () => {
    mockSelect.mockReturnValueOnce(makeSubqueryChain() as never);
    mockSelect.mockReturnValueOnce(makeSearchChain([
      { id: 'cat-3', name: 'Tops', slug: 'tops', parentId: 'cat-1', parentName: 'Clothing', isLeaf: true, depth: 1 },
    ]) as never);

    const result = await getCategoryById('cat-3');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('cat-3');
    expect(result!.parentName).toBe('Clothing');
    expect(result!.isLeaf).toBe(true);
  });

  it('returns category with null parentName for top-level categories', async () => {
    mockSelect.mockReturnValueOnce(makeSubqueryChain() as never);
    mockSelect.mockReturnValueOnce(makeSearchChain([
      { id: 'cat-1', name: 'Clothing', slug: 'clothing', parentId: null, parentName: null, isLeaf: false, depth: 0 },
    ]) as never);

    const result = await getCategoryById('cat-1');
    expect(result!.parentId).toBeNull();
    expect(result!.parentName).toBeNull();
    expect(result!.depth).toBe(0);
  });
});
