import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function selectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(data) }),
    }),
  };
}

function insertChain(data: unknown[]) {
  return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(data) }) };
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
      delegationId: 'deleg-001', onBehalfOfSellerId: 'seller-001', onBehalfOfSellerProfileId: 'seller-001', delegatedScopes: ['orders.view'],
      sellerStatus: null, isPlatformStaff: false, platformRoles: [],
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

// ─── Tests: inviteStaffMember ─────────────────────────────────────────────────

describe('inviteStaffMember', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('creates PENDING delegation for valid email with existing user', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockDbSelect
      .mockReturnValueOnce(selectChain([{ storeTier: 'PRO' }]))
      .mockReturnValueOnce(selectChain([{ value: 10 }]))
      .mockReturnValueOnce(selectChain([{ id: 'staff-user-001' }]))
      .mockReturnValueOnce(selectChain([]));
    mockGetStaffCount.mockResolvedValue(0);
    mockDbInsert.mockReturnValue(insertChain([{ id: 'deleg-new-001' }]));

    const { inviteStaffMember } = await import('../delegation');
    const result = await inviteStaffMember({ email: 'staff@example.com', scopes: ['orders.view'] });

    expect(result.success).toBe(true);
    expect(result.delegationId).toBe('deleg-new-001');
  });

  it('rejects if caller is not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { inviteStaffMember } = await import('../delegation');
    expect(await inviteStaffMember({ email: 'x@x.com', scopes: ['orders.view'] }))
      .toEqual({ success: false, error: 'Unauthorized' });
  });

  it('rejects if caller is a delegate (not owner)', async () => {
    mockAuthorize.mockResolvedValue(makeStaffSession());
    const { inviteStaffMember } = await import('../delegation');
    expect(await inviteStaffMember({ email: 'x@x.com', scopes: ['orders.view'] }))
      .toEqual({ success: false, error: 'Staff members cannot invite other staff' });
  });

  it('rejects if seller StoreTier is NONE or STARTER', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockDbSelect.mockReturnValueOnce(selectChain([{ storeTier: 'NONE' }]));
    const { inviteStaffMember } = await import('../delegation');
    expect(await inviteStaffMember({ email: 'x@x.com', scopes: ['orders.view'] }))
      .toEqual({ success: false, error: 'Staff management requires Store Pro or higher' });
  });

  it('rejects if staff limit is reached for tier', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockDbSelect
      .mockReturnValueOnce(selectChain([{ storeTier: 'PRO' }]))
      .mockReturnValueOnce(selectChain([{ value: 10 }]));
    mockGetStaffCount.mockResolvedValue(5);
    const { inviteStaffMember } = await import('../delegation');
    expect(await inviteStaffMember({ email: 'x@x.com', scopes: ['orders.view'] }))
      .toEqual({ success: false, error: 'Staff limit reached for your current plan' });
  });

  it('rejects if email does not match an existing user', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockDbSelect
      .mockReturnValueOnce(selectChain([{ storeTier: 'PRO' }]))
      .mockReturnValueOnce(selectChain([{ value: 10 }]))
      .mockReturnValueOnce(selectChain([]));
    mockGetStaffCount.mockResolvedValue(0);
    const { inviteStaffMember } = await import('../delegation');
    const result = await inviteStaffMember({ email: 'notfound@x.com', scopes: ['orders.view'] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No Twicely account found');
  });

  it('rejects if email is already invited (active/pending)', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockDbSelect
      .mockReturnValueOnce(selectChain([{ storeTier: 'PRO' }]))
      .mockReturnValueOnce(selectChain([{ value: 10 }]))
      .mockReturnValueOnce(selectChain([{ id: 'staff-user-001' }]))
      .mockReturnValueOnce(selectChain([{ id: 'deleg-exists' }]));
    mockGetStaffCount.mockResolvedValue(1);
    const { inviteStaffMember } = await import('../delegation');
    const result = await inviteStaffMember({ email: 'staff@x.com', scopes: ['orders.view'] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already has an active or pending invitation');
  });

  it('rejects invalid scopes', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    mockDbSelect
      .mockReturnValueOnce(selectChain([{ storeTier: 'PRO' }]))
      .mockReturnValueOnce(selectChain([{ value: 10 }]));
    mockGetStaffCount.mockResolvedValue(0);
    const { inviteStaffMember } = await import('../delegation');
    expect(await inviteStaffMember({ email: 'x@x.com', scopes: ['invalid.scope'] }))
      .toEqual({ success: false, error: 'Invalid scope values' });
  });

  it('validates input with Zod strict schema', async () => {
    mockAuthorize.mockResolvedValue(makeOwnerSession());
    const { inviteStaffMember } = await import('../delegation');
    const result = await inviteStaffMember({ email: 'not-an-email', scopes: [] });
    expect(result.success).toBe(false);
  });
});
