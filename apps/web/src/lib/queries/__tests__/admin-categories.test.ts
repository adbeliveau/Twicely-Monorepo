import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  category: {
    id: 'id', name: 'name', slug: 'slug', parentId: 'parent_id',
    feeBucket: 'fee_bucket', sortOrder: 'sort_order', isActive: 'is_active',
    isLeaf: 'is_leaf', depth: 'depth', path: 'path', description: 'description',
    icon: 'icon', metaTitle: 'meta_title', metaDescription: 'meta_description',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
  categoryAttributeSchema: {
    id: 'id', categoryId: 'category_id', name: 'name', label: 'label',
    fieldType: 'field_type', isRequired: 'is_required', isRecommended: 'is_recommended',
    showInFilters: 'show_in_filters', showInListing: 'show_in_listing',
    optionsJson: 'options_json', validationJson: 'validation_json', sortOrder: 'sort_order',
  },
  listing: { categoryId: 'category_id', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (_a: unknown, _b: unknown) => ({ type: 'eq' }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  ilike: (_a: unknown, _b: unknown) => ({ type: 'ilike' }),
  isNull: (_a: unknown) => ({ type: 'isNull' }),
  count: () => ({ type: 'count' }),
  sql: Object.assign((_tpl: unknown) => ({ type: 'sql' }), { raw: (_s: unknown) => ({ type: 'sql' }) }),
  like: (_a: unknown, _b: unknown) => ({ type: 'like' }),
}));

function makeChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'limit', 'offset', 'groupBy'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);
  return chain;
}

const NOW = new Date('2026-01-01T00:00:00Z');

function makeCategoryRow(id: string, parentId: string | null, extra: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    name: `Category ${id}`,
    slug: `category-${id}`,
    parentId,
    feeBucket: 'ELECTRONICS',
    sortOrder: 0,
    isActive: true,
    isLeaf: parentId !== null,
    depth: parentId ? 1 : 0,
    path: parentId ? `root.category-${id}` : `category-${id}`,
    description: null,
    icon: null,
    metaTitle: null,
    metaDescription: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  };
}

// ─── getAdminCategoryTree ──────────────────────────────────────────────────────

describe('getAdminCategoryTree', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns all categories including inactive', async () => {
    const inactiveRow = makeCategoryRow('cat-inactive', null, { isActive: false });
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([makeCategoryRow('cat-root', null), inactiveRow]);
      if (callCount === 2) return makeChain([]);
      return makeChain([]);
    });
    const { getAdminCategoryTree } = await import('../admin-categories');
    const result = await getAdminCategoryTree();
    expect(result.length).toBe(2);
    expect(result.some((r) => !r.isActive)).toBe(true);
  });

  it('builds correct tree structure with nested children', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain([
          makeCategoryRow('root-1', null),
          makeCategoryRow('child-1', 'root-1'),
        ]);
      }
      return makeChain([]);
    });
    const { getAdminCategoryTree } = await import('../admin-categories');
    const result = await getAdminCategoryTree();
    expect(result.length).toBe(1);
    expect(result[0]!.children.length).toBe(1);
    expect(result[0]!.children[0]!.id).toBe('child-1');
  });

  it('includes listing counts per category', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([makeCategoryRow('cat-1', null)]);
      if (callCount === 2) return makeChain([{ categoryId: 'cat-1', cnt: 5 }]);
      return makeChain([]);
    });
    const { getAdminCategoryTree } = await import('../admin-categories');
    const result = await getAdminCategoryTree();
    expect(result[0]!.listingCount).toBe(5);
  });

  it('includes attribute schema counts per category', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([makeCategoryRow('cat-1', null)]);
      if (callCount === 2) return makeChain([]);
      if (callCount === 3) return makeChain([{ categoryId: 'cat-1', cnt: 3 }]);
      return makeChain([]);
    });
    const { getAdminCategoryTree } = await import('../admin-categories');
    const result = await getAdminCategoryTree();
    expect(result[0]!.attributeSchemaCount).toBe(3);
  });
});

// ─── getAdminCategoryById ──────────────────────────────────────────────────────

describe('getAdminCategoryById', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns null for non-existent ID', async () => {
    mockDbSelect.mockImplementation(() => makeChain([]));
    const { getAdminCategoryById } = await import('../admin-categories');
    const result = await getAdminCategoryById('nonexistent');
    expect(result).toBeNull();
  });

  it('returns full detail with children and attribute schemas', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([makeCategoryRow('cat-1', null)]);
      if (callCount === 2) return makeChain([]);
      if (callCount === 3) return makeChain([makeCategoryRow('child-1', 'cat-1')]);
      if (callCount === 4) {
        return makeChain([{
          id: 'schema-1', name: 'brand', label: 'Brand', fieldType: 'text',
          isRequired: false, isRecommended: false, showInFilters: false,
          showInListing: true, optionsJson: [], validationJson: {}, sortOrder: 0,
        }]);
      }
      return makeChain([{ cnt: 0 }]);
    });
    const { getAdminCategoryById } = await import('../admin-categories');
    const result = await getAdminCategoryById('cat-1');
    expect(result).not.toBeNull();
    expect(result!.attributeSchemas.length).toBe(1);
  });

  it('includes parent name when category has a parent', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([makeCategoryRow('cat-child', 'cat-root')]);
      if (callCount === 2) return makeChain([{ id: 'cat-root', name: 'Root Category' }]);
      if (callCount === 3) return makeChain([]);
      if (callCount === 4) return makeChain([]);
      return makeChain([{ cnt: 0 }]);
    });
    const { getAdminCategoryById } = await import('../admin-categories');
    const result = await getAdminCategoryById('cat-child');
    expect(result!.parentName).toBe('Root Category');
  });
});

// ─── getAdminCatalogBrowser ───────────────────────────────────────────────────

describe('getAdminCatalogBrowser', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns paginated results with correct page/totalPages', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([makeCategoryRow('cat-1', null)]);
      if (callCount === 2) return makeChain([{ cnt: 75 }]);
      if (callCount === 3) return makeChain([]);
      return makeChain([]);
    });
    const { getAdminCatalogBrowser } = await import('../admin-categories');
    const result = await getAdminCatalogBrowser({ page: 1, pageSize: 50 });
    expect(result.page).toBe(1);
    expect(result.totalCount).toBe(75);
    expect(result.totalPages).toBe(2);
  });

  it('filters by search term (name ILIKE)', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([]);
      if (callCount === 2) return makeChain([{ cnt: 0 }]);
      return makeChain([]);
    });
    const { getAdminCatalogBrowser } = await import('../admin-categories');
    const result = await getAdminCatalogBrowser({ search: 'electronics' });
    expect(result.categories).toEqual([]);
  });

  it('filters by isActive flag', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([makeCategoryRow('cat-active', null)]);
      if (callCount === 2) return makeChain([{ cnt: 1 }]);
      return makeChain([]);
    });
    const { getAdminCatalogBrowser } = await import('../admin-categories');
    const result = await getAdminCatalogBrowser({ isActive: true });
    expect(result.categories[0]?.isActive).toBe(true);
  });

  it('filters by feeBucket enum value', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([makeCategoryRow('cat-1', null, { feeBucket: 'ELECTRONICS' })]);
      if (callCount === 2) return makeChain([{ cnt: 1 }]);
      return makeChain([]);
    });
    const { getAdminCatalogBrowser } = await import('../admin-categories');
    const result = await getAdminCatalogBrowser({ feeBucket: 'ELECTRONICS' });
    expect(result.categories[0]?.feeBucket).toBe('ELECTRONICS');
  });

  it('filters by parentId (null for roots only)', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([makeCategoryRow('root-1', null)]);
      if (callCount === 2) return makeChain([{ cnt: 1 }]);
      return makeChain([]);
    });
    const { getAdminCatalogBrowser } = await import('../admin-categories');
    const result = await getAdminCatalogBrowser({ parentId: null });
    expect(result.categories[0]?.parentId).toBeNull();
  });
});
