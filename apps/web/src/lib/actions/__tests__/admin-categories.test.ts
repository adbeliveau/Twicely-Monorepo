import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockTransaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
  return fn({ insert: mockInsert, update: mockUpdate, select: mockSelect, delete: mockDelete });
});
const mockDb = { insert: mockInsert, update: mockUpdate, select: mockSelect, delete: mockDelete, transaction: mockTransaction };
const mockStaffAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

function makeInsertChain(returning: unknown[] = []) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
}

function makeDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue([]),
  };
}

function makeAdminSession() {
  return {
    session: { staffUserId: 'staff-admin-001', isPlatformStaff: true as const, platformRoles: ['ADMIN' as const] },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeModSession() {
  return {
    session: { staffUserId: 'staff-mod-001', isPlatformStaff: true as const, platformRoles: ['MODERATION' as const] },
    ability: {
      can: vi.fn().mockImplementation((action: string, subject: string) =>
        action === 'read' && subject === 'Category'
      ),
    },
  };
}

const CAT_ID = 'cat-test-001';
const SCHEMA_ID = 'schema-test-001';

const validCreate = {
  name: 'Electronics',
  slug: 'electronics',
  feeBucket: 'ELECTRONICS' as const,
  sortOrder: 0,
  isActive: true,
  isLeaf: false,
};

// ─── createCategory ───────────────────────────────────────────────────────────

describe('createCategory', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for non-admin (MODERATION)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeModSession());
    const { createCategory } = await import('../admin-categories');
    const result = await createCategory(validCreate);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  }, 15000);

  it('rejects invalid slug format (uppercase, spaces)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const { createCategory } = await import('../admin-categories');
    const result = await createCategory({ ...validCreate, slug: 'Bad Slug' });
    expect(result.success).toBe(false);
  });

  it('creates root category with depth=0 and path=slug', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockInsert.mockReturnValue(makeInsertChain([{ id: CAT_ID }]));
    const { createCategory } = await import('../admin-categories');
    const result = await createCategory(validCreate);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(CAT_ID);
    const insertChain = mockInsert.mock.results[0]?.value;
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 0, path: 'electronics', parentId: null })
    );
  });

  it('creates child category with computed depth and path from parent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return makeSelectChain([{ id: 'parent-001', depth: 0, path: 'electronics', isLeaf: false }]);
      }
      return makeSelectChain([]);
    });
    mockInsert.mockReturnValue(makeInsertChain([{ id: CAT_ID }]));
    const { createCategory } = await import('../admin-categories');
    const result = await createCategory({ ...validCreate, slug: 'phones', parentId: 'parent-001' });
    expect(result.success).toBe(true);
    const insertChain = mockInsert.mock.results[0]?.value;
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 1, path: 'electronics.phones', parentId: 'parent-001' })
    );
  });

  it('sets parent isLeaf to false when adding first child', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return makeSelectChain([{ id: 'parent-001', depth: 0, path: 'electronics', isLeaf: true }]);
      }
      return makeSelectChain([]);
    });
    mockInsert.mockReturnValue(makeInsertChain([{ id: CAT_ID }]));
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);
    const { createCategory } = await import('../admin-categories');
    await createCategory({ ...validCreate, slug: 'phones', parentId: 'parent-001' });
    expect(mockUpdate).toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ isLeaf: false }));
  });

  it('rejects unknown keys in input (strict mode)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const { createCategory } = await import('../admin-categories');
    const result = await createCategory({ ...validCreate, unknownKey: 'test' });
    expect(result.success).toBe(false);
  });
});

// ─── updateCategory ───────────────────────────────────────────────────────────

describe('updateCategory', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for non-admin', async () => {
    mockStaffAuthorize.mockResolvedValue(makeModSession());
    const { updateCategory } = await import('../admin-categories');
    const result = await updateCategory({ id: CAT_ID, name: 'New Name' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('updates name and slug fields', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(
      makeSelectChain([{ id: CAT_ID, path: 'electronics', depth: 0, parentId: null, slug: 'electronics' }])
    );
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);
    const { updateCategory } = await import('../admin-categories');
    const result = await updateCategory({ id: CAT_ID, name: 'Updated', slug: 'updated' });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated', slug: 'updated', updatedAt: expect.any(Date) })
    );
  });

  it('recomputes path when parentId changes', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([{ id: CAT_ID, path: 'phones', depth: 1, parentId: 'old-parent', slug: 'phones' }]);
      if (selectCall === 2) return makeSelectChain([{ id: 'new-parent', path: 'electronics', depth: 0 }]);
      return makeSelectChain([]);
    });
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);
    const { updateCategory } = await import('../admin-categories');
    const result = await updateCategory({ id: CAT_ID, parentId: 'new-parent' });
    expect(result.success).toBe(true);
  });

  it('rejects circular parent reference (self)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(
      makeSelectChain([{ id: CAT_ID, path: 'electronics', depth: 0, parentId: null, slug: 'electronics' }])
    );
    const { updateCategory } = await import('../admin-categories');
    const result = await updateCategory({ id: CAT_ID, parentId: CAT_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('own parent');
  });

  it('rejects circular parent reference (descendant via path check)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([{ id: CAT_ID, path: 'electronics', depth: 0, parentId: null, slug: 'electronics' }]);
      if (selectCall === 2) return makeSelectChain([{ id: 'child-001', path: 'electronics.phones', depth: 1 }]);
      return makeSelectChain([]);
    });
    const { updateCategory } = await import('../admin-categories');
    const result = await updateCategory({ id: CAT_ID, parentId: 'child-001' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('circular');
  });

  it('always sets updatedAt', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(
      makeSelectChain([{ id: CAT_ID, path: 'electronics', depth: 0, parentId: null, slug: 'electronics' }])
    );
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);
    const { updateCategory } = await import('../admin-categories');
    await updateCategory({ id: CAT_ID, name: 'Test' });
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) })
    );
  });
});

// ─── deleteCategory ───────────────────────────────────────────────────────────

describe('deleteCategory', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for non-admin', async () => {
    mockStaffAuthorize.mockResolvedValue(makeModSession());
    const { deleteCategory } = await import('../admin-categories');
    const result = await deleteCategory(CAT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('refuses to deactivate category with active listings (returns count)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([{ id: CAT_ID }]);
      if (selectCall === 2) return makeSelectChain([{ cnt: 3 }]);
      return makeSelectChain([{ cnt: 0 }]);
    });
    const { deleteCategory } = await import('../admin-categories');
    const result = await deleteCategory(CAT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain('3 active listing');
  });

  it('refuses to deactivate category with active subcategories (returns count)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([{ id: CAT_ID }]);
      if (selectCall === 2) return makeSelectChain([{ cnt: 0 }]);
      return makeSelectChain([{ cnt: 2 }]);
    });
    const { deleteCategory } = await import('../admin-categories');
    const result = await deleteCategory(CAT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain('2 active subcategory');
  });

  it('soft-deletes category (sets isActive=false, not hard-delete)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([{ id: CAT_ID }]);
      return makeSelectChain([{ cnt: 0 }]);
    });
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);
    const { deleteCategory } = await import('../admin-categories');
    const result = await deleteCategory(CAT_ID);
    expect(result.success).toBe(true);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false })
    );
  });

  it('returns not found for nonexistent category', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { deleteCategory } = await import('../admin-categories');
    const result = await deleteCategory(CAT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found.');
  });
});

// ─── reorderCategories ────────────────────────────────────────────────────────

describe('reorderCategories', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for non-admin', async () => {
    mockStaffAuthorize.mockResolvedValue(makeModSession());
    const { reorderCategories } = await import('../admin-categories');
    const result = await reorderCategories({ orderedIds: ['a', 'b'] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('updates sortOrder for each ID in array order', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);
    const { reorderCategories } = await import('../admin-categories');
    const result = await reorderCategories({ orderedIds: ['cat-a', 'cat-b', 'cat-c'] });
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });
});

// ─── createAttributeSchema ───────────────────────────────────────────────────

describe('createAttributeSchema', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  const validAttr = {
    categoryId: 'cat-001',
    name: 'brand',
    label: 'Brand',
    fieldType: 'text' as const,
    isRequired: false,
    isRecommended: false,
    showInFilters: false,
    showInListing: true,
    optionsJson: [],
    validationJson: {},
    sortOrder: 0,
  };

  it('returns access denied for non-admin', async () => {
    mockStaffAuthorize.mockResolvedValue(makeModSession());
    const { createAttributeSchema } = await import('../admin-categories');
    const result = await createAttributeSchema(validAttr);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('creates attribute schema with all fields mapped explicitly', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockInsert.mockReturnValue(makeInsertChain([{ id: SCHEMA_ID }]));
    const { createAttributeSchema } = await import('../admin-categories');
    const result = await createAttributeSchema(validAttr);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(SCHEMA_ID);
    const insertChain = mockInsert.mock.results[0]?.value;
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'brand', label: 'Brand', fieldType: 'text' })
    );
  });

  it('rejects invalid fieldType value', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const { createAttributeSchema } = await import('../admin-categories');
    const result = await createAttributeSchema({ ...validAttr, fieldType: 'invalid' });
    expect(result.success).toBe(false);
  });
});

// ─── updateAttributeSchema ───────────────────────────────────────────────────

describe('updateAttributeSchema', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates only specified fields, always sets updatedAt', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);
    const { updateAttributeSchema } = await import('../admin-categories');
    const result = await updateAttributeSchema({ id: SCHEMA_ID, label: 'Updated Label' });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Updated Label', updatedAt: expect.any(Date) })
    );
    expect(updateChain.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.anything() })
    );
  });
});

// ─── deleteAttributeSchema ───────────────────────────────────────────────────

describe('deleteAttributeSchema', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('hard-deletes attribute schema row', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(makeSelectChain([{ id: SCHEMA_ID }]));
    const deleteChain = makeDeleteChain();
    mockDelete.mockReturnValue(deleteChain);
    const { deleteAttributeSchema } = await import('../admin-categories');
    const result = await deleteAttributeSchema(SCHEMA_ID);
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('returns not found for nonexistent schema', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { deleteAttributeSchema } = await import('../admin-categories');
    const result = await deleteAttributeSchema(SCHEMA_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found.');
  });
});
