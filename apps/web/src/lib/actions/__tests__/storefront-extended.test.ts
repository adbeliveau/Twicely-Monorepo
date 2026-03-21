import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks — duplicated from storefront.test.ts (separate test file for 300-line compliance)
const { mockDbSelect, mockDbUpdate, mockDbInsert, mockDbDelete, mockDb, mockAuthorize } = vi.hoisted(() => {
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
  return { mockDbSelect, mockDbUpdate, mockDbInsert, mockDbDelete, mockDb, mockAuthorize };
});

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (type: string, conditions: Record<string, unknown>) => ({ ...conditions, __caslSubjectType__: type }),
}));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/utils/tier-gates', () => ({
  canUseFeature: vi.fn((tier: string, feature: string) => {
    if (feature === 'customCategories') return tier === 'PRO' || tier === 'POWER' || tier === 'ENTERPRISE';
    return true;
  }),
}));
vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn(() => 'cm1testcuid2id000000000'),
}));

import { updateStorefrontSettings, updateStoreCategories } from '../storefront';

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

// ─── updateStorefrontSettings — shippingPolicy ───────────────────────────

describe('updateStorefrontSettings - shippingPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows setting shippingPolicy', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'NONE', storeSlug: 'my-store', storeName: 'Test' },
      ])
    );
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });

    const result = await updateStorefrontSettings({ shippingPolicy: 'Ships in 3 days.' });

    expect(result.success).toBe(true);
  });

  it('rejects shippingPolicy over 2000 characters', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'NONE', storeSlug: 'my-store', storeName: 'Test' },
      ])
    );

    const result = await updateStorefrontSettings({ shippingPolicy: 'x'.repeat(2001) });

    expect(result).toEqual({ success: false, error: 'Shipping policy max 2000 characters' });
  });

  it('allows setting shippingPolicy to null', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'NONE', storeSlug: 'my-store', storeName: 'Test' },
      ])
    );
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });

    const result = await updateStorefrontSettings({ shippingPolicy: null });

    expect(result.success).toBe(true);
  });
});

// ─── updateStoreCategories ───────────────────────────────────────────────

describe('updateStoreCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: null });

    const result = await updateStoreCategories([]);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('fails for STARTER tier seller (requires PRO)', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValue(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'STARTER', storeSlug: 'test', storeName: 'Test' },
      ])
    );

    const result = await updateStoreCategories([{ name: 'Electronics', sortOrder: 0 }]);

    expect(result).toEqual({ success: false, error: 'Custom categories require Pro plan or higher' });
  });

  it('succeeds for PRO tier seller', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: { userId: 'user-1' } });
    mockDbSelect.mockReturnValueOnce(
      createChainableMock([
        { id: 'sp-1', sellerType: 'BUSINESS', storeTier: 'PRO', storeSlug: 'test', storeName: 'Test' },
      ])
    );
    mockDbSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const result = await updateStoreCategories([{ name: 'Electronics', sortOrder: 0 }]);

    expect(result.success).toBe(true);
  });
});
