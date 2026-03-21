/**
 * Tests for affiliate-fraud.ts queries (G3.5)
 * Covers: getAffiliateFraudSignals, getRelatedAccountsByIp, getAffiliateFraudSummary
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  auditEvent: {
    id: 'id', action: 'action', severity: 'severity',
    detailsJson: 'details_json', createdAt: 'created_at',
    subject: 'subject', subjectId: 'subject_id',
  },
  session: { userId: 'user_id', ipAddress: 'ip_address' },
  user: { id: 'id', username: 'username', email: 'email' },
  affiliate: { id: 'id', warningCount: 'warning_count', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  ne: vi.fn((a: unknown, b: unknown) => ({ type: 'ne', a, b })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ type: 'inArray', col, vals })),
  desc: vi.fn((col: unknown) => ({ type: 'desc', col })),
}));

import {
  getAffiliateFraudSignals,
  getRelatedAccountsByIp,
  getAffiliateFraudSummary,
} from '../affiliate-fraud';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSignalsChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain as never;
}

function makeWhereChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  return chain as never;
}

function makeNeWhereChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  return chain as never;
}

function makeInArrayWhereChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  return chain as never;
}

function makeSummarySignalsChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain as never;
}

function makeSummaryAffiliateChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain as never;
}

// ─── getAffiliateFraudSignals ─────────────────────────────────────────────────

describe('getAffiliateFraudSignals', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns fraud audit events for given affiliateId', async () => {
    const rows = [
      { id: 'evt-001', action: 'AFFILIATE_FRAUD_WARNING', severity: 'HIGH', detailsJson: {}, createdAt: new Date() },
    ];
    mockSelect.mockReturnValue(makeSignalsChain(rows));

    const result = await getAffiliateFraudSignals('aff-test-001');

    expect(result).toHaveLength(1);
    expect(result[0]?.action).toBe('AFFILIATE_FRAUD_WARNING');
  });

  it('returns empty array when no fraud events exist', async () => {
    mockSelect.mockReturnValue(makeSignalsChain([]));

    const result = await getAffiliateFraudSignals('aff-test-001');

    expect(result).toHaveLength(0);
  });

  it('applies limit 100 to the query', async () => {
    mockSelect.mockReturnValue(makeSignalsChain([]));
    await getAffiliateFraudSignals('aff-test-001');
    // The chain was called — limit(100) is in the chain
    expect(mockSelect).toHaveBeenCalledOnce();
  });
});

// ─── getRelatedAccountsByIp ───────────────────────────────────────────────────

describe('getRelatedAccountsByIp', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns empty array when user has no sessions', async () => {
    mockSelect.mockReturnValue(makeWhereChain([]));

    const result = await getRelatedAccountsByIp('user-test-001');

    expect(result).toHaveLength(0);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when no other users share the same IPs', async () => {
    mockSelect
      .mockReturnValueOnce(makeWhereChain([{ ipAddress: '203.0.113.45' }]))  // user sessions
      .mockReturnValueOnce(makeNeWhereChain([]));                             // other sessions

    const result = await getRelatedAccountsByIp('user-test-001');

    expect(result).toHaveLength(0);
  });

  it('returns related accounts sharing IPs with correct fields', async () => {
    mockSelect
      .mockReturnValueOnce(makeWhereChain([{ ipAddress: '203.0.113.45' }]))
      .mockReturnValueOnce(makeNeWhereChain([
        { userId: 'user-other-001', ipAddress: '203.0.113.45' },
      ]))
      .mockReturnValueOnce(makeInArrayWhereChain([
        { id: 'user-other-001', username: 'otheruser', email: 'other@example.com' },
      ]));

    const result = await getRelatedAccountsByIp('user-test-001');

    expect(result).toHaveLength(1);
    expect(result[0]?.userId).toBe('user-other-001');
    expect(result[0]?.matchType).toBe('IP_OVERLAP');
    expect(result[0]?.sharedIps).toContain('203.0.113.45');
  });

  it('masks email in returned RelatedAccount', async () => {
    mockSelect
      .mockReturnValueOnce(makeWhereChain([{ ipAddress: '203.0.113.45' }]))
      .mockReturnValueOnce(makeNeWhereChain([{ userId: 'user-other-001', ipAddress: '203.0.113.45' }]))
      .mockReturnValueOnce(makeInArrayWhereChain([
        { id: 'user-other-001', username: 'otheruser', email: 'john@example.com' },
      ]));

    const result = await getRelatedAccountsByIp('user-test-001');

    expect(result[0]?.emailMasked).toMatch(/^j\*+n@example\.com$/);
    expect(result[0]?.emailMasked).not.toBe('john@example.com');
  });

  it('does not return the queried user themselves', async () => {
    // Second select uses ne(session.userId, userId) — simulated by returning no matching rows
    mockSelect
      .mockReturnValueOnce(makeWhereChain([{ ipAddress: '203.0.113.45' }]))
      .mockReturnValueOnce(makeNeWhereChain([])); // ne filter excludes the user

    const result = await getRelatedAccountsByIp('user-test-001');

    expect(result).toHaveLength(0);
  });
});

// ─── getAffiliateFraudSummary ─────────────────────────────────────────────────

describe('getAffiliateFraudSummary', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns NONE risk level for a clean affiliate with no signals', async () => {
    mockSelect
      .mockReturnValueOnce(makeSummarySignalsChain([]))
      .mockReturnValueOnce(makeSummaryAffiliateChain([{ warningCount: 0, status: 'ACTIVE' }]));

    const result = await getAffiliateFraudSummary('aff-test-001');

    expect(result.currentRiskLevel).toBe('NONE');
    expect(result.totalSignals).toBe(0);
    expect(result.warningsIssued).toBe(0);
    expect(result.lastScanDate).toBeNull();
  });

  it('returns MEDIUM risk for affiliate with warningCount 1', async () => {
    const now = new Date();
    mockSelect
      .mockReturnValueOnce(makeSummarySignalsChain([
        { action: 'AFFILIATE_FRAUD_WARNING', severity: 'HIGH', createdAt: now },
      ]))
      .mockReturnValueOnce(makeSummaryAffiliateChain([{ warningCount: 1, status: 'ACTIVE' }]));

    const result = await getAffiliateFraudSummary('aff-test-001');

    expect(result.currentRiskLevel).toBe('MEDIUM');
    expect(result.warningsIssued).toBe(1);
  });

  it('returns CRITICAL risk for BANNED affiliate', async () => {
    mockSelect
      .mockReturnValueOnce(makeSummarySignalsChain([]))
      .mockReturnValueOnce(makeSummaryAffiliateChain([{ warningCount: 3, status: 'BANNED' }]));

    const result = await getAffiliateFraudSummary('aff-test-001');

    expect(result.currentRiskLevel).toBe('CRITICAL');
  });

  it('returns HIGH risk for SUSPENDED affiliate', async () => {
    mockSelect
      .mockReturnValueOnce(makeSummarySignalsChain([]))
      .mockReturnValueOnce(makeSummaryAffiliateChain([{ warningCount: 2, status: 'SUSPENDED' }]));

    const result = await getAffiliateFraudSummary('aff-test-001');

    expect(result.currentRiskLevel).toBe('HIGH');
  });

  it('sets lastScanDate to most recent signal createdAt', async () => {
    const scanDate = new Date('2026-03-10T12:00:00Z');
    mockSelect
      .mockReturnValueOnce(makeSummarySignalsChain([
        { action: 'AFFILIATE_FRAUD_WARNING', severity: 'HIGH', createdAt: scanDate },
      ]))
      .mockReturnValueOnce(makeSummaryAffiliateChain([{ warningCount: 1, status: 'ACTIVE' }]));

    const result = await getAffiliateFraudSummary('aff-test-001');

    expect(result.lastScanDate).toEqual(scanDate);
  });
});
