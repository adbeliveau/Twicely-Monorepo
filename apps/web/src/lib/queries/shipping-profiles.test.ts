import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSellerShippingProfiles,
  getShippingProfileById,
  getShippingProfileListingCount,
} from './shipping-profiles';
import { db } from '@twicely/db';

// Mock the database
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('getSellerShippingProfiles', () => {
  const mockSellerId = 'test-seller-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all shipping profiles for a seller', async () => {
    const mockProfiles = [
      {
        id: 'profile-1',
        userId: mockSellerId,
        name: 'Standard Shipping',
        carrier: 'USPS',
        service: 'Priority Mail',
        handlingTimeDays: 1,
        isDefault: true,
        weightOz: 16,
        lengthIn: 12,
        widthIn: 9,
        heightIn: 3,
        combinedShippingMode: 'NONE',
        flatCombinedCents: null,
        additionalItemCents: null,
        autoDiscountPercent: null,
        autoDiscountMinItems: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'profile-2',
        userId: mockSellerId,
        name: 'Heavy Items',
        carrier: 'UPS',
        service: 'Ground',
        handlingTimeDays: 2,
        isDefault: false,
        weightOz: null,
        lengthIn: null,
        widthIn: null,
        heightIn: null,
        combinedShippingMode: 'FLAT',
        flatCombinedCents: 500,
        additionalItemCents: null,
        autoDiscountPercent: null,
        autoDiscountMinItems: null,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockProfiles),
        }),
      }),
    });

    (db.select as unknown) = mockSelect;

    const profiles = await getSellerShippingProfiles(mockSellerId);

    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toHaveProperty('id');
    expect(profiles[0]).toHaveProperty('name');
    expect(profiles[0]).toHaveProperty('carrier');
    expect(profiles[0]).toHaveProperty('combinedShippingMode');
  });

  it('should return empty array if seller has no profiles', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    (db.select as unknown) = mockSelect;

    const profiles = await getSellerShippingProfiles(mockSellerId);

    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles).toHaveLength(0);
  });
});

describe('getShippingProfileById', () => {
  const mockProfileId = 'profile-123';
  const mockSellerId = 'seller-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return profile when found and user owns it', async () => {
    const mockProfile = {
      id: mockProfileId,
      userId: mockSellerId,
      name: 'Standard Shipping',
      carrier: 'USPS',
      service: 'Priority Mail',
      handlingTimeDays: 1,
      isDefault: true,
      weightOz: 16,
      lengthIn: 12,
      widthIn: 9,
      heightIn: 3,
      combinedShippingMode: 'NONE',
      flatCombinedCents: null,
      additionalItemCents: null,
      autoDiscountPercent: null,
      autoDiscountMinItems: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockProfile]),
        }),
      }),
    });

    (db.select as unknown) = mockSelect;

    const profile = await getShippingProfileById(mockProfileId, mockSellerId);

    expect(profile).toBeDefined();
    expect(profile?.id).toBe(mockProfileId);
    expect(profile?.userId).toBe(mockSellerId);
  });

  it('should return undefined when profile not found', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    (db.select as unknown) = mockSelect;

    const profile = await getShippingProfileById(mockProfileId, mockSellerId);

    expect(profile).toBeNull();
  });
});

describe('getShippingProfileListingCount', () => {
  const mockProfileId = 'profile-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return count of active listings using the profile', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
      }),
    });

    (db.select as unknown) = mockSelect;

    const count = await getShippingProfileListingCount(mockProfileId);

    expect(count).toBe(5);
  });

  it('should return 0 when no listings use the profile', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });

    (db.select as unknown) = mockSelect;

    const count = await getShippingProfileListingCount(mockProfileId);

    expect(count).toBe(0);
  });

  it('should return 0 when result is undefined', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    (db.select as unknown) = mockSelect;

    const count = await getShippingProfileListingCount(mockProfileId);

    expect(count).toBe(0);
  });
});
