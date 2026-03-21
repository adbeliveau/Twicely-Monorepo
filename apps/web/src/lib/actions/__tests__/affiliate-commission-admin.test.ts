import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted Mock Functions ───────────────────────────────────────────────────

const {
  mockStaffAuthorize,
  mockDbSelect,
  mockDbUpdate,
  mockDbInsert,
  mockGetPlatformSetting,
} = vi.hoisted(() => ({
  mockStaffAuthorize: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbInsert: vi.fn(),
  mockGetPlatformSetting: vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert },
}));

vi.mock('@twicely/db/schema', () => ({
  affiliate: { id: 'id', tier: 'tier', status: 'status', commissionRateBps: 'commission_rate_bps', updatedAt: 'updated_at' },
  auditEvent: { id: 'id', action: 'action' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ eq: { col, val } })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

import { updateAffiliateCommissionRate } from '../affiliate-commission-admin';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockAllowed() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'manage' && s === 'Affiliate') };
  const session = {
    staffUserId: 'staff-admin-001',
    email: 'admin@hub.twicely.co',
    displayName: 'Admin',
    isPlatformStaff: true as const,
    platformRoles: ['ADMIN'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
  return { ability, session };
}

function mockForbidden() {
  mockStaffAuthorize.mockResolvedValue({
    ability: { can: vi.fn().mockReturnValue(false) },
    session: { staffUserId: 'staff-support-001', isPlatformStaff: true as const, platformRoles: ['SUPPORT'] },
  });
}

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never;
}

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

// Mock platform settings for INFLUENCER tier — min=2000, max=3000
function mockInfluencerPlatformSettings() {
  mockGetPlatformSetting
    .mockResolvedValueOnce(2000)  // affiliate.influencer.minCommissionRateBps
    .mockResolvedValueOnce(3000); // affiliate.influencer.maxCommissionRateBps
}

// ─── Authorization ────────────────────────────────────────────────────────────

describe('updateAffiliateCommissionRate — authorization', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Forbidden when staff lacks Affiliate manage permission', async () => {
    mockForbidden();
    const result = await updateAffiliateCommissionRate({ affiliateId: 'aff-1', commissionRateBps: 2500 });
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });
});

// ─── Input Validation ─────────────────────────────────────────────────────────

describe('updateAffiliateCommissionRate — input validation', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns error when affiliateId is missing', async () => {
    mockAllowed();
    const result = await updateAffiliateCommissionRate({ commissionRateBps: 2500 });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error when commissionRateBps is non-integer', async () => {
    mockAllowed();
    const result = await updateAffiliateCommissionRate({ affiliateId: 'aff-1', commissionRateBps: 25.5 });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ─── Affiliate Lookup ─────────────────────────────────────────────────────────

describe('updateAffiliateCommissionRate — affiliate lookup', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Not found when affiliate does not exist', async () => {
    mockAllowed();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const result = await updateAffiliateCommissionRate({ affiliateId: 'aff-nonexistent', commissionRateBps: 2500 });
    expect(result).toEqual({ success: false, error: 'Not found' });
  });
});

// ─── INFLUENCER Tier Constraints ──────────────────────────────────────────────

describe('updateAffiliateCommissionRate — INFLUENCER tier', () => {
  beforeEach(() => vi.resetAllMocks());

  it('successfully updates rate within 2000-3000 bps', async () => {
    mockAllowed();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'aff-1', tier: 'INFLUENCER', status: 'ACTIVE' }]));
    mockInfluencerPlatformSettings();
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());
    mockDbInsert.mockReturnValueOnce(makeInsertChain());

    const result = await updateAffiliateCommissionRate({ affiliateId: 'aff-1', commissionRateBps: 2500 });
    expect(result).toEqual({ success: true });
  });

  it('rejects rate below min bps (1999 < 2000)', async () => {
    mockAllowed();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'aff-1', tier: 'INFLUENCER', status: 'ACTIVE' }]));
    mockInfluencerPlatformSettings();

    const result = await updateAffiliateCommissionRate({ affiliateId: 'aff-1', commissionRateBps: 1999 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Influencer commission rate must be between');
    expect(result.error).toContain('2000');
    expect(result.error).toContain('3000');
  });

  it('rejects rate above max bps (3001 > 3000)', async () => {
    mockAllowed();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'aff-1', tier: 'INFLUENCER', status: 'ACTIVE' }]));
    mockInfluencerPlatformSettings();

    const result = await updateAffiliateCommissionRate({ affiliateId: 'aff-1', commissionRateBps: 3001 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Influencer commission rate must be between');
    expect(result.error).toContain('3000');
  });

  it('creates audit event with correct details on successful update', async () => {
    const { session } = mockAllowed();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'aff-1', tier: 'INFLUENCER', status: 'ACTIVE' }]));
    mockInfluencerPlatformSettings();
    const updateChain = makeUpdateChain();
    const insertChain = makeInsertChain();
    mockDbUpdate.mockReturnValueOnce(updateChain);
    mockDbInsert.mockReturnValueOnce(insertChain);

    await updateAffiliateCommissionRate({ affiliateId: 'aff-1', commissionRateBps: 2800 });

    const auditValues = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(auditValues.action).toBe('AFFILIATE_COMMISSION_RATE_UPDATED');
    expect(auditValues.actorType).toBe('STAFF');
    expect(auditValues.actorId).toBe(session.staffUserId);
    expect(auditValues.subjectId).toBe('aff-1');
    const details = auditValues.detailsJson as Record<string, unknown>;
    expect(details.newRateBps).toBe(2800);
    expect(details.tier).toBe('INFLUENCER');
  });
});

// ─── COMMUNITY Tier ───────────────────────────────────────────────────────────

describe('updateAffiliateCommissionRate — COMMUNITY tier', () => {
  beforeEach(() => vi.resetAllMocks());

  it('successfully updates rate with platform setting lookup', async () => {
    mockAllowed();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'aff-1', tier: 'COMMUNITY', status: 'ACTIVE' }]));
    mockGetPlatformSetting.mockResolvedValueOnce(1500); // community default rate
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());
    mockDbInsert.mockReturnValueOnce(makeInsertChain());

    const result = await updateAffiliateCommissionRate({ affiliateId: 'aff-1', commissionRateBps: 1800 });
    expect(result).toEqual({ success: true });
    expect(mockGetPlatformSetting).toHaveBeenCalledWith('affiliate.community.commissionRateBps', 1500);
  });
});
