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

import { deleteAddress, setDefaultAddress } from '../addresses';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';

// Get mocked functions after imports
const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);
const mockDelete = vi.mocked(db.delete);

describe('deleteAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if not authenticated', async () => {
    mockAuthorize.mockResolvedValue({
      session: null,
      ability: { can: vi.fn() } as never,
    });

    const result = await deleteAddress('addr1');

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
          limit: vi.fn().mockResolvedValue([{ id: 'addr1', userId: 'user2', isDefault: false }]),
        }),
      }),
    } as never);

    const result = await deleteAddress('addr1');

    expect(result).toEqual({ success: false, error: 'Address not found' });
  });

  it('deletes address and promotes next default', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return Promise.resolve([{ id: 'addr1', userId: 'user1', isDefault: true }]);
            }
            return Promise.resolve([{ id: 'addr2' }]);
          }),
        }),
      }),
    }) as never);

    mockDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    } as never);

    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const result = await deleteAddress('addr1');

    expect(result).toEqual({ success: true });
  });
});

describe('setDefaultAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if not authenticated', async () => {
    mockAuthorize.mockResolvedValue({
      session: null,
      ability: { can: vi.fn() } as never,
    });

    const result = await setDefaultAddress('addr1');

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

    const result = await setDefaultAddress('addr1');

    expect(result).toEqual({ success: false, error: 'Address not found' });
  });

  it('clears other defaults and sets target as default', async () => {
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

    const result = await setDefaultAddress('addr1');

    expect(result).toEqual({ success: true, addressId: 'addr1' });
    expect(mockUpdate).toHaveBeenCalled();
  });
});
