/**
 * Tests for fraud-escalation.ts — ban path (Strike 3) + commission reversal (G3.5)
 * Split from fraud-escalation.test.ts to stay under 300 lines.
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
  details: 'Test signal', severity: 'WARNING' as const,
};

function makeAffiliate(overrides: Record<string, unknown> = {}) {
  return { id: 'aff-test-001', userId: 'user-test-001', status: 'ACTIVE', warningCount: 0, ...overrides };
}

// Sets up the 2 select calls applyBan needs: outer record, commissions
// (warningCount is now passed as a parameter — no second DB read)
function setupBanSelects(warningCount: number, commissionIds: string[] = []) {
  mockSelect
    .mockReturnValueOnce(makeSelectLimitChain([makeAffiliate({ warningCount })]))
    .mockReturnValueOnce(makeSelectWhereChain(commissionIds.map((id) => ({ id }))));
}

function setupBanUpdates(hasCommissions = false) {
  mockUpdate
    .mockReturnValueOnce(makeUpdateSetChain() as never)  // affiliate
    .mockReturnValueOnce(makeUpdateSetChain() as never); // promo codes
  if (hasCommissions) {
    mockUpdate.mockReturnValueOnce(makeUpdateSetChain() as never); // commissions
  }
}

// ─── Ban (Strike 3) ───────────────────────────────────────────────────────────

describe('escalateAffiliate — third flag (warningCount 2→3, BANNED)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sets status to BANNED on third strike', async () => {
    setupBanSelects(2);
    const affiliateUpdateChain = makeUpdateSetChain();
    mockUpdate
      .mockReturnValueOnce(affiliateUpdateChain as never)
      .mockReturnValueOnce(makeUpdateSetChain() as never);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const setArg = (affiliateUpdateChain.set as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['status']).toBe('BANNED');
  });

  it('forfeits pendingBalanceCents — sets to 0', async () => {
    setupBanSelects(2);
    const affiliateUpdateChain = makeUpdateSetChain();
    mockUpdate
      .mockReturnValueOnce(affiliateUpdateChain as never)
      .mockReturnValueOnce(makeUpdateSetChain() as never);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const setArg = (affiliateUpdateChain.set as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['pendingBalanceCents']).toBe(0);
  });

  it('forfeits availableBalanceCents — sets to 0', async () => {
    setupBanSelects(2);
    const affiliateUpdateChain = makeUpdateSetChain();
    mockUpdate
      .mockReturnValueOnce(affiliateUpdateChain as never)
      .mockReturnValueOnce(makeUpdateSetChain() as never);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const setArg = (affiliateUpdateChain.set as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['availableBalanceCents']).toBe(0);
  });

  it('deactivates all promo codes (isActive: false)', async () => {
    setupBanSelects(2);
    const promoUpdateChain = makeUpdateSetChain();
    mockUpdate
      .mockReturnValueOnce(makeUpdateSetChain() as never)
      .mockReturnValueOnce(promoUpdateChain as never);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const setArg = (promoUpdateChain.set as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['isActive']).toBe(false);
  });

  it('creates AFFILIATE_FRAUD_BANNED audit event with CRITICAL severity', async () => {
    setupBanSelects(2);
    setupBanUpdates();
    const insertChain = makeInsertValuesChain();
    mockInsert.mockReturnValue(insertChain as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const valuesArg = (insertChain.values as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(valuesArg['action']).toBe('AFFILIATE_FRAUD_BANNED');
    expect(valuesArg['severity']).toBe('CRITICAL');
  });
});

// ─── Commission reversal on ban ───────────────────────────────────────────────

describe('escalateAffiliate — commission reversal (no clawback on PAID)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('issues third db.update call for PENDING/PAYABLE commissions', async () => {
    setupBanSelects(2, ['comm-001', 'comm-002']);
    setupBanUpdates(true);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    // affiliate + promo codes + commissions = 3
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  it('sets commission status to REVERSED with reversalReason', async () => {
    setupBanSelects(2, ['comm-001']);
    const commUpdateChain = makeUpdateSetChain();
    mockUpdate
      .mockReturnValueOnce(makeUpdateSetChain() as never)
      .mockReturnValueOnce(makeUpdateSetChain() as never)
      .mockReturnValueOnce(commUpdateChain as never);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const setArg = (commUpdateChain.set as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['status']).toBe('REVERSED');
    expect(typeof setArg['reversalReason']).toBe('string');
  });

  it('does not issue commission update when no PENDING/PAYABLE commissions', async () => {
    setupBanSelects(2, []);
    setupBanUpdates(false);
    mockInsert.mockReturnValue(makeInsertValuesChain() as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    // Only 2 updates: affiliate + promo codes
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('records reversedCommissions count in audit event detailsJson', async () => {
    setupBanSelects(2, ['comm-001', 'comm-002']);
    setupBanUpdates(true);
    const insertChain = makeInsertValuesChain();
    mockInsert.mockReturnValue(insertChain as never);

    await escalateAffiliate('aff-test-001', WARNING_SIGNAL, 'SYSTEM');

    const valuesArg = (insertChain.values as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    const details = valuesArg['detailsJson'] as Record<string, unknown>;
    expect(details['reversedCommissions']).toBe(2);
  });
});
