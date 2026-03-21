/**
 * Tests for fraud-detection-types helpers and check functions 1-4 (G3.5)
 * Split from full suite — see fraud-detection-checks.test.ts for remaining checks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock fns ──────────────────────────────────────────────────────────

const { mockSelect, mockGetPlatformSetting } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockGetPlatformSetting: vi.fn(),
}));

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  session: { id: 'id', userId: 'user_id', ipAddress: 'ip_address' },
  referral: {
    id: 'id', affiliateId: 'affiliate_id', status: 'status',
    ipAddress: 'ip_address', clickedAt: 'clicked_at',
    convertedAt: 'converted_at', churnedAt: 'churned_at', signedUpAt: 'signed_up_at',
  },
  sellerProfile: { userId: 'user_id', stripeCustomerId: 'stripe_customer_id' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  gte: vi.fn((a: unknown, b: unknown) => ({ type: 'gte', a, b })),
  count: vi.fn(() => ({ type: 'count' })),
  isNotNull: vi.fn((a: unknown) => ({ type: 'isNotNull', a })),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { isExcludedIp, getSubnet24, highestOf } from '../fraud-detection-types';
import {
  checkSelfReferralByIp,
  checkRapidChurn,
  checkBotTraffic,
  checkSamePaymentMethod,
} from '../fraud-detection';

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

// ─── Type helper tests ───────────────────────────────────────────────────────

describe('isExcludedIp', () => {
  it('returns true for 127.0.0.1 (loopback)', () => expect(isExcludedIp('127.0.0.1')).toBe(true));
  it('returns true for ::1 (IPv6 loopback)', () => expect(isExcludedIp('::1')).toBe(true));
  it('returns true for localhost', () => expect(isExcludedIp('localhost')).toBe(true));
  it('returns true for 192.168.x.x (private)', () => expect(isExcludedIp('192.168.1.100')).toBe(true));
  it('returns true for 10.x.x.x (private)', () => expect(isExcludedIp('10.0.0.1')).toBe(true));
  it('returns false for a public IP', () => expect(isExcludedIp('203.0.113.45')).toBe(false));
});

describe('getSubnet24', () => {
  it('extracts /24 subnet from IPv4', () => expect(getSubnet24('203.0.113.45')).toBe('203.0.113.0/24'));
  it('returns null for IPv6', () => expect(getSubnet24('2001:db8::1')).toBeNull());
  it('returns null for empty string', () => expect(getSubnet24('')).toBeNull());
});

describe('highestOf', () => {
  it('returns BAN when comparing NONE vs BAN', () => expect(highestOf('NONE', 'BAN')).toBe('BAN'));
  it('returns SUSPEND when comparing WARNING vs SUSPEND', () => expect(highestOf('WARNING', 'SUSPEND')).toBe('SUSPEND'));
  it('keeps BAN when comparing BAN vs WARNING', () => expect(highestOf('BAN', 'WARNING')).toBe('BAN'));
});

// ─── checkSelfReferralByIp ────────────────────────────────────────────────────

describe('checkSelfReferralByIp', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns flagged=true when affiliate session matches referral IP', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([{ id: 'sess-001' }]));
    const result = await checkSelfReferralByIp('user-aff-001', '203.0.113.45');
    expect(result.flagged).toBe(true);
    expect(result.signalType).toBe('SELF_REFERRAL_IP');
    expect(result.severity).toBe('WARNING');
  });

  it('returns flagged=false when no session matches', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([]));
    const result = await checkSelfReferralByIp('user-aff-001', '203.0.113.45');
    expect(result.flagged).toBe(false);
  });

  it('returns flagged=false for null IP without querying db', async () => {
    const result = await checkSelfReferralByIp('user-aff-001', null);
    expect(result.flagged).toBe(false);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('returns flagged=false for 127.0.0.1 without querying db', async () => {
    const result = await checkSelfReferralByIp('user-aff-001', '127.0.0.1');
    expect(result.flagged).toBe(false);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('returns flagged=false for private 192.168.x.x without querying db', async () => {
    const result = await checkSelfReferralByIp('user-aff-001', '192.168.0.10');
    expect(result.flagged).toBe(false);
    expect(mockSelect).not.toHaveBeenCalled();
  });
});

// ─── checkRapidChurn ──────────────────────────────────────────────────────────

describe('checkRapidChurn', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns flagged=true when churn count >= threshold', async () => {
    mockGetPlatformSetting.mockResolvedValueOnce(3).mockResolvedValueOnce(48);
    const now = Date.now();
    const rows = [
      { convertedAt: new Date(now - 20 * 3_600_000), churnedAt: new Date(now - 15 * 3_600_000) },
      { convertedAt: new Date(now - 18 * 3_600_000), churnedAt: new Date(now - 12 * 3_600_000) },
      { convertedAt: new Date(now - 16 * 3_600_000), churnedAt: new Date(now - 10 * 3_600_000) },
    ];
    mockSelect.mockReturnValue(makeSelectWhereChain(rows));
    const result = await checkRapidChurn('aff-test-001');
    expect(result.flagged).toBe(true);
    expect(result.signalType).toBe('RAPID_CHURN');
  });

  it('returns flagged=false when churn count < threshold', async () => {
    mockGetPlatformSetting.mockResolvedValueOnce(3).mockResolvedValueOnce(48);
    const now = Date.now();
    mockSelect.mockReturnValue(makeSelectWhereChain([
      { convertedAt: new Date(now - 20 * 3_600_000), churnedAt: new Date(now - 15 * 3_600_000) },
    ]));
    const result = await checkRapidChurn('aff-test-001');
    expect(result.flagged).toBe(false);
  });

  it('counts only churns within the configured window', async () => {
    mockGetPlatformSetting.mockResolvedValueOnce(1).mockResolvedValueOnce(48);
    const now = Date.now();
    // diff is 47h — within 48h window → should flag
    const rows = [{
      convertedAt: new Date(now - 7 * 24 * 3_600_000),
      churnedAt: new Date(now - 7 * 24 * 3_600_000 + 47 * 3_600_000),
    }];
    mockSelect.mockReturnValue(makeSelectWhereChain(rows));
    const result = await checkRapidChurn('aff-test-001');
    expect(result.flagged).toBe(true);
  });
});

// ─── checkBotTraffic ──────────────────────────────────────────────────────────

describe('checkBotTraffic', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns flagged=true when clicks >= threshold and zero signups', async () => {
    mockGetPlatformSetting.mockResolvedValueOnce(100).mockResolvedValueOnce(24);
    mockSelect
      .mockReturnValueOnce(makeSelectWhereChain([{ total: 150 }]))
      .mockReturnValueOnce(makeSelectWhereChain([{ total: 0 }]));
    const result = await checkBotTraffic('aff-test-001');
    expect(result.flagged).toBe(true);
    expect(result.signalType).toBe('BOT_TRAFFIC');
  });

  it('returns flagged=false when click count < threshold', async () => {
    mockGetPlatformSetting.mockResolvedValueOnce(100).mockResolvedValueOnce(24);
    mockSelect.mockReturnValueOnce(makeSelectWhereChain([{ total: 50 }]));
    const result = await checkBotTraffic('aff-test-001');
    expect(result.flagged).toBe(false);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('returns flagged=false when signups > 0 despite high clicks', async () => {
    mockGetPlatformSetting.mockResolvedValueOnce(100).mockResolvedValueOnce(24);
    mockSelect
      .mockReturnValueOnce(makeSelectWhereChain([{ total: 200 }]))
      .mockReturnValueOnce(makeSelectWhereChain([{ total: 5 }]));
    const result = await checkBotTraffic('aff-test-001');
    expect(result.flagged).toBe(false);
  });

  it('reads threshold from platform_settings — custom threshold 50 triggers at 75 clicks', async () => {
    mockGetPlatformSetting.mockResolvedValueOnce(50).mockResolvedValueOnce(24);
    mockSelect
      .mockReturnValueOnce(makeSelectWhereChain([{ total: 75 }]))
      .mockReturnValueOnce(makeSelectWhereChain([{ total: 0 }]));
    const result = await checkBotTraffic('aff-test-001');
    expect(result.flagged).toBe(true);
  });
});

// ─── checkSamePaymentMethod ───────────────────────────────────────────────────

describe('checkSamePaymentMethod — no Stripe customer', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns flagged=false when affiliate has no stripeCustomerId', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectLimitChain([{ stripeCustomerId: null }]))
      .mockReturnValueOnce(makeSelectLimitChain([{ stripeCustomerId: 'cus_abc' }]));
    const result = await checkSamePaymentMethod('user-aff-001', 'user-ref-001');
    expect(result.flagged).toBe(false);
  });

  it('returns flagged=false when referred user has no stripeCustomerId', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectLimitChain([{ stripeCustomerId: 'cus_aff' }]))
      .mockReturnValueOnce(makeSelectLimitChain([{ stripeCustomerId: null }]));
    const result = await checkSamePaymentMethod('user-aff-001', 'user-ref-001');
    expect(result.flagged).toBe(false);
  });

  it('returns flagged=false when neither profile exists', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectLimitChain([]))
      .mockReturnValueOnce(makeSelectLimitChain([]));
    const result = await checkSamePaymentMethod('user-aff-001', 'user-ref-001');
    expect(result.flagged).toBe(false);
  });
});
