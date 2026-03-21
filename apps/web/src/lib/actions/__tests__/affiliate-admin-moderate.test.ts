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
  suspendAffiliate,
  unsuspendAffiliate,
  banAffiliate,
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
    tier: 'COMMUNITY',
    status: 'ACTIVE',
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

function makeInsertAuditChain() {
  return mockInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  } as never);
}

// ─── suspendAffiliate ─────────────────────────────────────────────────────────

describe('suspendAffiliate — auth + validation', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Forbidden when ability.can manage Affiliate is false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(false) as never);
    const result = await suspendAffiliate({ affiliateId: AFF_ID, reason: 'Terms violation detected.' });
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('returns error for reason shorter than 10 chars', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
    const result = await suspendAffiliate({ affiliateId: AFF_ID, reason: 'Short' });
    expect(result.success).toBe(false);
  });
});

describe('suspendAffiliate — business logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
  });

  it('returns error when affiliate record not found', async () => {
    makeSelectLimitChain([]);
    const result = await suspendAffiliate({ affiliateId: AFF_ID, reason: 'Terms violation detected.' });
    expect(result).toEqual({ success: false, error: 'Affiliate record not found' });
  });

  it('returns error when affiliate is already SUSPENDED', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'SUSPENDED' })]);
    const result = await suspendAffiliate({ affiliateId: AFF_ID, reason: 'Terms violation detected.' });
    expect(result).toEqual({ success: false, error: 'Affiliate is already suspended or banned' });
  });

  it('returns error when affiliate is already BANNED', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'BANNED' })]);
    const result = await suspendAffiliate({ affiliateId: AFF_ID, reason: 'Terms violation detected.' });
    expect(result).toEqual({ success: false, error: 'Affiliate is already suspended or banned' });
  });

  it('suspends an ACTIVE affiliate and increments warningCount', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'ACTIVE', warningCount: 1 })]);
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: updateSetMock } as never);
    makeInsertAuditChain();
    const result = await suspendAffiliate({ affiliateId: AFF_ID, reason: 'Terms violation detected.' });
    expect(result).toEqual({ success: true });
    const setArg = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['status']).toBe('SUSPENDED');
    expect(setArg['warningCount']).toBe(2);
  });

  it('increments warningCount from 0 to 1 on first suspension', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'ACTIVE', warningCount: 0 })]);
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: updateSetMock } as never);
    makeInsertAuditChain();
    await suspendAffiliate({ affiliateId: AFF_ID, reason: 'Terms violation detected.' });
    const setArg = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['warningCount']).toBe(1);
  });

  it('writes AFFILIATE_SUSPENDED audit event with HIGH severity', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'ACTIVE', warningCount: 0 })]);
    mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValuesMock } as never);
    await suspendAffiliate({ affiliateId: AFF_ID, reason: 'Terms violation detected.' });
    const auditArg = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(auditArg['action']).toBe('AFFILIATE_SUSPENDED');
    expect(auditArg['severity']).toBe('HIGH');
  });
});

// ─── unsuspendAffiliate ───────────────────────────────────────────────────────

describe('unsuspendAffiliate — auth + business logic', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Forbidden when ability.can manage Affiliate is false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(false) as never);
    const result = await unsuspendAffiliate({ affiliateId: AFF_ID });
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('returns error when affiliate record not found', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
    makeSelectLimitChain([]);
    const result = await unsuspendAffiliate({ affiliateId: AFF_ID });
    expect(result).toEqual({ success: false, error: 'Affiliate record not found' });
  });

  it('returns error when affiliate is not SUSPENDED', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
    makeSelectLimitChain([makeAffiliate({ status: 'ACTIVE' })]);
    const result = await unsuspendAffiliate({ affiliateId: AFF_ID });
    expect(result).toEqual({ success: false, error: 'Affiliate is not currently suspended' });
  });

  it('reactivates a SUSPENDED affiliate to ACTIVE and clears suspension fields', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
    makeSelectLimitChain([makeAffiliate({ status: 'SUSPENDED' })]);
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: updateSetMock } as never);
    makeInsertAuditChain();
    const result = await unsuspendAffiliate({ affiliateId: AFF_ID });
    expect(result).toEqual({ success: true });
    const setArg = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['status']).toBe('ACTIVE');
    expect(setArg['suspendedAt']).toBeNull();
    expect(setArg['suspendedReason']).toBeNull();
  });

  it('writes AFFILIATE_UNSUSPENDED audit event on success', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
    makeSelectLimitChain([makeAffiliate({ status: 'SUSPENDED' })]);
    mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValuesMock } as never);
    await unsuspendAffiliate({ affiliateId: AFF_ID });
    const auditArg = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(auditArg['action']).toBe('AFFILIATE_UNSUSPENDED');
  });
});

// ─── banAffiliate ─────────────────────────────────────────────────────────────

describe('banAffiliate — auth + validation', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Forbidden when ability.can manage Affiliate is false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(false) as never);
    const result = await banAffiliate({ affiliateId: AFF_ID, reason: 'Fraudulent activity found.' });
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('returns error for reason shorter than 10 chars', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
    const result = await banAffiliate({ affiliateId: AFF_ID, reason: 'Fraud' });
    expect(result.success).toBe(false);
  });
});

describe('banAffiliate — business logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
  });

  it('returns error when affiliate record not found', async () => {
    makeSelectLimitChain([]);
    const result = await banAffiliate({ affiliateId: AFF_ID, reason: 'Fraudulent activity found.' });
    expect(result).toEqual({ success: false, error: 'Affiliate record not found' });
  });

  it('returns error when affiliate is already BANNED', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'BANNED' })]);
    const result = await banAffiliate({ affiliateId: AFF_ID, reason: 'Fraudulent activity found.' });
    expect(result).toEqual({ success: false, error: 'Affiliate is already banned' });
  });

  it('bans an ACTIVE affiliate and issues two db.update calls (affiliate + promo codes)', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'ACTIVE' })]);
    mockUpdate
      .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never)
      .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);
    makeInsertAuditChain();
    const result = await banAffiliate({ affiliateId: AFF_ID, reason: 'Fraudulent activity found.' });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('also bans a SUSPENDED affiliate (not already banned)', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'SUSPENDED' })]);
    mockUpdate
      .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never)
      .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);
    makeInsertAuditChain();
    const result = await banAffiliate({ affiliateId: AFF_ID, reason: 'Fraudulent activity found.' });
    expect(result).toEqual({ success: true });
  });

  it('sets affiliate status to BANNED in first update', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'ACTIVE' })]);
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate
      .mockReturnValueOnce({ set: updateSetMock } as never)
      .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);
    makeInsertAuditChain();
    await banAffiliate({ affiliateId: AFF_ID, reason: 'Fraudulent activity found.' });
    const setArg = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['status']).toBe('BANNED');
  });

  it('deactivates promo codes (isActive: false) in second update', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'ACTIVE' })]);
    const promoUpdateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate
      .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never)
      .mockReturnValueOnce({ set: promoUpdateSetMock } as never);
    makeInsertAuditChain();
    await banAffiliate({ affiliateId: AFF_ID, reason: 'Fraudulent activity found.' });
    const promoSetArg = promoUpdateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(promoSetArg['isActive']).toBe(false);
  });

  it('writes AFFILIATE_BANNED audit event with CRITICAL severity', async () => {
    makeSelectLimitChain([makeAffiliate({ status: 'ACTIVE' })]);
    mockUpdate
      .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never)
      .mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValuesMock } as never);
    await banAffiliate({ affiliateId: AFF_ID, reason: 'Fraudulent activity found.' });
    const auditArg = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(auditArg['action']).toBe('AFFILIATE_BANNED');
    expect(auditArg['severity']).toBe('CRITICAL');
  });
});
