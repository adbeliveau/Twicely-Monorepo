import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DB mock setup ────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
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
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray) => strings[0]),
    { raw: vi.fn() }
  ),
}));

// ─── Chain helpers ─────────────────────────────────────────────────────────────

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(resolvedValue);
  chain.for = vi.fn().mockReturnValue(chain);
  // thenable for queries that resolve after orderBy (no explicit .limit())
  chain.then = (resolve: (val: unknown) => void) =>
    Promise.resolve(resolvedValue).then(resolve);
  return chain;
}

// ─── Now: dynamic reference point (relative to real Date) ────────────────────

const NOW = new Date();
const START_OF_MONTH = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), 1));
const FUTURE = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 1, 1));
const PRIOR_MONTH_START = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - 1, 1));
const PRIOR_MONTH_END = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), 1));

// ─── Credit row builders ──────────────────────────────────────────────────────

function monthlyBucket(opts: {
  remaining?: number;
  isCurrentMonth?: boolean;
  expiresAt?: Date;
}) {
  const used = 0;
  const total = opts.remaining ?? 200;
  return {
    id: 'pcl-monthly-1',
    creditType: 'MONTHLY' as const,
    totalCredits: total,
    usedCredits: used,
    expiresAt: opts.expiresAt ?? FUTURE,
    periodStart: opts.isCurrentMonth ? START_OF_MONTH : PRIOR_MONTH_START,
    periodEnd: opts.isCurrentMonth ? FUTURE : PRIOR_MONTH_END,
  };
}

function rolloverBucket(remaining: number) {
  return {
    id: 'pcl-rollover-1',
    creditType: 'MONTHLY' as const,
    totalCredits: remaining,
    usedCredits: 0,
    expiresAt: FUTURE,
    periodStart: PRIOR_MONTH_START,
    periodEnd: PRIOR_MONTH_END,
  };
}

function overageBucket(remaining: number) {
  return {
    id: 'pcl-overage-1',
    creditType: 'OVERAGE' as const,
    totalCredits: remaining,
    usedCredits: 0,
    expiresAt: FUTURE,
    periodStart: NOW,
    periodEnd: FUTURE,
  };
}

// ─── DB setup helpers ─────────────────────────────────────────────────────────

/**
 * Setup for getPublishAllowance:
 * Call 1: getListerTier → sellerProfile query
 * Call 2: getMonthlyLimit → platformSetting query (if not NONE)
 * Call 3: getAvailableCredits → publishCreditLedger query
 */
function setupDb(tier: string, settingValue: string | null, creditRows: unknown[]) {
  mockDbSelect
    .mockReturnValueOnce(makeChain([{ listerTier: tier }]))         // getListerTier
    .mockReturnValueOnce(makeChain(settingValue ? [{ value: settingValue }] : [])) // getMonthlyLimit
    .mockReturnValueOnce(makeChain(creditRows));                     // getAvailableCredits
}

/**
 * Setup for canPublish:
 * Call 1: getListerTier
 * Call 2: getAvailableCredits
 */
function setupCanPublishDb(tier: string, creditRows: unknown[]) {
  mockDbSelect
    .mockReturnValueOnce(makeChain([{ listerTier: tier }]))
    .mockReturnValueOnce(makeChain(creditRows));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getPublishAllowance (rollover-aware)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns all-zero allowance for NONE tier', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([{ listerTier: 'NONE' }]));

    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('user-test-101');

    expect(result.tier).toBe('NONE');
    expect(result.monthlyLimit).toBe(0);
    expect(result.remaining).toBe(0);
    expect(result.rolloverBalance).toBe(0);
  });

  it('returns monthlyLimit: 5 for FREE tier from platform settings (Decision #105)', async () => {
    setupDb('FREE', '5', []);

    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('user-test-102');

    expect(result.monthlyLimit).toBe(5);
    expect(result.tier).toBe('FREE');
  });

  it('uses fallback limit of 5 for FREE tier when setting missing (Decision #105)', async () => {
    setupDb('FREE', null, []);

    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('user-test-103');

    expect(result.monthlyLimit).toBe(5);
  });

  it('returns rolloverBalance: 0 for FREE tier', async () => {
    setupDb('FREE', '5', [monthlyBucket({ isCurrentMonth: true })]);

    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('user-test-104');

    expect(result.rolloverBalance).toBe(0);
  });

  it('returns correct remaining for LITE with only monthly credits', async () => {
    setupDb('LITE', '200', [monthlyBucket({ remaining: 150, isCurrentMonth: true })]);

    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('user-test-105');

    expect(result.remaining).toBe(150);
    expect(result.rolloverBalance).toBe(0);
  });

  it('separates rollover credits from current month credits (LITE)', async () => {
    const currentBucket = monthlyBucket({ remaining: 200, isCurrentMonth: true });
    const priorBucket = rolloverBucket(75);

    setupDb('LITE', '200', [currentBucket, priorBucket]);

    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('user-test-106');

    expect(result.remaining).toBe(275); // 200 + 75
    expect(result.rolloverBalance).toBe(75);
  });

  it('counts overage credits as rollover balance', async () => {
    const currentBucket = monthlyBucket({ remaining: 200, isCurrentMonth: true });
    const overage = overageBucket(500);

    setupDb('LITE', '200', [currentBucket, overage]);

    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('user-test-107');

    expect(result.rolloverBalance).toBe(500);
    expect(result.remaining).toBe(700);
  });

  it('returns monthlyLimit: 2000 for PRO tier', async () => {
    setupDb('PRO', '2000', [monthlyBucket({ remaining: 2000, isCurrentMonth: true })]);

    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('user-test-108');

    expect(result.monthlyLimit).toBe(2000);
    expect(result.tier).toBe('PRO');
  });

  it('reads limit from platform_settings, not hardcoded (custom value 99)', async () => {
    setupDb('FREE', '99', [monthlyBucket({ remaining: 99, isCurrentMonth: true })]);

    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('user-test-109');

    expect(result.monthlyLimit).toBe(99);
  });

  it('handles no credit rows gracefully (remaining: 0)', async () => {
    setupDb('LITE', '200', []);

    const { getPublishAllowance } = await import('../publish-meter');
    const result = await getPublishAllowance('user-test-110');

    expect(result.remaining).toBe(0);
    expect(result.rolloverBalance).toBe(0);
  });
});

describe('canPublish (rollover-aware)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns false for NONE tier regardless of count', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([{ listerTier: 'NONE' }]));

    const { canPublish } = await import('../publish-meter');
    expect(await canPublish('user-test-111', 1)).toBe(false);
  });

  it('returns true when credit ledger has enough credits', async () => {
    setupCanPublishDb('LITE', [monthlyBucket({ remaining: 200, isCurrentMonth: true })]);

    const { canPublish } = await import('../publish-meter');
    expect(await canPublish('user-test-112', 10)).toBe(true);
  });

  it('returns false when credit ledger is depleted', async () => {
    setupCanPublishDb('LITE', []); // no available credits

    const { canPublish } = await import('../publish-meter');
    expect(await canPublish('user-test-113', 1)).toBe(false);
  });

  it('returns true when rollover credits cover the request', async () => {
    setupCanPublishDb('LITE', [rolloverBucket(50)]);

    const { canPublish } = await import('../publish-meter');
    expect(await canPublish('user-test-114', 50)).toBe(true);
  });

  it('returns false when requesting more than total available (monthly + rollover)', async () => {
    setupCanPublishDb('PRO', [
      monthlyBucket({ remaining: 100, isCurrentMonth: true }),
      rolloverBucket(50),
    ]); // total = 150

    const { canPublish } = await import('../publish-meter');
    expect(await canPublish('user-test-115', 200)).toBe(false);
  });
});

describe('recordPublishes', () => {
  it('is a no-op that resolves without error', async () => {
    const { recordPublishes } = await import('../publish-meter');
    await expect(recordPublishes('user-test-116', 10)).resolves.toBeUndefined();
  });
});
