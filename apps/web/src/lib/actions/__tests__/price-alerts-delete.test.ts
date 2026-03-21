import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
const mockDbUpdate = vi.fn();
const mockDb = {
  select: mockDbSelect,
  insert: mockDbInsert,
  delete: mockDbDelete,
  update: mockDbUpdate,
};

const mockAuthorize = vi.fn();
const mockGetPlatformSetting = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));

describe('createPriceAlertAction — limits and validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback));
  });

  it('returns not authorized when ability check fails', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(false) } });

    const { createPriceAlertAction } = await import('../price-alerts');
    const result = await createPriceAlertAction({
      listingId: 'listing-1',
      alertType: 'ANY_DROP',
    });

    expect(result).toEqual({ success: false, error: 'Not authorized' });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('enforces max alerts per user limit', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'listing-1',
              ownerUserId: 'seller-1',
              priceCents: 10000,
              status: 'ACTIVE',
            }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 100 }]), // At limit
        }),
      });

    const { createPriceAlertAction } = await import('../price-alerts');
    const result = await createPriceAlertAction({
      listingId: 'listing-1',
      alertType: 'ANY_DROP',
    });

    expect(result).toEqual({ success: false, error: 'Maximum 100 alerts allowed' });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('sets didSetPriceAlert on browsing history when alert is created', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'listing-1',
              ownerUserId: 'seller-1',
              priceCents: 10000,
              status: 'ACTIVE',
            }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'alert-1' }]),
      }),
    });

    const mockUpdateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        catch: vi.fn(),
      }),
    });
    mockDbUpdate.mockReturnValue({ set: mockUpdateSet });

    const { createPriceAlertAction } = await import('../price-alerts');
    await createPriceAlertAction({
      listingId: 'listing-1',
      alertType: 'ANY_DROP',
    });

    // Verify db.update was called to set didSetPriceAlert
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith({ didSetPriceAlert: true });
  });

  it('cannot set alert on own listing', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'listing-1',
            ownerUserId: 'user-1', // Same as session user
            priceCents: 10000,
            status: 'ACTIVE',
          }]),
        }),
      }),
    });

    const { createPriceAlertAction } = await import('../price-alerts');
    const result = await createPriceAlertAction({
      listingId: 'listing-1',
      alertType: 'ANY_DROP',
    });

    expect(result).toEqual({ success: false, error: 'Cannot set alert on your own listing' });
  });

  it('BACK_IN_STOCK only valid for SOLD/ENDED listings', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'listing-1',
            ownerUserId: 'seller-1',
            priceCents: 10000,
            status: 'ACTIVE', // Not SOLD/ENDED
          }]),
        }),
      }),
    });

    const { createPriceAlertAction } = await import('../price-alerts');
    const result = await createPriceAlertAction({
      listingId: 'listing-1',
      alertType: 'BACK_IN_STOCK',
    });

    expect(result).toEqual({
      success: false,
      error: 'Back in stock alerts only for sold or ended listings',
    });
  });
});

describe('deletePriceAlertAction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback));
  });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null });

    const { deletePriceAlertAction } = await import('../price-alerts');
    const result = await deletePriceAlertAction('alert-1');

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when alert not found', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { deletePriceAlertAction } = await import('../price-alerts');
    const result = await deletePriceAlertAction('alert-1');

    expect(result).toEqual({ success: false, error: 'Alert not found' });
  });

  it('returns unauthorized when not owner', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'alert-1', userId: 'user-2' }]),
        }),
      }),
    });

    const { deletePriceAlertAction } = await import('../price-alerts');
    const result = await deletePriceAlertAction('alert-1');

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('deletes alert successfully', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
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

    const { deletePriceAlertAction } = await import('../price-alerts');
    const result = await deletePriceAlertAction('alert-1');

    expect(result).toEqual({ success: true });
    expect(mockDbDelete).toHaveBeenCalled();
  });
});
