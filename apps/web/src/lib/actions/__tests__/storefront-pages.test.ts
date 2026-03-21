import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDb = {
  select: mockDbSelect,
  update: mockDbUpdate,
  insert: mockDbInsert,
  delete: vi.fn(),
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
function createChainableMock(result: unknown[], noLimit = false) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: noLimit ? vi.fn().mockResolvedValue(result) : vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  };
  return chain;
}

describe('createPage', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { createPage } = await import('../storefront-pages');
    const result = await createPage({ title: 'Test', slug: 'test' });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when no seller profile', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(createChainableMock([]));
    const { createPage } = await import('../storefront-pages');
    const result = await createPage({ title: 'Test', slug: 'test' });
    expect(result).toEqual({ success: false, error: 'Seller profile required' });
  });

  it('rejects for PERSONAL seller', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([{ id: 'sp-1', sellerType: 'PERSONAL', storeTier: 'NONE', storeSlug: null }])
    );
    const { createPage } = await import('../storefront-pages');
    const result = await createPage({ title: 'Test', slug: 'test' });
    expect(result).toEqual({ success: false, error: 'Business seller status required' });
  });

  it('rejects for seller below POWER tier', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'PRO', storeSlug: 'test' }])
    );
    const { createPage } = await import('../storefront-pages');
    const result = await createPage({ title: 'Test', slug: 'test' });
    expect(result).toEqual({ success: false, error: 'Page builder requires Power plan or higher' });
  });

  it('rejects invalid slug (single char)', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    const { createPage } = await import('../storefront-pages');
    const result = await createPage({ title: 'Test', slug: 'a' });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    const { createPage } = await import('../storefront-pages');
    const result = await createPage({ title: '', slug: 'about-us' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with uppercase letters', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    const { createPage } = await import('../storefront-pages');
    const result = await createPage({ title: 'Test', slug: 'About-Us' });
    expect(result.success).toBe(false);
  });

  it('rejects title over 100 chars', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    const { createPage } = await import('../storefront-pages');
    const result = await createPage({ title: 'A'.repeat(101), slug: 'about-us' });
    expect(result.success).toBe(false);
  });
});

describe('savePuckData', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { savePuckData } = await import('../storefront-pages');
    const result = await savePuckData({ pageId: 'p-1', puckData: {} });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when no seller profile', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(createChainableMock([]));
    const { savePuckData } = await import('../storefront-pages');
    const result = await savePuckData({ pageId: 'p-1', puckData: {} });
    expect(result).toEqual({ success: false, error: 'Seller profile required' });
  });

  it('returns error when no storefront found', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    mockDbSelect.mockReturnValueOnce(createChainableMock([]));
    const { savePuckData } = await import('../storefront-pages');
    const result = await savePuckData({ pageId: 'p-1', puckData: {} });
    expect(result).toEqual({ success: false, error: 'No storefront found' });
  });

  it('returns error when page not found', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
    mockDbSelect.mockReturnValueOnce(createChainableMock([]));
    const { savePuckData } = await import('../storefront-pages');
    const result = await savePuckData({ pageId: 'p-1', puckData: {} });
    expect(result).toEqual({ success: false, error: 'Page not found' });
  });

  it('succeeds when page belongs to owner', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'p-1' }]));
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    const { savePuckData } = await import('../storefront-pages');
    const result = await savePuckData({ pageId: 'p-1', puckData: { content: [] } });
    expect(result.success).toBe(true);
  });
});

describe('publishPage', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { publishPage } = await import('../storefront-pages');
    const result = await publishPage('p-1');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when page not found', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
    mockDbSelect.mockReturnValueOnce(createChainableMock([]));
    const { publishPage } = await import('../storefront-pages');
    const result = await publishPage('nonexistent');
    expect(result).toEqual({ success: false, error: 'Page not found' });
  });

  it('succeeds when page found and owned', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'POWER', storeSlug: 'test' }])
    );
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'p-1' }]));
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    const { publishPage } = await import('../storefront-pages');
    const result = await publishPage('p-1');
    expect(result.success).toBe(true);
  });
});
