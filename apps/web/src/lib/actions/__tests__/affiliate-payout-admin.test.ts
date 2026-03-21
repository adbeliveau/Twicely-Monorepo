/**
 * Tests for affiliate-payout-admin.ts — triggerAffiliatePayoutManually()
 * Requires staff AffiliatePayout manage permission.
 * Runs commission graduation + payout execution, creates audit event.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { insert: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  auditEvent: { id: 'id' },
}));

vi.mock('@/lib/affiliate/commission-graduation', () => ({
  graduateCommissions: vi.fn(),
}));

vi.mock('@/lib/affiliate/affiliate-payout-service', () => ({
  executeAffiliatePayouts: vi.fn(),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { triggerAffiliatePayoutManually } from '../affiliate-payout-admin';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { graduateCommissions } from '@/lib/affiliate/commission-graduation';
import { executeAffiliatePayouts } from '@/lib/affiliate/affiliate-payout-service';

const mockStaffAuthorize = vi.mocked(staffAuthorize);
const mockInsert = vi.mocked(db.insert);
const mockGraduateCommissions = vi.mocked(graduateCommissions);
const mockExecuteAffiliatePayouts = vi.mocked(executeAffiliatePayouts);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STAFF_ID = 'staff-test-001';

function makeStaffAuth(canManage = true) {
  return {
    ability: { can: vi.fn().mockReturnValue(canManage) },
    session: {
      staffUserId: STAFF_ID,
      email: 'staff@example.com',
      displayName: 'Finance Staff',
      isPlatformStaff: true as const,
      platformRoles: [] as never[],
    },
  };
}

function makeInsertValuesChain() {
  return {
    values: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Authentication / Authorization ───────────────────────────────────────────

describe('triggerAffiliatePayoutManually — authentication', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns error when staffAuthorize throws (not authenticated)', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('No staff session'));

    const result = await triggerAffiliatePayoutManually();

    expect(result).toEqual({ success: false, error: 'Staff authentication required' });
  });

  it('does not call graduation or payout when authentication fails', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('No staff session'));

    await triggerAffiliatePayoutManually();

    expect(mockGraduateCommissions).not.toHaveBeenCalled();
    expect(mockExecuteAffiliatePayouts).not.toHaveBeenCalled();
  });
});

describe('triggerAffiliatePayoutManually — authorization', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Forbidden when ability.can manage AffiliatePayout is false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(false) as never);

    const result = await triggerAffiliatePayoutManually();

    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('checks AffiliatePayout subject for manage permission', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(false) as never);

    await triggerAffiliatePayoutManually();

    const auth = makeStaffAuth(false);
    expect(auth.ability.can('manage', 'AffiliatePayout')).toBe(false);
  });

  it('does not call graduation or payout when authorization fails', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(false) as never);

    await triggerAffiliatePayoutManually();

    expect(mockGraduateCommissions).not.toHaveBeenCalled();
    expect(mockExecuteAffiliatePayouts).not.toHaveBeenCalled();
  });
});

// ─── Happy Path ───────────────────────────────────────────────────────────────

describe('triggerAffiliatePayoutManually — happy path', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
    mockGraduateCommissions.mockResolvedValue({ graduatedCount: 5, totalCents: 2500 });
    mockExecuteAffiliatePayouts.mockResolvedValue({
      payoutCount: 3,
      totalPaidCents: 15000,
      failedCount: 0,
    });
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);
  });

  it('returns success: true with result summary', async () => {
    const result = await triggerAffiliatePayoutManually();

    expect(result).toEqual({
      success: true,
      graduatedCount: 5,
      payoutCount: 3,
      totalPaidCents: 15000,
    });
  });

  it('calls graduateCommissions once', async () => {
    await triggerAffiliatePayoutManually();

    expect(mockGraduateCommissions).toHaveBeenCalledOnce();
  });

  it('calls executeAffiliatePayouts once', async () => {
    await triggerAffiliatePayoutManually();

    expect(mockExecuteAffiliatePayouts).toHaveBeenCalledOnce();
  });

  it('creates audit event with AFFILIATE_PAYOUT_TRIGGERED action', async () => {
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValuesMock } as never);

    await triggerAffiliatePayoutManually();

    expect(mockInsert).toHaveBeenCalledOnce();
    const auditArg = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(auditArg['action']).toBe('AFFILIATE_PAYOUT_TRIGGERED');
  });

  it('audit event has STAFF actorType and staffUserId', async () => {
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValuesMock } as never);

    await triggerAffiliatePayoutManually();

    const auditArg = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(auditArg['actorType']).toBe('STAFF');
    expect(auditArg['actorId']).toBe(STAFF_ID);
  });

  it('audit event has HIGH severity', async () => {
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValuesMock } as never);

    await triggerAffiliatePayoutManually();

    const auditArg = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(auditArg['severity']).toBe('HIGH');
  });

  it('audit event detailsJson includes graduation and payout counts', async () => {
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValuesMock } as never);

    await triggerAffiliatePayoutManually();

    const auditArg = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const details = auditArg['detailsJson'] as Record<string, unknown>;
    expect(details['graduatedCount']).toBe(5);
    expect(details['graduatedCents']).toBe(2500);
    expect(details['payoutCount']).toBe(3);
    expect(details['totalPaidCents']).toBe(15000);
    expect(details['failedCount']).toBe(0);
  });

  it('audit event subject is AffiliatePayout', async () => {
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValuesMock } as never);

    await triggerAffiliatePayoutManually();

    const auditArg = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(auditArg['subject']).toBe('AffiliatePayout');
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('triggerAffiliatePayoutManually — internal error handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth() as never);
  });

  it('returns success: false when graduateCommissions throws', async () => {
    mockGraduateCommissions.mockRejectedValue(new Error('DB connection lost'));

    const result = await triggerAffiliatePayoutManually();

    expect(result.success).toBe(false);
    expect(result.error).toContain('DB connection lost');
  });

  it('returns success: false when executeAffiliatePayouts throws', async () => {
    mockGraduateCommissions.mockResolvedValue({ graduatedCount: 0, totalCents: 0 });
    mockExecuteAffiliatePayouts.mockRejectedValue(new Error('Stripe unavailable'));

    const result = await triggerAffiliatePayoutManually();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Stripe unavailable');
  });

  it('returns generic error message when thrown value is not an Error instance', async () => {
    mockGraduateCommissions.mockRejectedValue('string error');

    const result = await triggerAffiliatePayoutManually();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Payout job failed');
  });

  it('does not insert audit event when graduation throws', async () => {
    mockGraduateCommissions.mockRejectedValue(new Error('DB error'));

    await triggerAffiliatePayoutManually();

    expect(mockInsert).not.toHaveBeenCalled();
  });
});
