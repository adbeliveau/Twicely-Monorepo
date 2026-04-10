import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuthorize, mockSub, mockDbSelect, mockDbUpdate } = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockSub: vi.fn((type: string, obj: Record<string, unknown>) => ({ __caslSubjectType__: type, ...obj })),
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
}));

vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize, sub: mockSub }));
vi.mock('@twicely/db/schema', () => ({
  listing: {
    id: 'id', ownerUserId: 'owner_user_id', status: 'status', title: 'title',
    updatedAt: 'updated_at', activatedAt: 'activated_at', pausedAt: 'paused_at',
    endedAt: 'ended_at', soldAt: 'sold_at',
  },
  listingImage: { listingId: 'listing_id', position: 'position' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...args) => ({ op: 'and', args })),
}));
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect, update: mockDbUpdate } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/jobs/search-index-sync', () => ({
  enqueueSearchIndexUpsert: vi.fn().mockResolvedValue(undefined),
  enqueueSearchIndexDelete: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/services/price-alert-processor', () => ({
  processBackInStockAlerts: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { updateListingStatus, getListingForEdit } from '../listings-update-status';

function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}

function makeSelectChain(data: unknown[]) {
  const c: Record<string, unknown> = {};
  c['from'] = vi.fn().mockReturnValue(c);
  c['where'] = vi.fn().mockReturnValue(c);
  c['limit'] = vi.fn().mockResolvedValue(data);
  c['orderBy'] = vi.fn().mockResolvedValue(data);
  return c;
}

function makeUpdateChain() {
  const c = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  c.set.mockReturnValue(c);
  return c;
}

describe('updateListingStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns Unauthorized when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: null });
    const result = await updateListingStatus('z123456789012345678901234', 'PAUSED');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns Forbidden when ability denies update', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(false), session: { userId: 'u1', delegationId: null } });
    const result = await updateListingStatus('z123456789012345678901234', 'PAUSED');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns error for invalid status value', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    const result = await updateListingStatus('z123456789012345678901234', 'INVALID_STATUS');
    expect(result.success).toBe(false);
  });

  it('returns Listing not found when listing does not exist', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const result = await updateListingStatus('z123456789012345678901234', 'PAUSED');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Listing not found');
  });

  it('returns Unauthorized when user does not own the listing', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'other-user', status: 'ACTIVE', title: 'Item' },
    ]));
    const result = await updateListingStatus('z123456789012345678901234', 'PAUSED');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error for invalid transition SOLD → ACTIVE', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'u1', status: 'SOLD', title: 'Item' },
    ]));
    const result = await updateListingStatus('z123456789012345678901234', 'ACTIVE');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot change status');
  });

  it('pauses an ACTIVE listing successfully', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'u1', status: 'ACTIVE', title: 'Item' },
    ]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const result = await updateListingStatus('z123456789012345678901234', 'PAUSED');
    expect(result.success).toBe(true);
  });

  it('activates a PAUSED listing successfully', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'u1', status: 'PAUSED', title: 'Item' },
    ]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const result = await updateListingStatus('z123456789012345678901234', 'ACTIVE');
    expect(result.success).toBe(true);
  });

  it('activates a DRAFT listing successfully', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'u1', status: 'DRAFT', title: 'Item' },
    ]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const result = await updateListingStatus('z123456789012345678901234', 'ACTIVE');
    expect(result.success).toBe(true);
  });

  it('uses delegation seller ID when delegationId is set', async () => {
    mockAuthorize.mockResolvedValue({
      ability: makeAbility(),
      session: { userId: 'staff-1', delegationId: 'del-1', onBehalfOfSellerId: 'seller-2' },
    });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'seller-2', status: 'ACTIVE', title: 'Item' },
    ]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const result = await updateListingStatus('z123456789012345678901234', 'PAUSED');
    expect(result.success).toBe(true);
  });

  it('valid transition: ACTIVE → ENDED', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'lst-1', ownerUserId: 'u1', status: 'ACTIVE', title: 'Item' },
    ]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const result = await updateListingStatus('z123456789012345678901234', 'ENDED');
    expect(result.success).toBe(true);
  });
});

describe('getListingForEdit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: null });
    const result = await getListingForEdit('lst-1');
    expect(result).toBeNull();
  });

  it('returns null when listing not found for owner', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const result = await getListingForEdit('lst-missing');
    expect(result).toBeNull();
  });

  it('returns listing with images for owner', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'lst-1', ownerUserId: 'u1', status: 'DRAFT', title: 'My Listing' }]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'img-1', url: 'https://cdn.example.com/img.jpg', position: 0 }]));
    const result = await getListingForEdit('lst-1');
    expect(result).not.toBeNull();
    expect(result!.listing.id).toBe('lst-1');
    expect(result!.images).toHaveLength(1);
  });
});
