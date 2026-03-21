import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the modules before importing the actions
vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((type: string, obj: Record<string, unknown>) => ({ __caslSubjectType__: type, ...obj })),
}));

vi.mock('@/lib/queries/seller-listings', () => ({
  getListingsByIdsForOwner: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', ownerUserId: 'owner_user_id', status: 'status' },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  inArray: vi.fn((col, vals) => ({ type: 'inArray', col, vals })),
}));

import { bulkUpdateListingStatus, bulkDeleteListings } from '../seller-listings';
import { authorize } from '@twicely/casl';
import { getListingsByIdsForOwner } from '@/lib/queries/seller-listings';

const mockAuthorize = vi.mocked(authorize);
const mockGetListingsByIds = vi.mocked(getListingsByIdsForOwner);

// Helper to create mock ability — handles sub() objects
const createMockAbility = (canUpdate = false, canDelete = false) => ({
  can: vi.fn((action: string, subject: unknown) => {
    const subjectType = typeof subject === 'object' && subject !== null && '__caslSubjectType__' in subject
      ? (subject as { __caslSubjectType__: string }).__caslSubjectType__
      : subject;
    if (action === 'update' && subjectType === 'Listing') return canUpdate;
    if (action === 'delete' && subjectType === 'Listing') return canDelete;
    return false;
  }),
});

describe('bulkUpdateListingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: createMockAbility() as never, session: null });

    const result = await bulkUpdateListingStatus(['id1'], 'PAUSED');

    expect(result).toEqual({ success: false, error: 'Not authenticated' });
  });

  it('returns error if user is not a seller', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(false) as never,
      session: { userId: 'user1', isSeller: false, delegationId: null } as never,
    });

    const result = await bulkUpdateListingStatus(['id1'], 'PAUSED');

    expect(result).toEqual({ success: false, error: 'Not authorized' });
  });

  it('returns error when trying to bulk update to SOLD', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(true) as never,
      session: { userId: 'user1', isSeller: true, delegationId: null } as never,
    });

    const result = await bulkUpdateListingStatus(['id1'], 'SOLD');

    expect(result).toEqual({ success: false, error: 'Cannot bulk update to SOLD' });
  });

  it('returns error when trying to bulk update to DRAFT', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(true, true) as never,
      session: { userId: 'user1', isSeller: true, delegationId: null } as never,
    });

    const result = await bulkUpdateListingStatus(['id1'], 'DRAFT');

    expect(result).toEqual({ success: false, error: 'Cannot bulk update to DRAFT' });
  });

  it('returns validation error for empty array', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(true, true) as never,
      session: { userId: 'user1', isSeller: true, delegationId: null } as never,
    });

    const result = await bulkUpdateListingStatus([], 'PAUSED');

    expect(result).toEqual({ success: false, error: expect.stringContaining('1') });
  });

  it('skips listings not owned by user', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(true, true) as never,
      session: { userId: 'user1', isSeller: true, delegationId: null } as never,
    });
    mockGetListingsByIds.mockResolvedValue([]);

    const result = await bulkUpdateListingStatus(['id1', 'id2'], 'PAUSED');

    expect(result).toEqual({ success: true, updatedCount: 0, skippedCount: 2 });
  });

  it('only pauses ACTIVE listings, skips others', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(true, true) as never,
      session: { userId: 'user1', isSeller: true, delegationId: null } as never,
    });
    mockGetListingsByIds.mockResolvedValue([
      { id: 'id1', status: 'ACTIVE' },
      { id: 'id2', status: 'PAUSED' }, // Already paused, should skip
      { id: 'id3', status: 'DRAFT' },  // Can't pause draft
    ]);

    const result = await bulkUpdateListingStatus(['id1', 'id2', 'id3'], 'PAUSED');

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.skippedCount).toBe(2);
  });

  it('resumes only PAUSED listings', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(true, true) as never,
      session: { userId: 'user1', isSeller: true, delegationId: null } as never,
    });
    mockGetListingsByIds.mockResolvedValue([
      { id: 'id1', status: 'PAUSED' },
      { id: 'id2', status: 'ACTIVE' }, // Already active
    ]);

    const result = await bulkUpdateListingStatus(['id1', 'id2'], 'ACTIVE');

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it('ends ACTIVE and PAUSED listings', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(true, true) as never,
      session: { userId: 'user1', isSeller: true, delegationId: null } as never,
    });
    mockGetListingsByIds.mockResolvedValue([
      { id: 'id1', status: 'ACTIVE' },
      { id: 'id2', status: 'PAUSED' },
      { id: 'id3', status: 'ENDED' }, // Already ended
    ]);

    const result = await bulkUpdateListingStatus(['id1', 'id2', 'id3'], 'ENDED');

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
  });
});

describe('bulkDeleteListings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: createMockAbility() as never, session: null });

    const result = await bulkDeleteListings(['id1']);

    expect(result).toEqual({ success: false, error: 'Not authenticated' });
  });

  it('returns error if user is not a seller', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(false, false) as never,
      session: { userId: 'user1', isSeller: false, delegationId: null } as never,
    });

    const result = await bulkDeleteListings(['id1']);

    expect(result).toEqual({ success: false, error: 'Not authorized' });
  });

  it('returns validation error for empty array', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(true, true) as never,
      session: { userId: 'user1', isSeller: true, delegationId: null } as never,
    });

    const result = await bulkDeleteListings([]);

    expect(result).toEqual({ success: false, error: expect.stringContaining('1') });
  });

  it('only deletes DRAFT and ENDED listings, skips ACTIVE', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(true, true) as never,
      session: { userId: 'user1', isSeller: true, delegationId: null } as never,
    });
    mockGetListingsByIds.mockResolvedValue([
      { id: 'id1', status: 'DRAFT' },
      { id: 'id2', status: 'ENDED' },
      { id: 'id3', status: 'ACTIVE' }, // Should skip
      { id: 'id4', status: 'SOLD' },   // Should skip
    ]);

    const result = await bulkDeleteListings(['id1', 'id2', 'id3', 'id4']);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(2);
    expect(result.skippedCount).toBe(2);
  });

  it('skips listings not owned by user', async () => {
    mockAuthorize.mockResolvedValue({
      ability: createMockAbility(true, true) as never,
      session: { userId: 'user1', isSeller: true, delegationId: null } as never,
    });
    mockGetListingsByIds.mockResolvedValue([]);

    const result = await bulkDeleteListings(['id1']);

    expect(result).toEqual({ success: true, updatedCount: 0, skippedCount: 1 });
  });
});
