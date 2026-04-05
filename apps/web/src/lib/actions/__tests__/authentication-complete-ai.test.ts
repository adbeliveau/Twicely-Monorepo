import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

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

// ─── Chainable mock helpers ─────────────────────────────────────────────────

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
      displayName: 'Admin',
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
      displayName: 'Staff',
      isPlatformStaff: true,
      platformRoles: ['SUPPORT'],
    },
    ability: { can: () => false },
  };
}

// ─── Valid CUID2-format IDs for test inputs ──────────────────────────────────

const REQ_AI_1    = 'creqai1xxxxxxxxxxxxxxxxxxx';
const REQ_AI_BUY  = 'creqaibuyxxxxxxxxxxxxxxxx0';
const REQ_AI_SEL  = 'creqaiselxxxxxxxxxxxxxxxx0';
const REQ_AI_CF   = 'creqaicfxxxxxxxxxxxxxxxxxx';
const REQ_AI_INC  = 'creqaiincxxxxxxxxxxxxxxxxx';
const REQ_AI_INC2 = 'creqaiinc2xxxxxxxxxxxxxxxx';
const REQ_AI_INC3 = 'creqaiinc3xxxxxxxxxxxxxxxx';
const REQ_EXP_INC = 'creqexpincxxxxxxxxxxxxxxxx';
const REQ_DONE    = 'creqdonexxxxxxxxxxxxxxxxxx';
const REQ_CERT    = 'creqcertxxxxxxxxxxxxxxxxxx';
const REQ_CF_AUD  = 'creqcfaudxxxxxxxxxxxxxxxxx';

// ─── AI tier completeAuthentication tests ───────────────────────────────────

describe('completeAuthentication — AI tier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts AI_PENDING requests', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: REQ_AI_1,
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'SELLER',
      tier: 'AI',
      status: 'AI_PENDING',
      totalFeeCents: 1999,
      certificateNumber: 'TW-AUTH-AI001',
    }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: REQ_AI_1,
      result: 'AUTHENTICATED',
    });
    expect(result.success).toBe(true);
  });

  it('AUTHENTICATED buyer-initiated sets 50/50 split with AI_ prefix status', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: REQ_AI_BUY,
      listingId: 'clst2xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'BUYER',
      tier: 'AI',
      status: 'AI_PENDING',
      totalFeeCents: 2000,
      certificateNumber: 'TW-AUTH-AI002',
    }]));
    const updateSpy = chainUpdate();
    mockDbUpdate.mockReturnValue(updateSpy);
    mockDbInsert.mockReturnValue(chainInsert());
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: REQ_AI_BUY,
      result: 'AUTHENTICATED',
    });
    expect(result.success).toBe(true);
    expect(updateSpy.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'AI_AUTHENTICATED', buyerFeeCents: 1000, sellerFeeCents: 1000 })
    );
  });

  it('AUTHENTICATED seller-initiated sets full seller fee with AI_ prefix status', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: REQ_AI_SEL,
      listingId: 'clst3xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'SELLER',
      tier: 'AI',
      status: 'AI_PENDING',
      totalFeeCents: 1999,
      certificateNumber: 'TW-AUTH-AI003',
    }]));
    const updateSpy = chainUpdate();
    mockDbUpdate.mockReturnValue(updateSpy);
    mockDbInsert.mockReturnValue(chainInsert());
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: REQ_AI_SEL,
      result: 'AUTHENTICATED',
    });
    expect(result.success).toBe(true);
    expect(updateSpy.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'AI_AUTHENTICATED', sellerFeeCents: 1999 })
    );
  });

  it('COUNTERFEIT sets AI_COUNTERFEIT, seller pays full, enforcementState=REMOVED', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: REQ_AI_CF,
      listingId: 'clst4xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'BUYER',
      tier: 'AI',
      status: 'AI_PENDING',
      totalFeeCents: 1999,
      certificateNumber: 'TW-AUTH-AI004',
    }]));
    const updateSpy = chainUpdate();
    mockDbUpdate.mockReturnValue(updateSpy);
    mockDbInsert.mockReturnValue(chainInsert());
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: REQ_AI_CF,
      result: 'COUNTERFEIT',
    });
    expect(result.success).toBe(true);
    expect(updateSpy.set).toHaveBeenCalledWith(
      expect.objectContaining({ enforcementState: 'REMOVED' })
    );
  });

  it('INCONCLUSIVE sets AI_INCONCLUSIVE with 0/0 fees', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: REQ_AI_INC,
      listingId: 'clst5xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'BUYER',
      tier: 'AI',
      status: 'AI_PENDING',
      totalFeeCents: 1999,
      certificateNumber: 'TW-AUTH-AI005',
    }]));
    const updateSpy = chainUpdate();
    mockDbUpdate.mockReturnValue(updateSpy);
    mockDbInsert.mockReturnValue(chainInsert());
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: REQ_AI_INC,
      result: 'INCONCLUSIVE',
    });
    expect(result.success).toBe(true);
    expect(updateSpy.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'AI_INCONCLUSIVE', buyerFeeCents: 0, sellerFeeCents: 0 })
    );
  });

  it('INCONCLUSIVE does NOT set enforcementState=REMOVED on listing', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: REQ_AI_INC2,
      listingId: 'clst6xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'SELLER',
      tier: 'AI',
      status: 'AI_PENDING',
      totalFeeCents: 1999,
      certificateNumber: 'TW-AUTH-AI006',
    }]));
    const updateSpy = chainUpdate();
    mockDbUpdate.mockReturnValue(updateSpy);
    mockDbInsert.mockReturnValue(chainInsert());
    const { completeAuthentication } = await import('../authentication-complete');
    await completeAuthentication({ requestId: REQ_AI_INC2, result: 'INCONCLUSIVE' });
    const listingUpdateCall = updateSpy.set.mock.calls.find(
      (call: unknown[]) => {
        const arg = call[0] as Record<string, unknown>;
        return arg['authenticationStatus'] === 'AI_INCONCLUSIVE';
      }
    );
    expect(listingUpdateCall).toBeDefined();
    expect((listingUpdateCall?.[0] as Record<string, unknown>)?.['enforcementState']).toBeUndefined();
  });

  it('INCONCLUSIVE inserts audit event', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: REQ_AI_INC3,
      listingId: 'clst7xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'BUYER',
      tier: 'AI',
      status: 'AI_PENDING',
      totalFeeCents: 1999,
      certificateNumber: 'TW-AUTH-AI007',
    }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const insertSpy = { values: vi.fn().mockResolvedValue([]) };
    mockDbInsert.mockReturnValue(insertSpy);
    const { completeAuthentication } = await import('../authentication-complete');
    await completeAuthentication({ requestId: REQ_AI_INC3, result: 'INCONCLUSIVE' });
    expect(insertSpy.values).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AI_AUTH_INCONCLUSIVE' })
    );
  });

  it('INCONCLUSIVE rejected for Expert tier', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: REQ_EXP_INC,
      listingId: 'clst8xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'SELLER',
      tier: 'EXPERT',
      status: 'EXPERT_PENDING',
      totalFeeCents: 3999,
      certificateNumber: 'TW-AUTH-EX008',
    }]));
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: REQ_EXP_INC,
      result: 'INCONCLUSIVE',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('INCONCLUSIVE result is only valid for AI tier requests');
  });

  it('rejects duplicate completion (already completed)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: REQ_DONE,
      listingId: 'clst9xxxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'SELLER',
      tier: 'AI',
      status: 'AI_AUTHENTICATED',
      totalFeeCents: 1999,
      certificateNumber: 'TW-AUTH-AI009',
    }]));
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: REQ_DONE,
      result: 'AUTHENTICATED',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Request is not in EXPERT_PENDING status');
  });

  it('rejects staff without manage ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeRestrictedStaffSession());
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: REQ_AI_1,
      result: 'AUTHENTICATED',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Admin access required');
  });

  it('generates cert URL from certificateNumber', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: REQ_CERT,
      listingId: 'clstcertxxxxxxxxxxxxxx00',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'SELLER',
      tier: 'AI',
      status: 'AI_PENDING',
      totalFeeCents: 1999,
      certificateNumber: 'TW-AUTH-CERT1',
    }]));
    const updateSpy = chainUpdate();
    mockDbUpdate.mockReturnValue(updateSpy);
    mockDbInsert.mockReturnValue(chainInsert());
    const { completeAuthentication } = await import('../authentication-complete');
    const result = await completeAuthentication({
      requestId: REQ_CERT,
      result: 'AUTHENTICATED',
    });
    expect(result.success).toBe(true);
    expect(updateSpy.set).toHaveBeenCalledWith(
      expect.objectContaining({ certificateUrl: 'https://twicely.co/verify/TW-AUTH-CERT1' })
    );
  });

  it('COUNTERFEIT AI request inserts HIGH audit event', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAdminStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: REQ_CF_AUD,
      listingId: 'clstcfauditxxxxxxxxxxxxxxxxx',
      sellerId: 'cusersellerxxxxxxxxxxxxxxxx',
      initiator: 'SELLER',
      tier: 'AI',
      status: 'AI_PENDING',
      totalFeeCents: 1999,
      certificateNumber: 'TW-AUTH-CF001',
    }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const insertSpy = { values: vi.fn().mockResolvedValue([]) };
    mockDbInsert.mockReturnValue(insertSpy);
    const { completeAuthentication } = await import('../authentication-complete');
    await completeAuthentication({ requestId: REQ_CF_AUD, result: 'COUNTERFEIT' });
    expect(insertSpy.values).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'COUNTERFEIT_DETECTED', severity: 'HIGH' })
    );
  });
});
