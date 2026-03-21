import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockDb = {
  select: mockDbSelect,
  update: mockDbUpdate,
  insert: vi.fn(),
  delete: mockDbDelete,
  transaction: vi.fn(async (cb: (tx: { update: typeof mockDbUpdate }) => Promise<void>) => {
    await cb({ update: mockDbUpdate });
  }),
};

const mockAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (type: string, conditions: Record<string, unknown>) => ({ ...conditions, __caslSubjectType__: type }),
}));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Chain helper
function createChainableMock(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  };
  return chain;
}

describe('unpublishPage', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { unpublishPage } = await import('../storefront-pages');
    const result = await unpublishPage('p-1');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  }, 15000);

  it('succeeds for owned page', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'p-1' }]));
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    const { unpublishPage } = await import('../storefront-pages');
    const result = await unpublishPage('p-1');
    expect(result.success).toBe(true);
  });
});

describe('deletePage', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { deletePage } = await import('../storefront-pages');
    const result = await deletePage('p-1');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when page not found', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
    mockDbSelect.mockReturnValueOnce(createChainableMock([]));
    const { deletePage } = await import('../storefront-pages');
    const result = await deletePage('nonexistent');
    expect(result).toEqual({ success: false, error: 'Page not found' });
  });

  it('succeeds for owned page', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'p-1' }]));
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const { deletePage } = await import('../storefront-pages');
    const result = await deletePage('p-1');
    expect(result.success).toBe(true);
  });
});

describe('reorderPages', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { reorderPages } = await import('../storefront-pages');
    const result = await reorderPages({ pageIds: ['p-1', 'p-2'] });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('rejects for seller below POWER tier', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'PRO', storeSlug: 'test' }])
    );
    const { reorderPages } = await import('../storefront-pages');
    const result = await reorderPages({ pageIds: ['p-1', 'p-2'] });
    expect(result).toEqual({ success: false, error: 'Page builder requires Power plan or higher' });
  });

  it('succeeds for POWER seller', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    const { reorderPages } = await import('../storefront-pages');
    const result = await reorderPages({ pageIds: ['p-2', 'p-1'] });
    expect(result.success).toBe(true);
  });
});
