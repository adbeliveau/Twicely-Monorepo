import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before imports - use vi.fn() inside factory
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  address: {
    id: 'id',
    userId: 'user_id',
    isDefault: 'is_default',
    name: 'name',
    address1: 'address1',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
}));

import { createAddress, updateAddress } from '../addresses';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';

// Get mocked functions after imports
const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);
const mockInsert = vi.mocked(db.insert);

const validAddressData = {
  name: 'John Doe',
  address1: '123 Main St',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  country: 'US',
};

describe('createAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if not authenticated', async () => {
    mockAuthorize.mockResolvedValue({
      session: null,
      ability: { can: vi.fn() } as never,
    });

    const result = await createAddress(validAddressData);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns validation errors for invalid data', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    const result = await createAddress({ ...validAddressData, name: '' });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.name).toBeDefined();
  });

  it('makes first address default automatically', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);

    // Mock clearDefaultAddresses (called when shouldBeDefault is true)
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'addr1' }]),
      }),
    } as never);

    const result = await createAddress(validAddressData);

    expect(result.success).toBe(true);
    expect(result.addressId).toBe('addr1');
  });

  it('creates non-default address when others exist', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'existing1' }]),
        }),
      }),
    } as never);

    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'addr2' }]),
      }),
    } as never);

    const result = await createAddress({ ...validAddressData, isDefault: false });

    expect(result.success).toBe(true);
    expect(result.addressId).toBe('addr2');
  });
});

describe('updateAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if not authenticated', async () => {
    mockAuthorize.mockResolvedValue({
      session: null,
      ability: { can: vi.fn() } as never,
    });

    const result = await updateAddress('addr1', validAddressData);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error if address not owned by user', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'addr1', userId: 'user2' }]),
        }),
      }),
    } as never);

    const result = await updateAddress('addr1', validAddressData);

    expect(result).toEqual({ success: false, error: 'Address not found' });
  });

  it('returns validation errors for invalid data', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'addr1', userId: 'user1' }]),
        }),
      }),
    } as never);

    const result = await updateAddress('addr1', { ...validAddressData, zip: '' });

    expect(result.success).toBe(false);
    expect(result.errors?.zip).toBeDefined();
  });

  it('updates address on valid data', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'addr1', userId: 'user1' }]),
        }),
      }),
    } as never);

    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const result = await updateAddress('addr1', validAddressData);

    expect(result).toEqual({ success: true, addressId: 'addr1' });
  });
});
