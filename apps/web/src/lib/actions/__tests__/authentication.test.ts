import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDb = {
  select: mockDbSelect,
  update: mockDbUpdate,
  insert: mockDbInsert,
};

const mockGetPlatformSetting = vi.fn().mockResolvedValue(3999);
const mockComputeCompositeHash = vi.fn().mockResolvedValue('abcdef1234567890');
const mockAuthorize = vi.fn();
const mockStaffAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn().mockReturnValue({ incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) }),
}));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));
vi.mock('@twicely/authentication/phash', () => ({
  computeCompositeHash: (...args: unknown[]) => mockComputeCompositeHash(...args),
}));
vi.mock('@twicely/casl/authorize', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

// ─── Chainable mock helpers ─────────────────────────────────────────────────

function chainSelect(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };
}

function chainUpdate() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ id: 'updated' }]),
  };
}

function chainInsert(result: unknown[] = [{ id: 'new-id' }]) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
}

function makeGuestAbility() {
  return { session: null, ability: { can: () => false } };
}

function makeSellerAbility(userId = 'user-seller', sellerId = 'sp-1') {
  return {
    session: { userId, isSeller: true, sellerId, delegationId: null, onBehalfOfSellerId: null, onBehalfOfSellerProfileId: null, delegatedScopes: [], isPlatformStaff: false, platformRoles: [] },
    ability: { can: () => true },
  };
}

function makeDelegateAbility(userId = 'user-staff') {
  return {
    session: { userId, isSeller: true, sellerId: 'sp-1', delegationId: 'del-1', onBehalfOfSellerId: 'sp-owner', onBehalfOfSellerProfileId: 'sp-owner', delegatedScopes: ['listings.manage'], isPlatformStaff: false, platformRoles: [] },
    ability: { can: () => false },
  };
}

function makeStaffSession() {
  return {
    session: { staffUserId: 'staff-1', email: 'admin@twicely.co', displayName: 'Admin', isPlatformStaff: true, platformRoles: ['ADMIN'] },
    ability: { can: () => true },
  };
}

function makeStaffSessionDenied() {
  return {
    session: { staffUserId: 'staff-2', email: 'viewer@twicely.co', displayName: 'Viewer', isPlatformStaff: true, platformRoles: ['VIEWER'] },
    ability: { can: () => false },
  };
}

function makeBuyerAbility(userId = 'user-buyer') {
  return {
    session: { userId, isSeller: false, sellerId: null, delegationId: null, onBehalfOfSellerId: null, onBehalfOfSellerProfileId: null, delegatedScopes: [], isPlatformStaff: false, platformRoles: [] },
    ability: { can: () => true },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('requestItemAuthentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(3999);
    mockComputeCompositeHash.mockResolvedValue('abcdef1234567890');
  });

  it('rejects unauthenticated users', async () => {
    mockAuthorize.mockResolvedValue(makeGuestAbility());
    const { requestItemAuthentication } = await import('../authentication');
    const result = await requestItemAuthentication({
      listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      tier: 'EXPERT',
      photoUrls: ['https://r2.example.com/a.jpg', 'https://r2.example.com/b.jpg', 'https://r2.example.com/c.jpg'],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('You must be logged in');
  });

  it('rejects invalid input (missing photoUrls)', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility());
    const { requestItemAuthentication } = await import('../authentication');
    const result = await requestItemAuthentication({
      listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      tier: 'EXPERT',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('returns listing not found for missing listing', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-1'));
    mockDbSelect.mockReturnValueOnce(chainSelect([])); // listing lookup
    const { requestItemAuthentication } = await import('../authentication');
    const result = await requestItemAuthentication({
      listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      tier: 'EXPERT',
      photoUrls: ['https://r2.example.com/a.jpg', 'https://r2.example.com/b.jpg', 'https://r2.example.com/c.jpg'],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Listing not found');
  });

  it('reads fee from platform settings', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('userowner'));
    mockGetPlatformSetting.mockResolvedValue(4999);
    mockDbSelect
      .mockReturnValueOnce(chainSelect([{ id: 'clst1xxxxxxxxxxxxxxxxxxx', ownerUserId: 'userowner', status: 'ACTIVE', slug: 'myitem' }]))
      // cert uniqueness check (empty = unique)
      .mockReturnValueOnce(chainSelect([]));
    mockDbInsert.mockReturnValue(chainInsert([{ id: 'creq1xxxxxxxxxxxxxxxxxxx' }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const { requestItemAuthentication } = await import('../authentication');
    const result = await requestItemAuthentication({
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      tier: 'EXPERT',
      photoUrls: ['https://r2.example.com/a.jpg', 'https://r2.example.com/b.jpg', 'https://r2.example.com/c.jpg'],
    });
    expect(mockGetPlatformSetting).toHaveBeenCalledWith('trust.authentication.expertFeeCents', 3999);
    expect(result.success).toBe(true);
  });

  it('rejects staff delegates', async () => {
    mockAuthorize.mockResolvedValue(makeDelegateAbility());
    const { requestItemAuthentication } = await import('../authentication');
    const result = await requestItemAuthentication({
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      tier: 'EXPERT',
      photoUrls: ['https://r2.example.com/a.jpg', 'https://r2.example.com/b.jpg', 'https://r2.example.com/c.jpg'],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Delegated staff cannot create authentication requests');
  });
});

describe('approveVerifiedSeller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approveVerifiedSeller sets isAuthenticatedSeller to true', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    mockDbSelect.mockReturnValueOnce(chainSelect([{ id: 'cspsellerxxxxxxxxxxxxxxxxxxxx', userId: 'cusersellerxxxxxxxxxxxxxxxx' }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
    const { approveVerifiedSeller } = await import('../authentication');
    const result = await approveVerifiedSeller({ sellerId: 'cspsellerxxxxxxxxxxxxxxxxxxxx', approved: true });
    expect(result.success).toBe(true);
  });

  it('approveVerifiedSeller rejects non-admin users', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSessionDenied());
    mockDbSelect.mockReturnValueOnce(chainSelect([{ id: 'cspsellerxxxxxxxxxxxxxxxxxxxx', userId: 'cusersellerxxxxxxxxxxxxxxxx' }]));
    const { approveVerifiedSeller } = await import('../authentication');
    const result = await approveVerifiedSeller({ sellerId: 'cspsellerxxxxxxxxxxxxxxxxxxxx', approved: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Admin access required');
  });

  it('approveVerifiedSeller rejects unauthenticated staff', async () => {
    mockStaffAuthorize.mockResolvedValue({ session: null, ability: { can: () => false } });
    const { approveVerifiedSeller } = await import('../authentication');
    const result = await approveVerifiedSeller({ sellerId: 'cspsellerxxxxxxxxxxxxxxxxxxxx', approved: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Staff access required');
  });
});

describe('submitAuthenticationPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeCompositeHash.mockResolvedValue('abcdef1234567890');
  });

  it('rejects unauthenticated users', async () => {
    mockAuthorize.mockResolvedValue(makeGuestAbility());
    const { submitAuthenticationPhotos } = await import('../authentication');
    const result = await submitAuthenticationPhotos({
      requestId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      photoUrls: ['https://r2.example.com/a.jpg', 'https://r2.example.com/b.jpg', 'https://r2.example.com/c.jpg'],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('You must be logged in');
  });

  it('rejects unauthorized users (Forbidden)', async () => {
    mockAuthorize.mockResolvedValue(makeBuyerAbility('user-buyer'));
    mockDbSelect.mockReturnValueOnce(chainSelect([{
      id: 'req-1', status: 'EXPERT_PENDING', sellerId: 'user-seller-different',
    }]));
    const { submitAuthenticationPhotos } = await import('../authentication');
    // Override ability.can to return false for update
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-buyer', isSeller: false, sellerId: null, delegationId: null, onBehalfOfSellerId: null, onBehalfOfSellerProfileId: null, delegatedScopes: [], isPlatformStaff: false, platformRoles: [] },
      ability: { can: () => false },
    });
    const result = await submitAuthenticationPhotos({
      requestId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      photoUrls: ['https://r2.example.com/a.jpg', 'https://r2.example.com/b.jpg', 'https://r2.example.com/c.jpg'],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});
