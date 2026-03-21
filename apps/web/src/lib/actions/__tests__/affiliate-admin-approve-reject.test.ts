import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

import {
  approveInfluencerApplication,
  rejectInfluencerApplication,
} from '../affiliate-admin';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';

const mockStaffAuthorize = vi.mocked(staffAuthorize);
const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);

const AFF_ID = 'aff-test-1';
const USER_ID = 'user-test-1';
const STAFF_ID = 'staff-test-1';

function makeAbility(canManage = true) {
  return { can: vi.fn().mockReturnValue(canManage) };
}

function makeStaffSession() {
  return {
    staffUserId: STAFF_ID,
    email: 'staff@example.com',
    displayName: 'Staff User',
    isPlatformStaff: true as const,
    platformRoles: [] as never[],
  };
}

function makeStaffAuth(canManage = true) {
  return { ability: makeAbility(canManage), session: makeStaffSession() };
}

function makeAffiliate(overrides: Record<string, unknown> = {}) {
  return {
    id: AFF_ID,
    userId: USER_ID,
    tier: 'INFLUENCER',
    status: 'PENDING',
    applicationNote: 'My application note here.',
    warningCount: 0,
    ...overrides,
  };
}

function makeSelectLimitChain(rows: unknown[]) {
  return mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never);
}

function makeUpdateChain() {
  return mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as never);
}

function makeInsertAuditChain() {
  return mockInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  } as never);
}

// ─── approveInfluencerApplication ────────────────────────────────────────────

describe('approveInfluencerApplication — auth checks', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Forbidden when ability.can manage Affiliate is false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(false) as never);
    const result = await approveInfluencerApplication({ affiliateId: AFF_ID, commissionRateBps: 2500, cookieDurationDays: 60, commissionDurationMonths: 12 });
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });
});

describe('approveInfluencerApplication — validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
  });

  it('returns error for missing affiliateId', async () => {
    const result = await approveInfluencerApplication({ commissionRateBps: 2500 });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error for commissionRateBps below 2000 (minimum 20%)', async () => {
    const result = await approveInfluencerApplication({ affiliateId: AFF_ID, commissionRateBps: 1999, cookieDurationDays: 60, commissionDurationMonths: 12 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Minimum commission is 20%');
  });

  it('returns error for commissionRateBps above 3000 (maximum 30%)', async () => {
    const result = await approveInfluencerApplication({ affiliateId: AFF_ID, commissionRateBps: 3001, cookieDurationDays: 60, commissionDurationMonths: 12 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum commission is 30%');
  });

  it('returns error for unknown fields (strict schema)', async () => {
    const result = await approveInfluencerApplication({ affiliateId: AFF_ID, commissionRateBps: 2500, cookieDurationDays: 60, commissionDurationMonths: 12, extra: true });
    expect(result.success).toBe(false);
  });
});

describe('approveInfluencerApplication — business logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
  });

  it('returns error when affiliate record not found', async () => {
    makeSelectLimitChain([]);
    const result = await approveInfluencerApplication({ affiliateId: AFF_ID, commissionRateBps: 2500, cookieDurationDays: 60, commissionDurationMonths: 12 });
    expect(result).toEqual({ success: false, error: 'Affiliate record not found' });
  });

  it('returns error when affiliate is not INFLUENCER PENDING', async () => {
    makeSelectLimitChain([makeAffiliate({ tier: 'COMMUNITY', status: 'ACTIVE' })]);
    const result = await approveInfluencerApplication({ affiliateId: AFF_ID, commissionRateBps: 2500, cookieDurationDays: 60, commissionDurationMonths: 12 });
    expect(result).toEqual({ success: false, error: 'This application is not pending influencer review' });
  });

  it('returns error when status is not PENDING (already approved)', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'ACTIVE', tier: 'INFLUENCER' })]);
    const result = await approveInfluencerApplication({ affiliateId: AFF_ID, commissionRateBps: 2500, cookieDurationDays: 60, commissionDurationMonths: 12 });
    expect(result).toEqual({ success: false, error: 'This application is not pending influencer review' });
  });

  it('returns success and updates affiliate to ACTIVE', async () => {
    makeSelectLimitChain([makeAffiliate()]);
    makeUpdateChain();
    makeInsertAuditChain();
    const result = await approveInfluencerApplication({ affiliateId: AFF_ID, commissionRateBps: 2500, cookieDurationDays: 60, commissionDurationMonths: 12 });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('writes INFLUENCER_APPROVED audit event with MEDIUM severity', async () => {
    makeSelectLimitChain([makeAffiliate()]);
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);
    mockInsert.mockReturnValue({ values: insertValuesMock } as never);
    await approveInfluencerApplication({ affiliateId: AFF_ID, commissionRateBps: 2500, cookieDurationDays: 60, commissionDurationMonths: 12 });
    const auditArg = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(auditArg['action']).toBe('INFLUENCER_APPROVED');
    expect(auditArg['severity']).toBe('MEDIUM');
  });

  it('stores commissionRateBps in the update payload', async () => {
    makeSelectLimitChain([makeAffiliate()]);
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: updateSetMock } as never);
    makeInsertAuditChain();
    await approveInfluencerApplication({ affiliateId: AFF_ID, commissionRateBps: 2800, cookieDurationDays: 60, commissionDurationMonths: 12 });
    const setArg = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['commissionRateBps']).toBe(2800);
    expect(setArg['status']).toBe('ACTIVE');
  });
});

// ─── rejectInfluencerApplication ─────────────────────────────────────────────

describe('rejectInfluencerApplication — auth checks', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Forbidden when ability.can manage Affiliate is false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(false) as never);
    const result = await rejectInfluencerApplication({ affiliateId: AFF_ID, rejectionReason: 'Not enough followers.' });
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });
});

describe('rejectInfluencerApplication — business logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
  });

  it('returns error when affiliate record not found', async () => {
    makeSelectLimitChain([]);
    const result = await rejectInfluencerApplication({ affiliateId: AFF_ID, rejectionReason: 'Not enough followers.' });
    expect(result).toEqual({ success: false, error: 'Affiliate record not found' });
  });

  it('returns error when affiliate is not INFLUENCER PENDING', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'ACTIVE' })]);
    const result = await rejectInfluencerApplication({ affiliateId: AFF_ID, rejectionReason: 'Not enough followers.' });
    expect(result).toEqual({ success: false, error: 'This application is not pending influencer review' });
  });

  it('reverts affiliate to COMMUNITY ACTIVE on rejection', async () => {
    makeSelectLimitChain([makeAffiliate()]);
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: updateSetMock } as never);
    makeInsertAuditChain();
    const result = await rejectInfluencerApplication({ affiliateId: AFF_ID, rejectionReason: 'Not enough followers.' });
    expect(result).toEqual({ success: true });
    const setArg = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['tier']).toBe('COMMUNITY');
    expect(setArg['status']).toBe('ACTIVE');
  });

  it('appends rejection reason to existing applicationNote', async () => {
    makeSelectLimitChain([makeAffiliate({ applicationNote: 'Original note.' })]);
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: updateSetMock } as never);
    makeInsertAuditChain();
    await rejectInfluencerApplication({ affiliateId: AFF_ID, rejectionReason: 'Not enough followers.' });
    const setArg = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['applicationNote'] as string).toContain('Original note.');
    expect(setArg['applicationNote'] as string).toContain('[REJECTED]');
    expect(setArg['applicationNote'] as string).toContain('Not enough followers.');
  });

  it('handles null applicationNote when appending rejection reason', async () => {
    makeSelectLimitChain([makeAffiliate({ applicationNote: null })]);
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: updateSetMock } as never);
    makeInsertAuditChain();
    await rejectInfluencerApplication({ affiliateId: AFF_ID, rejectionReason: 'Not enough followers.' });
    const setArg = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['applicationNote'] as string).toBe('[REJECTED] Not enough followers.');
  });

  it('writes INFLUENCER_REJECTED audit event', async () => {
    makeSelectLimitChain([makeAffiliate()]);
    mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValuesMock } as never);
    await rejectInfluencerApplication({ affiliateId: AFF_ID, rejectionReason: 'Not enough followers.' });
    const auditArg = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(auditArg['action']).toBe('INFLUENCER_REJECTED');
    expect(auditArg['actorType']).toBe('STAFF');
  });
});
