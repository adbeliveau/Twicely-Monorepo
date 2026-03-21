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

describe('createPriceAlertAction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback));
  });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null });

    const { createPriceAlertAction } = await import('../price-alerts');
    const result = await createPriceAlertAction({
      listingId: 'listing-1',
      alertType: 'ANY_DROP',
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('creates ANY_DROP alert and updates browsing history', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    // Mock listing lookup
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
      // Mock total count
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      })
      // Mock duplicate check
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

    // Mock browsing history update
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          catch: vi.fn(),
        }),
      }),
    });

    const { createPriceAlertAction } = await import('../price-alerts');
    const result = await createPriceAlertAction({
      listingId: 'listing-1',
      alertType: 'ANY_DROP',
    });

    expect(result).toEqual({ success: true, alertId: 'alert-1' });
    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('creates TARGET_PRICE alert with target below current price', async () => {
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
      // Mock total count
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      })
      // Mock duplicate check
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

    // Mock browsing history update
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          catch: vi.fn(),
        }),
      }),
    });

    const { createPriceAlertAction } = await import('../price-alerts');
    const result = await createPriceAlertAction({
      listingId: 'listing-1',
      alertType: 'TARGET_PRICE',
      targetPriceCents: 8000,
    });

    expect(result).toEqual({ success: true, alertId: 'alert-1' });
  });

  it('rejects TARGET_PRICE alert at or above current price', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockDbSelect.mockReturnValueOnce({
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
    });

    const { createPriceAlertAction } = await import('../price-alerts');
    const result = await createPriceAlertAction({
      listingId: 'listing-1',
      alertType: 'TARGET_PRICE',
      targetPriceCents: 12000, // Above current price
    });

    expect(result).toEqual({ success: false, error: 'Target price must be below current price' });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('creates PERCENT_DROP alert with valid percentage', async () => {
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
      // Mock total count
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      })
      // Mock duplicate check
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

    // Mock browsing history update
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          catch: vi.fn(),
        }),
      }),
    });

    const { createPriceAlertAction } = await import('../price-alerts');
    const result = await createPriceAlertAction({
      listingId: 'listing-1',
      alertType: 'PERCENT_DROP',
      targetPercentDrop: 20,
    });

    expect(result).toEqual({ success: true, alertId: 'alert-1' });
  });

  it('rejects PERCENT_DROP alert with invalid percentage', async () => {
    // Zod validates targetPercentDrop (max: 50) before auth or DB — no mocks needed.
    const { createPriceAlertAction } = await import('../price-alerts');
    const result = await createPriceAlertAction({
      listingId: 'listing-1',
      alertType: 'PERCENT_DROP',
      targetPercentDrop: 60, // > 50% — rejected by Zod schema (.max(50))
    });

    expect(result).toEqual({ success: false, error: 'Too big: expected number to be <=50' });
  });
});
