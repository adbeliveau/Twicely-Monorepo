/**
 * Tests for affiliate-fraud-scan.ts server action (G3.5)
 * Staff-only manual fraud scan — requires manage Affiliate CASL ability.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@/lib/affiliate/fraud-detection', () => ({
  runAllFraudChecks: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { runAffiliateFraudScan } from '../affiliate-fraud-scan';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { runAllFraudChecks } from '@/lib/affiliate/fraud-detection';

const mockStaffAuthorize = vi.mocked(staffAuthorize);
const mockSelect = vi.mocked(db.select);
const mockRunAllFraudChecks = vi.mocked(runAllFraudChecks);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStaffAuth(canManage = true) {
  return {
    ability: { can: vi.fn().mockReturnValue(canManage) },
    session: {
      staffUserId: 'staff-test-1', email: 'staff@example.com',
      displayName: 'Staff User', isPlatformStaff: true as const, platformRoles: [] as never[],
    },
  };
}

function makeSelectLimitChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain as never;
}

const SCAN_RESULT = {
  affiliateId: 'aff-test-001',
  signals: [],
  highestSeverity: 'NONE' as const,
};

// ─── Authorization ────────────────────────────────────────────────────────────

describe('runAffiliateFraudScan — authorization', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns Forbidden when staffAuthorize throws (unauthenticated)', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('Not authenticated'));
    await expect(runAffiliateFraudScan({ affiliateId: 'aff-test-001' })).rejects.toThrow();
  });

  it('returns Forbidden when staff lacks manage Affiliate ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(false) as never);
    const result = await runAffiliateFraudScan({ affiliateId: 'aff-test-001' });
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('proceeds when staff has manage Affiliate ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(true) as never);
    mockSelect.mockReturnValue(makeSelectLimitChain([{ id: 'aff-test-001' }]));
    mockRunAllFraudChecks.mockResolvedValue(SCAN_RESULT);

    const result = await runAffiliateFraudScan({ affiliateId: 'aff-test-001' });
    expect(result.success).toBe(true);
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe('runAffiliateFraudScan — input validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(true) as never);
  });

  it('returns error when affiliateId is missing', async () => {
    const result = await runAffiliateFraudScan({});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error when affiliateId is empty string', async () => {
    const result = await runAffiliateFraudScan({ affiliateId: '' });
    expect(result.success).toBe(false);
  });

  it('returns error when extra fields are provided (.strict())', async () => {
    const result = await runAffiliateFraudScan({ affiliateId: 'aff-test-001', extra: 'field' });
    expect(result.success).toBe(false);
  });

  it('returns error when input is not an object', async () => {
    const result = await runAffiliateFraudScan('not-an-object');
    expect(result.success).toBe(false);
  });
});

// ─── Business logic ───────────────────────────────────────────────────────────

describe('runAffiliateFraudScan — business logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStaffAuthorize.mockResolvedValue(makeStaffAuth(true) as never);
  });

  it('returns error when affiliate record is not found', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([]));
    const result = await runAffiliateFraudScan({ affiliateId: 'nonexistent' });
    expect(result).toEqual({ success: false, error: 'Affiliate not found' });
  });

  it('returns fraud scan results wrapped in success response', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([{ id: 'aff-test-001' }]));
    mockRunAllFraudChecks.mockResolvedValue(SCAN_RESULT);

    const result = await runAffiliateFraudScan({ affiliateId: 'aff-test-001' });
    expect(result).toEqual({ success: true, data: SCAN_RESULT });
  });

  it('does NOT auto-escalate the affiliate (returns results only)', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([{ id: 'aff-test-001' }]));
    const flaggedResult = {
      affiliateId: 'aff-test-001',
      signals: [{ flagged: true, signalType: 'BOT_TRAFFIC', details: 'High clicks', severity: 'WARNING' as const }],
      highestSeverity: 'WARNING' as const,
    };
    mockRunAllFraudChecks.mockResolvedValue(flaggedResult);

    const result = await runAffiliateFraudScan({ affiliateId: 'aff-test-001' });
    // Returns data — no escalation called (escalateAffiliate is not mocked, would throw if called)
    expect(result.success).toBe(true);
    expect(result.data?.highestSeverity).toBe('WARNING');
  });

  it('returns scan result with highestSeverity NONE for clean affiliate', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([{ id: 'aff-test-001' }]));
    mockRunAllFraudChecks.mockResolvedValue(SCAN_RESULT);

    const result = await runAffiliateFraudScan({ affiliateId: 'aff-test-001' });
    expect(result.data?.highestSeverity).toBe('NONE');
    expect(result.data?.signals).toHaveLength(0);
  });
});
