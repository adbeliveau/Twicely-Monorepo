/**
 * Tests for fraud-escalation.ts — strikes 1 and 2 + edge cases (G3.5)
 * See fraud-escalation-ban.test.ts for ban/commission reversal tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ─── Hoisted mock fns ──────────────────────────────────────────────────────────

const { mockSelect, mockUpdate, mockInsert, mockNotify } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockNotify: vi.fn(),
}));

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  affiliate: {
    id: 'id', userId: 'user_id', status: 'status',
    warningCount: 'warning_count', suspendedAt: 'suspended_at',
    suspendedReason: 'suspended_reason', pendingBalanceCents: 'pending_balance_cents',
    availableBalanceCents: 'available_balance_cents', updatedAt: 'updated_at',
  },
  affiliateCommission: {
    id: 'id', affiliateId: 'affiliate_id', status: 'status',
    reversedAt: 'reversed_at', reversalReason: 'reversal_reason',
  },
  promoCode: { affiliateId: 'affiliate_id', isActive: 'is_active', updatedAt: 'updated_at' },
  auditEvent: {
    actorType: 'actor_type', actorId: 'actor_id', action: 'action',
    subject: 'subject', subjectId: 'subject_id', severity: 'severity',
    detailsJson: 'details_json',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ type: 'inArray', col, vals })),
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(30),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { escalateAffiliate } from '../fraud-escalation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectLimitChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain as never;
}

function makeSelectWhereChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  return chain as never;
}

function makeUpdateSetChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function makeInsertValuesChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

const WARNING_SIGNAL = {
  flagged: true, signalType: 'BOT_TRAFFIC',
  details: 'Test bot traffic signal', severity: 'WARNING' as const,
};

const SUSPEND_SIGNAL = {
  flagged: true, signalType: 'GEO_ANOMALY',
  details: 'Test geo anomaly signal', severity: 'SUSPEND' as const,
};

const BAN_SIGNAL = {
  flagged: true, signalType: 'FAKE_ACCOUNTS',
  details: 'Confirmed fake account farm', severity: 'BAN' as const,
};

function makeAffiliate(overrides: Record<string, unknown> = {}) {
  return { id: 'aff-test-001', userId: 'user-test-001', status: 'ACTIVE', warningCount: 0, ...overrides };
}

// ─── Warning (Strike 1) ───────────────────────────────────────────────────────

describe('escalateAffiliate — first flag (warningCount 0→1)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('increments warningCount to 1', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([makeAffiliate({ warningCount: 0 })]));
    const updateChain = makeUpdateSetChain();
    mockUpdate.mockReturnValue(updateChain as never);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const setArg = (updateChain.set as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['warningCount']).toBe(1);
  });

  it('does NOT set status — affiliate stays ACTIVE', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([makeAffiliate({ warningCount: 0 })]));
    const updateChain = makeUpdateSetChain();
    mockUpdate.mockReturnValue(updateChain as never);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const setArg = (updateChain.set as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['status']).toBeUndefined();
  });

  it('creates AFFILIATE_FRAUD_WARNING audit event with HIGH severity', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([makeAffiliate({ warningCount: 0 })]));
    mockUpdate.mockReturnValue(makeUpdateSetChain() as never);
    const insertChain = makeInsertValuesChain();
    mockInsert.mockReturnValue(insertChain as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const valuesArg = (insertChain.values as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(valuesArg['action']).toBe('AFFILIATE_FRAUD_WARNING');
    expect(valuesArg['severity']).toBe('HIGH');
  });

  it('sends affiliate.fraud_warning notification with warningNumber 1', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([makeAffiliate({ warningCount: 0 })]));
    mockUpdate.mockReturnValue(makeUpdateSetChain() as never);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    expect(mockNotify).toHaveBeenCalledWith(
      'user-test-001', 'affiliate.fraud_warning',
      expect.objectContaining({ warningNumber: '1' }),
    );
  });
});

// ─── Suspension (Strike 2) ────────────────────────────────────────────────────

describe('escalateAffiliate — second flag (warningCount 1→2, SUSPENDED)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sets status to SUSPENDED and warningCount to 2', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([makeAffiliate({ warningCount: 1 })]));
    const updateChain = makeUpdateSetChain();
    mockUpdate.mockReturnValue(updateChain as never);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const setArg = (updateChain.set as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['status']).toBe('SUSPENDED');
    expect(setArg['warningCount']).toBe(2);
  });

  it('creates AFFILIATE_FRAUD_SUSPENDED audit event', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([makeAffiliate({ warningCount: 1 })]));
    mockUpdate.mockReturnValue(makeUpdateSetChain() as never);
    const insertChain = makeInsertValuesChain();
    mockInsert.mockReturnValue(insertChain as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const valuesArg = (insertChain.values as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(valuesArg['action']).toBe('AFFILIATE_FRAUD_SUSPENDED');
  });

  it('sends affiliate.fraud_suspended notification', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([makeAffiliate({ warningCount: 1 })]));
    mockUpdate.mockReturnValue(makeUpdateSetChain() as never);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    expect(mockNotify).toHaveBeenCalledWith('user-test-001', 'affiliate.fraud_suspended', expect.any(Object));
  });

  it('skips SUSPEND signal on an already-SUSPENDED affiliate', async () => {
    mockSelect.mockReturnValue(
      makeSelectLimitChain([makeAffiliate({ status: 'SUSPENDED', warningCount: 1 })]),
    );

    await escalateAffiliate('aff-test-001', SUSPEND_SIGNAL, 'SYSTEM');

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('escalateAffiliate — edge cases', () => {
  beforeEach(() => vi.resetAllMocks());

  it('does not escalate an already-BANNED affiliate', async () => {
    mockSelect.mockReturnValue(
      makeSelectLimitChain([makeAffiliate({ status: 'BANNED', warningCount: 3 })]),
    );

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('severity BAN bypasses three-strikes — immediate ban at warningCount 0', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectLimitChain([makeAffiliate({ warningCount: 0 })]))
      .mockReturnValueOnce(makeSelectWhereChain([]));
    const affiliateUpdateChain = makeUpdateSetChain();
    mockUpdate
      .mockReturnValueOnce(affiliateUpdateChain as never)
      .mockReturnValueOnce(makeUpdateSetChain() as never);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', BAN_SIGNAL, 'SYSTEM');

    const setArg = (affiliateUpdateChain.set as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['status']).toBe('BANNED');
  });

  it('returns without error when affiliate record is not found', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([]));

    await expect(escalateAffiliate('nonexistent-aff', WARNING_SIGNAL, 'SYSTEM')).resolves.toBeUndefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
