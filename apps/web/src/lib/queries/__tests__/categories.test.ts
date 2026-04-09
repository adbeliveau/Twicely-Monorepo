import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  category: {
    id: 'id', name: 'name', slug: 'slug', description: 'description',
    parentId: 'parent_id', isActive: 'is_active', sortOrder: 'sort_order',
    isLeaf: 'is_leaf', depth: 'depth',
  },
  listing: { categoryId: 'category_id', status: 'status' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  sql: Object.assign(
    (tpl: TemplateStringsArray) => ({ sql: tpl[0], as: (a: string) => ({ sql: tpl[0], alias: a }) }),
    { as: vi.fn(), join: vi.fn() }
  ),
}));
vi.mock('react', () => ({ cache: (fn: unknown) => fn }));

import { getCategoryTree, getCategoryBySlug, getSubcategory } from '../categories';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

function makeChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['orderBy'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(data);
  chain['groupBy'] = vi.fn().mockResolvedValue(data);
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve);
  return chain;
}

describe('getCategoryTree', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty tree when no categories exist', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([]) as never) // categories
      .mockReturnValueOnce(makeChain([]) as never); // counts

    const result = await getCategoryTree();
    expect(result).toHaveLength(0);
  });

  it('builds tree with top-level categories and children', async () => {
    const cats = [
      { id: 'cat-1', name: 'Clothing', slug: 'clothing', description: null, parentId: null },
      { id: 'cat-2', name: 'Tops', slug: 'tops', description: null, parentId: 'cat-1' },
      { id: 'cat-3', name: 'Bottoms', slug: 'bottoms', description: null, parentId: 'cat-1' },
      { id: 'cat-4', name: 'Shoes', slug: 'shoes', description: null, parentId: null },
    ];
    const counts = [
      { categoryId: 'cat-2', count: 50 },
      { categoryId: 'cat-3', count: 30 },
    ];
    mockSelect
      .mockReturnValueOnce(makeChain(cats) as never)
      .mockReturnValueOnce(makeChain(counts) as never);

    const result = await getCategoryTree();
    expect(result).toHaveLength(2); // Clothing and Shoes are top-level
    const clothing = result.find((c) => c.id === 'cat-1');
    expect(clothing?.children).toHaveLength(2);
    const tops = clothing?.children?.find((c) => c.id === 'cat-2');
    expect(tops?.listingCount).toBe(50);
  });

  it('uses 0 as default listingCount when category has no active listings', async () => {
    const cats = [
      { id: 'cat-1', name: 'Electronics', slug: 'electronics', description: null, parentId: null },
      { id: 'cat-2', name: 'Phones', slug: 'phones', description: null, parentId: 'cat-1' },
    ];
    mockSelect
      .mockReturnValueOnce(makeChain(cats) as never)
      .mockReturnValueOnce(makeChain([]) as never); // no counts

    const result = await getCategoryTree();
    const electronics = result.find((c) => c.id === 'cat-1');
    const phones = electronics?.children?.find((c) => c.id === 'cat-2');
    expect(phones?.listingCount).toBe(0);
  });
});

describe('getCategoryBySlug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null for unknown slug', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);
    const result = await getCategoryBySlug('unknown-slug');
    expect(result).toBeNull();
  });

  it('returns category with children and listing counts', async () => {
    const catRow = { id: 'cat-1', name: 'Clothing', slug: 'clothing', description: null, parentId: null };
    mockSelect
      .mockReturnValueOnce(makeChain([catRow]) as never) // category
      .mockReturnValueOnce(makeChain([
        { id: 'cat-2', name: 'Tops', slug: 'tops' },
        { id: 'cat-3', name: 'Bottoms', slug: 'bottoms' },
      ]) as never) // children
      .mockReturnValueOnce(makeChain([
        { categoryId: 'cat-2', count: 42 },
      ]) as never); // counts

    const result = await getCategoryBySlug('clothing');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('cat-1');
    expect(result!.name).toBe('Clothing');
    expect(result!.children).toHaveLength(2);
    expect(result!.children!.find((c) => c.id === 'cat-2')?.listingCount).toBe(42);
    expect(result!.children!.find((c) => c.id === 'cat-3')?.listingCount).toBe(0);
  });
});

describe('getSubcategory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when parent slug not found', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);
    const result = await getSubcategory('nonexistent', 'child');
    expect(result).toBeNull();
  });

  it('returns null when child slug not found under parent', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ id: 'cat-1' }]) as never) // parent found
      .mockReturnValueOnce(makeChain([]) as never); // child not found

    const result = await getSubcategory('clothing', 'nonexistent-child');
    expect(result).toBeNull();
  });

  it('returns subcategory with siblings as children', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ id: 'cat-1' }]) as never) // parent
      .mockReturnValueOnce(makeChain([{ id: 'cat-2', name: 'Tops', slug: 'tops', description: null, parentId: 'cat-1' }]) as never) // child
      .mockReturnValueOnce(makeChain([
        { id: 'cat-2', name: 'Tops', slug: 'tops' },
        { id: 'cat-3', name: 'Bottoms', slug: 'bottoms' },
      ]) as never) // siblings
      .mockReturnValueOnce(makeChain([{ categoryId: 'cat-2', count: 15 }]) as never); // counts

    const result = await getSubcategory('clothing', 'tops');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('cat-2');
    expect(result!.children).toHaveLength(2);
    expect(result!.children?.find((s) => s.id === 'cat-2')?.listingCount).toBe(15);
  });
});
