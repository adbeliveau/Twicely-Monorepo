/**
 * Basic publish-meter tests (pre-F4 coverage, updated for credit-ledger API).
 * Detailed rollover tests live in publish-meter-rollover.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { userId: 'user_id', listerTier: 'lister_tier' },
  platformSetting: { key: 'key', value: 'value' },
  publishCreditLedger: {
    id: 'id', userId: 'user_id', creditType: 'credit_type',
    totalCredits: 'total_credits', usedCredits: 'used_credits',
    expiresAt: 'expires_at', periodStart: 'period_start', periodEnd: 'period_end',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  gt: vi.fn((a, b) => ({ type: 'gt', a, b })),
  sql: Object.assign(vi.fn((s: TemplateStringsArray) => s[0]), { raw: vi.fn() }),
}));

// Chain helper — supports both .limit() and thenable (orderBy) paths
function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(resolvedValue);
  chain.for = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(resolvedValue).then(resolve);
  return chain;
}

const NOW = new Date();
const START_OF_MONTH = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), 1));
const FUTURE = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 1, 1));

function currentMonthBucket(remaining: number) {
  return {
    id: 'pcl-1', creditType: 'MONTHLY' as const,
    totalCredits: remaining, usedCredits: 0,
    expiresAt: FUTURE, periodStart: START_OF_MONTH, periodEnd: FUTURE,
  };
}

/**
 * Mock DB calls for getPublishAllowance:
 *  1. getListerTier → sellerProfile
 *  2. getMonthlyLimit → platformSetting (via Promise.all)
 *  3. getAvailableCredits → publishCreditLedger (via Promise.all)
 */
function setupDb(tier: string, settingValue: string | null, creditRows: unknown[]) {
  mockDbSelect
    .mockReturnValueOnce(makeChain([{ listerTier: tier }]))
    .mockReturnValueOnce(makeChain(settingValue ? [{ value: settingValue }] : []))
    .mockReturnValueOnce(makeChain(creditRows));
}

function setupCanPublishDb(tier: string, creditRows: unknown[]) {
  mockDbSelect
    .mockReturnValueOnce(makeChain([{ listerTier: tier }]))
    .mockReturnValueOnce(makeChain(creditRows));
}

describe('getPublishAllowance', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns 25 monthly limit for FREE tier', async () => {
    setupDb('FREE', '25', [currentMonthBucket(25)]);
    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('seller-1');
    expect(result.monthlyLimit).toBe(25);
    expect(result.tier).toBe('FREE');
  });

  it('returns 200 monthly limit for LITE tier', async () => {
    setupDb('LITE', '200', [currentMonthBucket(200)]);
    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('seller-2');
    expect(result.monthlyLimit).toBe(200);
    expect(result.tier).toBe('LITE');
  });

  it('returns 2000 monthly limit for PRO tier', async () => {
    setupDb('PRO', '2000', [currentMonthBucket(2000)]);
    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('seller-3');
    expect(result.monthlyLimit).toBe(2000);
    expect(result.tier).toBe('PRO');
  });

  it('returns 0 monthly limit for NONE tier', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([{ listerTier: 'NONE' }]));
    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('seller-4');
    expect(result.monthlyLimit).toBe(0);
    expect(result.tier).toBe('NONE');
    expect(result.remaining).toBe(0);
  });

  it('computes usedThisMonth from credit ledger gap', async () => {
    // 25 monthly limit, 15 remaining → 10 used
    setupDb('FREE', '25', [currentMonthBucket(15)]);
    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('seller-5');
    expect(result.usedThisMonth).toBe(10);
    expect(result.remaining).toBe(15);
  });

  it('returns remaining: 0 when no credits available', async () => {
    setupDb('FREE', '25', []);
    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('seller-6');
    expect(result.remaining).toBe(0);
    expect(result.usedThisMonth).toBe(25);
  });

  it('rolloverBalance is 0 when only current-month credits', async () => {
    setupDb('PRO', '2000', [currentMonthBucket(1950)]);
    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('seller-7');
    expect(result.rolloverBalance).toBe(0);
  });

  it('reads limits from platformSetting, not hardcoded', async () => {
    setupDb('FREE', '99', [currentMonthBucket(99)]);
    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('seller-11');
    expect(result.monthlyLimit).toBe(99);
  });
});

describe('canPublish', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns true when within allowance', async () => {
    setupCanPublishDb('FREE', [currentMonthBucket(15)]);
    const { canPublish } = await import('../publish-meter');
    expect(await canPublish('seller-8', 5)).toBe(true);
  });

  it('returns false when over allowance', async () => {
    setupCanPublishDb('FREE', [currentMonthBucket(2)]);
    const { canPublish } = await import('../publish-meter');
    expect(await canPublish('seller-9', 5)).toBe(false);
  });

  it('returns false for NONE tier regardless of count', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([{ listerTier: 'NONE' }]));
    const { canPublish } = await import('../publish-meter');
    expect(await canPublish('seller-10', 1)).toBe(false);
  });
});

describe('recordPublishes', () => {
  it('is a no-op that resolves without error', async () => {
    const { recordPublishes } = await import('../publish-meter');
    await expect(recordPublishes('seller-1', 10)).resolves.toBeUndefined();
  });
});
