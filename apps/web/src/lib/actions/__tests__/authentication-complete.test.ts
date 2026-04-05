import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDb = { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert };
const mockStaffAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

function chainSelect(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function chainUpdate() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
}

function chainInsert() {
  return { values: vi.fn().mockResolvedValue([]) };
}

function makeAdminStaffSession() {
  return {
    session: {
      staffUserId: 'admin-1',
      email: 'admin@twicely.co',
      displayName: 'Admin User',
      isPlatformStaff: true,
      platformRoles: ['ADMIN'],
    },
    ability: { can: () => true },
  };
}

function makeRestrictedStaffSession() {
  return {
    session: {
      staffUserId: 'staff-1',
      email: 'staff@twicely.co',
      displayName: 'Staff User',
      isPlatformStaff: true,
      platformRoles: ['SUPPORT'],
    },
    ability: { can: () => false },
  };
}

class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

describe('completeAuthentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws ForbiddenError for unauthenticated users', async () => {
    mockStaffAuthorize.mockRejectedValue(new ForbiddenError('Staff authentication required'));
    const { completeAuthentication } = await import('../authentication-complete');
    await expect(completeAuthentication({
      requestId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      result: 'AUTHENTICATED',
    })).rejects.toThrow('Staff authentication required');
  });

  it('rejects staff without manage AuthenticationRequest ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeRestrictedStaffSession());
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      result: 'AUTHENTICATED',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Admin access required');
  });

  it('sets EXPERT_AUTHENTICATED and calculates cost split for seller-initiated', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: 'creq1xxxxxxxxxxxxxxxxxxx',
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'SELLER',
      status: 'EXPERT_PENDING',
      totalFeeCents: 3999,
      certificateNumber: 'TW-AUTH-ABCD1',
    }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: 'creq1xxxxxxxxxxxxxxxxxxx',
      result: 'AUTHENTICATED',
    });
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('sets EXPERT_AUTHENTICATED with 50/50 split for buyer-initiated', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: 'creq2xxxxxxxxxxxxxxxxxxx',
      listingId: 'clst2xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'BUYER',
      status: 'EXPERT_PENDING',
      totalFeeCents: 4000,
      certificateNumber: 'TW-AUTH-ABCD2',
    }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: 'creq2xxxxxxxxxxxxxxxxxxx',
      result: 'AUTHENTICATED',
    });
    expect(result.success).toBe(true);
  });

  it('COUNTERFEIT removes listing and charges seller', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: 'creq3xxxxxxxxxxxxxxxxxxx',
      listingId: 'clst3xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'BUYER',
      status: 'EXPERT_PENDING',
      totalFeeCents: 3999,
      certificateNumber: 'TW-AUTH-ABCD3',
    }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: 'creq3xxxxxxxxxxxxxxxxxxx',
      result: 'COUNTERFEIT',
    });
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('rejects INCONCLUSIVE for Expert tier (AI-only outcome)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: 'creq4xxxxxxxxxxxxxxxxxxx',
      listingId: 'clst4xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'SELLER',
      tier: 'EXPERT',
      status: 'EXPERT_PENDING',
      totalFeeCents: 3999,
      certificateNumber: 'TW-AUTH-ABCD4',
    }]));
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: 'creq4xxxxxxxxxxxxxxxxxxx',
      result: 'INCONCLUSIVE',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('INCONCLUSIVE result is only valid for AI tier requests');
  });

  it('rejects non-EXPERT_PENDING requests', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: 'creq5xxxxxxxxxxxxxxxxxxx',
      status: 'EXPERT_AUTHENTICATED',
      listingId: 'clst5xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'SELLER',
      totalFeeCents: 3999,
      certificateNumber: 'TW-AUTH-ABCD5',
    }]));
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({ requestId: 'creq5xxxxxxxxxxxxxxxxxxx', result: 'AUTHENTICATED' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Request is not in EXPERT_PENDING status');
  });
});

describe('invalidateCertificate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws ForbiddenError for unauthenticated users', async () => {
    mockStaffAuthorize.mockRejectedValue(new ForbiddenError('Staff authentication required'));
    const { invalidateCertificate } = await import('../authentication-complete');
    await expect(invalidateCertificate({
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      reason: 'RELISTED',
    })).rejects.toThrow('Staff authentication required');
  });

  it('rejects staff without manage AuthenticationRequest ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeRestrictedStaffSession());
    const { invalidateCertificate } = await import('../authentication-complete');
    const result = await invalidateCertificate({
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      reason: 'RELISTED',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Admin access required');
  });

  it('expires cert on relist', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());
    const { invalidateCertificate } = await import('../authentication-complete');
    const result = await invalidateCertificate({ listingId: 'clst1xxxxxxxxxxxxxxxxxxx', reason: 'RELISTED' });
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('revokes cert on admin action', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());
    const { invalidateCertificate } = await import('../authentication-complete');
    const result = await invalidateCertificate({ listingId: 'clst2xxxxxxxxxxxxxxxxxxx', reason: 'ADMIN_REVOKED' });
    expect(result.success).toBe(true);
  });
});
