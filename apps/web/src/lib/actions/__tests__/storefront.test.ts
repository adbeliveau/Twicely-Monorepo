import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
const mockDb = {
  select: mockDbSelect,
  update: mockDbUpdate,
  insert: mockDbInsert,
  delete: mockDbDelete,
};

const mockAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (type: string, conditions: Record<string, unknown>) => ({ ...conditions, __caslSubjectType__: type }),
}));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Chain helper for drizzle-style queries
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

describe('updateStorefrontSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { updateStorefrontSettings } = await import('../storefront');
    const result = await updateStorefrontSettings({ storeName: 'Test' });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when no seller profile', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(createChainableMock([]));

    const { updateStorefrontSettings } = await import('../storefront');
    const result = await updateStorefrontSettings({ storeName: 'Test' });

    expect(result).toEqual({ success: false, error: 'Seller profile required' });
  });

  it('allows BUSINESS seller with NONE tier to update storeName', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'NONE', storeSlug: 'my-store', storeName: null },
      ])
    );
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { updateStorefrontSettings } = await import('../storefront');
    const result = await updateStorefrontSettings({ storeName: 'My Store' });

    expect(result.success).toBe(true);
  });

  it('rejects announcement for NONE tier seller', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'NONE', storeSlug: 'my-store', storeName: 'Test' },
      ])
    );

    const { updateStorefrontSettings } = await import('../storefront');
    const result = await updateStorefrontSettings({ announcement: 'Big sale!' });

    expect(result).toEqual({ success: false, error: 'Announcement bar requires Starter plan or higher' });
  });

  it('allows STARTER tier seller to set announcement', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'STARTER', storeSlug: 'my-store', storeName: 'Test' },
      ])
    );
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { updateStorefrontSettings } = await import('../storefront');
    const result = await updateStorefrontSettings({ announcement: 'Big sale!' });

    expect(result.success).toBe(true);
  });

  it('rejects socialLinks for NONE tier seller', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'NONE', storeSlug: 'my-store', storeName: 'Test' },
      ])
    );

    const { updateStorefrontSettings } = await import('../storefront');
    const result = await updateStorefrontSettings({ socialLinks: { instagram: 'https://instagram.com/test' } });

    expect(result).toEqual({ success: false, error: 'Social links require Starter plan or higher' });
  });
});

describe('publishStorefront', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { publishStorefront } = await import('../storefront');
    const result = await publishStorefront();

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('fails when sellerType is PERSONAL', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'PERSONAL', storeTier: 'NONE', storeSlug: 'test', storeName: 'Test' },
      ])
    );

    const { publishStorefront } = await import('../storefront');
    const result = await publishStorefront();

    expect(result).toEqual({ success: false, error: 'Business seller status required to publish store' });
  });

  it('fails when storeName is not set', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'STARTER', storeSlug: 'test', storeName: null },
      ])
    );

    const { publishStorefront } = await import('../storefront');
    const result = await publishStorefront();

    expect(result).toEqual({ success: false, error: 'Store name is required before publishing' });
  });

  it('fails when storeSlug is not set', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'STARTER', storeSlug: null, storeName: 'Test' },
      ])
    );

    const { publishStorefront } = await import('../storefront');
    const result = await publishStorefront();

    expect(result).toEqual({ success: false, error: 'Store URL is required before publishing' });
  });

  it('fails when no active listings', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    // First call for profile (uses .limit())
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'STARTER', storeSlug: 'test', storeName: 'Test' },
      ])
    );
    // Second call for listing count (no .limit(), uses .where() directly)
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ count: 0 }], true)
    );

    const { publishStorefront } = await import('../storefront');
    const result = await publishStorefront();

    expect(result).toEqual({ success: false, error: 'At least 1 active listing required before publishing' });
  });

  it('succeeds when all 3 gates pass', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    // First call for profile (uses .limit())
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'STARTER', storeSlug: 'test', storeName: 'Test' },
      ])
    );
    // Second call for listing count (no .limit(), uses .where() directly)
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ count: 1 }], true)
    );
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { publishStorefront } = await import('../storefront');
    const result = await publishStorefront();

    expect(result.success).toBe(true);
  });
});

describe('updateStoreCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { updateStoreCategories } = await import('../storefront');
    const result = await updateStoreCategories([]);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('fails for STARTER tier seller (requires PRO)', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'STARTER', storeSlug: 'test', storeName: 'Test' },
      ])
    );

    const { updateStoreCategories } = await import('../storefront');
    const result = await updateStoreCategories([{ name: 'Electronics', sortOrder: 0 }]);

    expect(result).toEqual({ success: false, error: 'Custom categories require Pro plan or higher' });
  });

  it('succeeds for PRO tier seller', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    // Profile query
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'PRO', storeSlug: 'test', storeName: 'Test' },
      ])
    );
    // Storefront query
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([{ id: 'sf-1' }])
    );
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const { updateStoreCategories } = await import('../storefront');
    const result = await updateStoreCategories([{ name: 'Electronics', sortOrder: 0 }]);

    expect(result.success).toBe(true);
  });
});
