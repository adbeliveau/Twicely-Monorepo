import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: mockDbUpdate, insert: mockDbInsert },
}));

const mockAuthorize = vi.fn();
vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (type: string, cond: Record<string, unknown>) => ({ ...cond, __caslSubjectType__: type }),
}));

const mockGetDelegationById = vi.fn();
const mockGetStaffCount = vi.fn();
vi.mock('@/lib/queries/delegation', () => ({
  getDelegationById: (...args: unknown[]) => mockGetDelegationById(...args),
  getStaffCountForSeller: (...args: unknown[]) => mockGetStaffCount(...args),
}));

vi.mock('@/lib/queries/subscriptions', () => ({
  getSellerProfileIdByUserId: vi.fn().mockResolvedValue('seller-001'),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';
const mockGetSellerProfileId = vi.mocked(getSellerProfileIdByUserId);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function updateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
}

function makeOwnerSession(sellerId = 'seller-001') {
  return {
    session: {
      userId: 'owner-001', email: 'owner@example.com', isSeller: true, sellerId,
      delegationId: null, onBehalfOfSellerId: null, onBehalfOfSellerProfileId: null, delegatedScopes: [],
      sellerStatus: null, isPlatformStaff: false, platformRoles: [],
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeStaffSession() {
  return {
    session: {
      userId: 'staff-001', email: 'staff@example.com', isSeller: false, sellerId: null,
      delegationId: DELEGATION_ID, onBehalfOfSellerId: 'seller-001', onBehalfOfSellerProfileId: 'seller-001', delegatedScopes: ['orders.view'],
      sellerStatus: null, isPlatformStaff: false, platformRoles: [],
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

// Valid CUID2 IDs (24 chars, lowercase alphanumeric)
const DELEGATION_ID = 'kp5auqjywckhxklb70skeeox';
const DELEGATION_ID_2 = 'scow9ml3dzd9wo2i0f4kzzy7';

const ACTIVE_RECORD = {
  id: DELEGATION_ID, sellerId: 'seller-001', userId: 'staff-user-001',
  email: 'staff@example.com', scopes: ['orders.view'], status: 'ACTIVE',
  invitedAt: new Date(), acceptedAt: new Date(), revokedAt: null,
  revokedByUserId: null, expiresAt: null,
};

const PENDING_RECORD = { ...ACTIVE_RECORD, id: DELEGATION_ID_2, status: 'PENDING', acceptedAt: null };

// ─── Tests: updateStaffScopes ─────────────────────────────────────────────────

describe('updateStaffScopes', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates scopes on active delegation owned by caller', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockGetDelegationById.mockResolvedValue(ACTIVE_RECORD);
    mockDbUpdate.mockReturnValue(updateChain());
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

    const { updateStaffScopes } = await import('../delegation');
    const result = await updateStaffScopes({ delegationId: DELEGATION_ID, scopes: ['orders.view', 'listings.view'] });

    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  }, 15000);

  it('rejects if delegation belongs to different seller', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession('seller-other'));
    mockGetSellerProfileId.mockResolvedValueOnce('seller-other');
    mockGetDelegationById.mockResolvedValue(ACTIVE_RECORD);

    const { updateStaffScopes } = await import('../delegation');
    const result = await updateStaffScopes({ delegationId: DELEGATION_ID, scopes: ['orders.view'] });

    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('rejects if delegation status is not ACTIVE', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockGetDelegationById.mockResolvedValue({ ...ACTIVE_RECORD, status: 'REVOKED' });

    const { updateStaffScopes } = await import('../delegation');
    const result = await updateStaffScopes({ delegationId: DELEGATION_ID, scopes: ['orders.view'] });

    expect(result.success).toBe(false);
  });

  it('rejects if caller is not owner', async () => {
    mockAuthorize.mockResolvedValue(makeStaffSession());

    const { updateStaffScopes } = await import('../delegation');
    const result = await updateStaffScopes({ delegationId: DELEGATION_ID, scopes: ['orders.view'] });

    expect(result).toEqual({ success: false, error: 'Staff members cannot modify delegations' });
  });

  it('rejects invalid scopes', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockGetDelegationById.mockResolvedValue(ACTIVE_RECORD);

    const { updateStaffScopes } = await import('../delegation');
    const result = await updateStaffScopes({ delegationId: DELEGATION_ID, scopes: ['bad.scope'] });

    expect(result).toEqual({ success: false, error: 'Invalid scope values' });
  });
});

// ─── Tests: revokeStaffMember ─────────────────────────────────────────────────

describe('revokeStaffMember', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('revokes active delegation and sets revokedAt + revokedByUserId', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockGetDelegationById.mockResolvedValue(ACTIVE_RECORD);
    mockDbUpdate.mockReturnValue(updateChain());
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

    const { revokeStaffMember } = await import('../delegation');
    const result = await revokeStaffMember({ delegationId: DELEGATION_ID });

    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('revokes pending delegation', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockGetDelegationById.mockResolvedValue(PENDING_RECORD);
    mockDbUpdate.mockReturnValue(updateChain());
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

    const { revokeStaffMember } = await import('../delegation');
    const result = await revokeStaffMember({ delegationId: DELEGATION_ID_2 });

    expect(result.success).toBe(true);
  });

  it('rejects if delegation belongs to different seller', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession('seller-other'));
    mockGetSellerProfileId.mockResolvedValueOnce('seller-other');
    mockGetDelegationById.mockResolvedValue(ACTIVE_RECORD);

    const { revokeStaffMember } = await import('../delegation');
    const result = await revokeStaffMember({ delegationId: DELEGATION_ID });

    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('rejects if delegation already revoked', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockGetDelegationById.mockResolvedValue({ ...ACTIVE_RECORD, status: 'REVOKED' });

    const { revokeStaffMember } = await import('../delegation');
    const result = await revokeStaffMember({ delegationId: DELEGATION_ID });

    expect(result.success).toBe(false);
  });

  it('rejects if caller is not owner', async () => {
    mockAuthorize.mockResolvedValue(makeStaffSession());

    const { revokeStaffMember } = await import('../delegation');
    const result = await revokeStaffMember({ delegationId: DELEGATION_ID });

    expect(result).toEqual({ success: false, error: 'Staff members cannot revoke delegations' });
  });
});

// ─── Tests: acceptInvitation ──────────────────────────────────────────────────

describe('acceptInvitation', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('accepts pending invitation and sets ACTIVE + acceptedAt', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'staff-user-001', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetDelegationById.mockResolvedValue(PENDING_RECORD);
    mockDbUpdate.mockReturnValue(updateChain());
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

    const { acceptInvitation } = await import('../delegation');
    const result = await acceptInvitation({ delegationId: DELEGATION_ID_2 });

    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('rejects if invitation not found', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'staff-user-001', delegationId: null }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockGetDelegationById.mockResolvedValue(null);

    const { acceptInvitation } = await import('../delegation');
    expect(await acceptInvitation({ delegationId: DELEGATION_ID }))
      .toEqual({ success: false, error: 'Invitation not found or already processed' });
  });

  it('rejects if invitation already accepted', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'staff-user-001', delegationId: null }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockGetDelegationById.mockResolvedValue(ACTIVE_RECORD);

    const { acceptInvitation } = await import('../delegation');
    expect(await acceptInvitation({ delegationId: DELEGATION_ID }))
      .toEqual({ success: false, error: 'Invitation not found or already processed' });
  });

  it('rejects if invitation expired', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'staff-user-001', delegationId: null }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockGetDelegationById.mockResolvedValue({ ...PENDING_RECORD, expiresAt: new Date(0) });
    mockDbUpdate.mockReturnValue(updateChain());

    const { acceptInvitation } = await import('../delegation');
    expect(await acceptInvitation({ delegationId: DELEGATION_ID_2 }))
      .toEqual({ success: false, error: 'This invitation has expired' });
  });

  it('rejects if userId does not match invitation', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'wrong-user', delegationId: null }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockGetDelegationById.mockResolvedValue(PENDING_RECORD);

    const { acceptInvitation } = await import('../delegation');
    expect(await acceptInvitation({ delegationId: DELEGATION_ID_2 }))
      .toEqual({ success: false, error: 'Invitation not found or already processed' });
  });

  it('rejects if not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { acceptInvitation } = await import('../delegation');
    expect(await acceptInvitation({ delegationId: DELEGATION_ID_2 }))
      .toEqual({ success: false, error: 'Unauthorized' });
  });
});
