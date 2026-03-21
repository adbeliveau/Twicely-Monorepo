import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
const mockDb = {
  select: mockDbSelect,
  insert: mockDbInsert,
  delete: mockDbDelete,
};

const mockNotify = vi.fn().mockResolvedValue(undefined);
const mockAuthorize = vi.fn();
const mockGetPlatformSetting = vi.fn().mockResolvedValue(20);

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize }));
vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

const mockAbility = { can: vi.fn().mockReturnValue(true) };

describe('saveCategoryAlertAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockResolvedValue(20);
    mockAbility.can.mockReturnValue(true);
  });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: mockAbility });

    const { saveCategoryAlertAction } = await import('../category-alerts');
    const result = await saveCategoryAlertAction({
      categoryId: 'cat-1',
      categoryName: 'Electronics',
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns not authorized when ability check fails', async () => {
    mockAbility.can.mockReturnValue(false);
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });

    const { saveCategoryAlertAction } = await import('../category-alerts');
    const result = await saveCategoryAlertAction({
      categoryId: 'cat-1',
      categoryName: 'Electronics',
    });

    expect(result).toEqual({ success: false, error: 'Not authorized' });
  });

  it('saves a category alert successfully', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
    // First select: duplicate check (no existing)
    // Second select: count check (0 alerts)
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'alert-1' }]),
      }),
    });

    const { saveCategoryAlertAction } = await import('../category-alerts');
    const result = await saveCategoryAlertAction({
      categoryId: 'cat-1',
      categoryName: 'Electronics',
    });

    expect(result).toEqual({ success: true, alertId: 'alert-1' });
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it('returns error when alert already exists for category', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
    // Mock duplicate check - existing alert for same category
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'existing-1' }]),
        }),
      }),
    });

    const { saveCategoryAlertAction } = await import('../category-alerts');
    const result = await saveCategoryAlertAction({
      categoryId: 'cat-1',
      categoryName: 'Electronics',
    });

    expect(result).toEqual({ success: false, error: 'Alert already exists for this category' });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('returns error when max alerts reached', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
    // First select: duplicate check (no existing)
    // Second select: count check (20 = max reached)
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 20 }]),
        }),
      });

    const { saveCategoryAlertAction } = await import('../category-alerts');
    const result = await saveCategoryAlertAction({
      categoryId: 'cat-1',
      categoryName: 'Electronics',
    });

    expect(result).toEqual({ success: false, error: 'Maximum of 20 alerts reached' });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});

describe('deleteCategoryAlertAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockAbility.can.mockReturnValue(true);
  });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: mockAbility });

    const { deleteCategoryAlertAction } = await import('../category-alerts');
    const result = await deleteCategoryAlertAction('alert-1');

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns not authorized when ability check fails', async () => {
    mockAbility.can.mockReturnValue(false);
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });

    const { deleteCategoryAlertAction } = await import('../category-alerts');
    const result = await deleteCategoryAlertAction('alert-1');

    expect(result).toEqual({ success: false, error: 'Not authorized' });
  });

  it('returns error when alert not found', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { deleteCategoryAlertAction } = await import('../category-alerts');
    const result = await deleteCategoryAlertAction('alert-1');

    expect(result).toEqual({ success: false, error: 'Alert not found' });
  });

  it('returns unauthorized when not owner', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'alert-1', userId: 'user-2' }]),
        }),
      }),
    });

    const { deleteCategoryAlertAction } = await import('../category-alerts');
    const result = await deleteCategoryAlertAction('alert-1');

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('deletes alert when owner', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'alert-1', userId: 'user-1' }]),
        }),
      }),
    });
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const { deleteCategoryAlertAction } = await import('../category-alerts');
    const result = await deleteCategoryAlertAction('alert-1');

    expect(result).toEqual({ success: true });
    expect(mockDbDelete).toHaveBeenCalled();
  });
});
