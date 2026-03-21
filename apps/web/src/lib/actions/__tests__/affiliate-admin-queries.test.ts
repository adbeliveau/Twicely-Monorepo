import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockGetCommissionsForAdmin = vi.fn();
const mockGetPayoutsForAdmin = vi.fn();
const mockGetAffiliatePayoutList = vi.fn();
vi.mock('@/lib/queries/affiliate-payout-admin', () => ({
  getCommissionsForAdmin: (...args: unknown[]) => mockGetCommissionsForAdmin(...args),
  getPayoutsForAdmin: (...args: unknown[]) => mockGetPayoutsForAdmin(...args),
  getAffiliatePayoutList: (...args: unknown[]) => mockGetAffiliatePayoutList(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockCanManageAffiliate() {
  mockStaffAuthorize.mockResolvedValue({
    ability: { can: vi.fn((a: string, s: string) => a === 'manage' && s === 'Affiliate') },
    session: { staffUserId: 'staff-admin-001', isPlatformStaff: true as const, platformRoles: ['ADMIN'] },
  });
}

function mockCanManageAffiliatePayout() {
  mockStaffAuthorize.mockResolvedValue({
    ability: { can: vi.fn((a: string, s: string) => a === 'manage' && s === 'AffiliatePayout') },
    session: { staffUserId: 'staff-admin-001', isPlatformStaff: true as const, platformRoles: ['ADMIN'] },
  });
}

function mockForbiddenAll() {
  mockStaffAuthorize.mockResolvedValue({
    ability: { can: vi.fn().mockReturnValue(false) },
    session: { staffUserId: 'staff-support-001', isPlatformStaff: true as const, platformRoles: ['SUPPORT'] },
  });
}

const mockCommissionRows = [
  {
    commissionId: 'comm-1',
    subscriptionProduct: 'store_pro',
    grossRevenueCents: 2999,
    netRevenueCents: 2700,
    commissionRateBps: 1500,
    commissionCents: 405,
    status: 'PENDING',
    holdExpiresAt: new Date(),
    paidAt: null,
    reversedAt: null,
    reversalReason: null,
    createdAt: new Date(),
  },
];

const mockPayoutRows = [
  {
    id: 'payout-1',
    affiliateId: 'aff-1',
    amountCents: 5000,
    method: 'stripe_connect',
    externalPayoutId: null,
    status: 'COMPLETED',
    periodStart: new Date(),
    periodEnd: new Date(),
    failedReason: null,
    createdAt: new Date(),
    completedAt: new Date(),
  },
];

const mockPayoutListRows = [
  {
    payoutId: 'payout-1',
    affiliateId: 'aff-1',
    affiliateUsername: 'seller1',
    affiliateEmail: 'seller1@example.com',
    amountCents: 7500,
    method: 'stripe_connect',
    status: 'PENDING',
    periodStart: new Date(),
    periodEnd: new Date(),
    failedReason: null,
    createdAt: new Date(),
    completedAt: null,
    externalPayoutId: null,
  },
];

// ─── fetchCommissionsForAdmin ─────────────────────────────────────────────────

describe('fetchCommissionsForAdmin', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns success with paginated commission data', async () => {
    mockCanManageAffiliate();
    mockGetCommissionsForAdmin.mockResolvedValue({ rows: mockCommissionRows, total: 1 });

    const { fetchCommissionsForAdmin } = await import('../affiliate-admin-queries');
    const result = await fetchCommissionsForAdmin({ affiliateId: 'aff-1', page: 1, pageSize: 10 });

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockGetCommissionsForAdmin).toHaveBeenCalledWith({ affiliateId: 'aff-1', status: undefined, limit: 10, offset: 0 });
  });

  it('returns Forbidden when caller lacks Affiliate manage permission', async () => {
    mockForbiddenAll();
    const { fetchCommissionsForAdmin } = await import('../affiliate-admin-queries');

    const result = await fetchCommissionsForAdmin({ affiliateId: 'aff-1', page: 1, pageSize: 10 });
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('returns error when required field affiliateId is missing', async () => {
    mockCanManageAffiliate();
    const { fetchCommissionsForAdmin } = await import('../affiliate-admin-queries');

    const result = await fetchCommissionsForAdmin({ page: 1, pageSize: 10 });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('calculates correct offset for page 2', async () => {
    mockCanManageAffiliate();
    mockGetCommissionsForAdmin.mockResolvedValue({ rows: [], total: 25 });

    const { fetchCommissionsForAdmin } = await import('../affiliate-admin-queries');
    await fetchCommissionsForAdmin({ affiliateId: 'aff-1', page: 2, pageSize: 10 });

    expect(mockGetCommissionsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 10, limit: 10 }),
    );
  });
});

// ─── fetchPayoutsForAdmin ─────────────────────────────────────────────────────

describe('fetchPayoutsForAdmin', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns success with paginated payout data', async () => {
    mockCanManageAffiliatePayout();
    mockGetPayoutsForAdmin.mockResolvedValue({ rows: mockPayoutRows, total: 1 });

    const { fetchPayoutsForAdmin } = await import('../affiliate-admin-queries');
    const result = await fetchPayoutsForAdmin({ affiliateId: 'aff-1', page: 1, pageSize: 10 });

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockGetPayoutsForAdmin).toHaveBeenCalledWith({ affiliateId: 'aff-1', limit: 10, offset: 0 });
  });

  it('returns Forbidden when caller lacks AffiliatePayout manage permission', async () => {
    mockForbiddenAll();
    const { fetchPayoutsForAdmin } = await import('../affiliate-admin-queries');

    const result = await fetchPayoutsForAdmin({ affiliateId: 'aff-1', page: 1, pageSize: 10 });
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('returns error when required field affiliateId is missing', async () => {
    mockCanManageAffiliatePayout();
    const { fetchPayoutsForAdmin } = await import('../affiliate-admin-queries');

    const result = await fetchPayoutsForAdmin({ page: 1, pageSize: 10 });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ─── fetchAffiliatePayoutList ─────────────────────────────────────────────────

describe('fetchAffiliatePayoutList', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns success with paginated payout list', async () => {
    mockCanManageAffiliatePayout();
    mockGetAffiliatePayoutList.mockResolvedValue({ rows: mockPayoutListRows, total: 1 });

    const { fetchAffiliatePayoutList } = await import('../affiliate-admin-queries');
    const result = await fetchAffiliatePayoutList({ page: 1, pageSize: 10 });

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockGetAffiliatePayoutList).toHaveBeenCalledWith({ status: undefined, limit: 10, offset: 0 });
  });

  it('returns Forbidden when caller lacks AffiliatePayout manage permission', async () => {
    mockForbiddenAll();
    const { fetchAffiliatePayoutList } = await import('../affiliate-admin-queries');

    const result = await fetchAffiliatePayoutList({ page: 1, pageSize: 10 });
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('filters by status parameter when provided', async () => {
    mockCanManageAffiliatePayout();
    mockGetAffiliatePayoutList.mockResolvedValue({ rows: mockPayoutListRows, total: 1 });

    const { fetchAffiliatePayoutList } = await import('../affiliate-admin-queries');
    const result = await fetchAffiliatePayoutList({ status: 'PENDING', page: 1, pageSize: 10 });

    expect(result.success).toBe(true);
    expect(mockGetAffiliatePayoutList).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING' }),
    );
  });

  it('returns error when extra field is provided (strict schema)', async () => {
    mockCanManageAffiliatePayout();
    const { fetchAffiliatePayoutList } = await import('../affiliate-admin-queries');

    const result = await fetchAffiliatePayoutList({ page: 1, pageSize: 10, unknownField: 'x' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
