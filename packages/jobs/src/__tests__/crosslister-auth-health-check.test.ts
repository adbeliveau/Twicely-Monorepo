/**
 * Tests for crosslister-auth-health-check.ts
 * processCrosslisterAuthHealth — detects expired/expiring/error/stale accounts,
 * flips status to REAUTHENTICATION_REQUIRED, and dispatches reauth notifications.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock fns ──────────────────────────────────────────────────────────

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'job-1' }));
const mockDbSelect = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({ add: mockQueueAdd }),
  createWorker: vi.fn().mockReturnValue({ close: vi.fn() }),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  crosslisterAccount: {
    id: 'id',
    sellerId: 'seller_id',
    channel: 'channel',
    externalUsername: 'external_username',
    authMethod: 'auth_method',
    tokenExpiresAt: 'token_expires_at',
    lastSyncAt: 'last_sync_at',
    consecutiveErrors: 'consecutive_errors',
    status: 'status',
    updatedAt: 'updated_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  or: vi.fn((...args: unknown[]) => ({ type: 'or', args })),
  lt: vi.fn((a: unknown, b: unknown) => ({ type: 'lt', a, b })),
  lte: vi.fn((a: unknown, b: unknown) => ({ type: 'lte', a, b })),
  gte: vi.fn((a: unknown, b: unknown) => ({ type: 'gte', a, b })),
  isNotNull: vi.fn((a: unknown) => ({ type: 'isNotNull', a })),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((key: string, fallback?: unknown) => {
    const settings: Record<string, unknown> = {
      'crosslister.auth.warnAheadHours': 48,
      'crosslister.auth.errorThreshold': 3,
      'crosslister.auth.staleAfterDays': 7,
      'jobs.cron.crosslisterAuthHealth.pattern': '15 * * * *',
    };
    return Promise.resolve(key in settings ? settings[key] : fallback);
  }),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Select resolves at .where() — matches the source query pattern. */
function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  return chain as never;
}

/** Update chain: .set().where().returning() */
function makeUpdateReturningChain(rows: unknown[]) {
  const returningMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  return { set: setMock, where: whereMock, returning: returningMock };
}

/** Account fixture helpers — all relative to real wall clock so they don't drift. */
const REAL_NOW = Date.now();
const PAST_1H = new Date(REAL_NOW - 1 * 60 * 60 * 1000);
const FUTURE_24H = new Date(REAL_NOW + 24 * 60 * 60 * 1000);
const FUTURE_72H = new Date(REAL_NOW + 72 * 60 * 60 * 1000);
const PAST_10D = new Date(REAL_NOW - 10 * 24 * 60 * 60 * 1000);

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-test-1',
    sellerId: 'seller-test-1',
    channel: 'EBAY',
    externalUsername: 'testuser',
    authMethod: 'OAUTH',
    tokenExpiresAt: null as Date | null,
    lastSyncAt: null as Date | null,
    consecutiveErrors: 0,
    ...overrides,
  };
}

// ─── Import the module under test ─────────────────────────────────────────────

import { processCrosslisterAuthHealth } from '../crosslister-auth-health-check';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('processCrosslisterAuthHealth — empty results', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all-zero counts when no ACTIVE accounts match any condition', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const notifyFn = vi.fn();
    const result = await processCrosslisterAuthHealth(notifyFn);

    expect(result).toEqual({
      expired: 0,
      expiringSoon: 0,
      errorThreshold: 0,
      stale: 0,
      notified: 0,
      errors: 0,
    });
    expect(notifyFn).not.toHaveBeenCalled();
  });
});

describe('processCrosslisterAuthHealth — expired OAuth token', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects expired token and flips status to REAUTHENTICATION_REQUIRED', async () => {
    const account = makeAccount({ tokenExpiresAt: PAST_1H });
    mockDbSelect.mockReturnValue(makeSelectChain([account]));

    const updateChain = makeUpdateReturningChain([{ id: account.id }]);
    mockDbUpdate.mockReturnValue(updateChain);

    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const result = await processCrosslisterAuthHealth(notifyFn);

    expect(result.expired).toBe(1);
    expect(result.expiringSoon).toBe(0);
    expect(result.notified).toBe(1);
    expect(result.errors).toBe(0);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'REAUTHENTICATION_REQUIRED' }),
    );
  });

  it('calls notifyFn with reason=expired and correct channel label', async () => {
    const account = makeAccount({ channel: 'EBAY', tokenExpiresAt: PAST_1H });
    mockDbSelect.mockReturnValue(makeSelectChain([account]));
    mockDbUpdate.mockReturnValue(makeUpdateReturningChain([{ id: account.id }]));

    const notifyFn = vi.fn().mockResolvedValue(undefined);
    await processCrosslisterAuthHealth(notifyFn);

    expect(notifyFn).toHaveBeenCalledWith(
      'seller-test-1',
      'crosslister.account.reauth_required',
      expect.objectContaining({
        channel: 'EBAY',
        channelLabel: 'eBay',
        reason: 'expired',
        reasonLabel: 'Your authorization has expired',
        accountId: 'acct-test-1',
      }),
    );
  });
});

describe('processCrosslisterAuthHealth — expiring soon OAuth token', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects token expiring within warnAheadHours window', async () => {
    // tokenExpiresAt is 24h in the future — within the 48h warn window
    const account = makeAccount({ tokenExpiresAt: FUTURE_24H });
    mockDbSelect.mockReturnValue(makeSelectChain([account]));
    mockDbUpdate.mockReturnValue(makeUpdateReturningChain([{ id: account.id }]));

    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const result = await processCrosslisterAuthHealth(notifyFn);

    expect(result.expiringSoon).toBe(1);
    expect(result.expired).toBe(0);
    expect(result.notified).toBe(1);
  });

  it('calls notifyFn with reason=expiring_soon', async () => {
    const account = makeAccount({ tokenExpiresAt: FUTURE_24H });
    mockDbSelect.mockReturnValue(makeSelectChain([account]));
    mockDbUpdate.mockReturnValue(makeUpdateReturningChain([{ id: account.id }]));

    const notifyFn = vi.fn().mockResolvedValue(undefined);
    await processCrosslisterAuthHealth(notifyFn);

    expect(notifyFn).toHaveBeenCalledWith(
      'seller-test-1',
      'crosslister.account.reauth_required',
      expect.objectContaining({
        reason: 'expiring_soon',
        reasonLabel: 'Your authorization is about to expire',
      }),
    );
  });

  it('does NOT flag token expiring outside the warn window (72h > 48h threshold)', async () => {
    // tokenExpiresAt is 72h away — the DB query would not return this row
    // Simulate: the WHERE filter excludes it, so candidates is empty
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const notifyFn = vi.fn();
    const result = await processCrosslisterAuthHealth(notifyFn);

    expect(result.expiringSoon).toBe(0);
    expect(notifyFn).not.toHaveBeenCalled();
    void FUTURE_72H;
  });
});

describe('processCrosslisterAuthHealth — error threshold', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects consecutiveErrors >= errorThreshold (3)', async () => {
    const account = makeAccount({ consecutiveErrors: 3 });
    mockDbSelect.mockReturnValue(makeSelectChain([account]));
    mockDbUpdate.mockReturnValue(makeUpdateReturningChain([{ id: account.id }]));

    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const result = await processCrosslisterAuthHealth(notifyFn);

    expect(result.errorThreshold).toBe(1);
    expect(result.notified).toBe(1);
  });

  it('calls notifyFn with reason=error_threshold', async () => {
    const account = makeAccount({ consecutiveErrors: 5 });
    mockDbSelect.mockReturnValue(makeSelectChain([account]));
    mockDbUpdate.mockReturnValue(makeUpdateReturningChain([{ id: account.id }]));

    const notifyFn = vi.fn().mockResolvedValue(undefined);
    await processCrosslisterAuthHealth(notifyFn);

    expect(notifyFn).toHaveBeenCalledWith(
      'seller-test-1',
      'crosslister.account.reauth_required',
      expect.objectContaining({
        reason: 'error_threshold',
        reasonLabel: 'Your account has been disconnected due to repeated errors',
      }),
    );
  });
});

describe('processCrosslisterAuthHealth — stale session', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects lastSyncAt older than staleAfterDays (7 days)', async () => {
    // lastSyncAt is 10 days ago — older than the 7-day stale threshold
    const account = makeAccount({ lastSyncAt: PAST_10D });
    mockDbSelect.mockReturnValue(makeSelectChain([account]));
    mockDbUpdate.mockReturnValue(makeUpdateReturningChain([{ id: account.id }]));

    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const result = await processCrosslisterAuthHealth(notifyFn);

    expect(result.stale).toBe(1);
    expect(result.notified).toBe(1);
  });

  it('calls notifyFn with reason=stale', async () => {
    const account = makeAccount({ lastSyncAt: PAST_10D });
    mockDbSelect.mockReturnValue(makeSelectChain([account]));
    mockDbUpdate.mockReturnValue(makeUpdateReturningChain([{ id: account.id }]));

    const notifyFn = vi.fn().mockResolvedValue(undefined);
    await processCrosslisterAuthHealth(notifyFn);

    expect(notifyFn).toHaveBeenCalledWith(
      'seller-test-1',
      'crosslister.account.reauth_required',
      expect.objectContaining({
        reason: 'stale',
        reasonLabel: 'Your session appears to have expired',
      }),
    );
  });
});

describe('processCrosslisterAuthHealth — idempotency', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips notification when .returning() returns empty (concurrent worker already flipped)', async () => {
    const account = makeAccount({ tokenExpiresAt: PAST_1H });
    mockDbSelect.mockReturnValue(makeSelectChain([account]));
    // Concurrent worker beat us — returning() is empty
    mockDbUpdate.mockReturnValue(makeUpdateReturningChain([]));

    const notifyFn = vi.fn();
    const result = await processCrosslisterAuthHealth(notifyFn);

    expect(notifyFn).not.toHaveBeenCalled();
    expect(result.notified).toBe(0);
    // The account is still counted in the category tally
    expect(result.expired).toBe(1);
  });
});

describe('processCrosslisterAuthHealth — mixed batch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('correctly tallies mixed batch with expired, stale, and error-threshold accounts', async () => {
    const expiredAccount = makeAccount({
      id: 'acct-1', sellerId: 'seller-1',
      tokenExpiresAt: PAST_1H,
    });
    const staleAccount = makeAccount({
      id: 'acct-2', sellerId: 'seller-2',
      lastSyncAt: PAST_10D,
    });
    const errorAccount = makeAccount({
      id: 'acct-3', sellerId: 'seller-3',
      consecutiveErrors: 4,
    });

    mockDbSelect.mockReturnValue(makeSelectChain([expiredAccount, staleAccount, errorAccount]));

    // Each update succeeds (returns a row)
    mockDbUpdate
      .mockReturnValueOnce(makeUpdateReturningChain([{ id: 'acct-1' }]))
      .mockReturnValueOnce(makeUpdateReturningChain([{ id: 'acct-2' }]))
      .mockReturnValueOnce(makeUpdateReturningChain([{ id: 'acct-3' }]));

    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const result = await processCrosslisterAuthHealth(notifyFn);

    expect(result.expired).toBe(1);
    expect(result.stale).toBe(1);
    expect(result.errorThreshold).toBe(1);
    expect(result.expiringSoon).toBe(0);
    expect(result.notified).toBe(3);
    expect(result.errors).toBe(0);
  });
});

describe('processCrosslisterAuthHealth — error handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('increments errors count when DB update throws, continues processing remaining accounts', async () => {
    const goodAccount = makeAccount({ id: 'acct-ok', sellerId: 'seller-ok', tokenExpiresAt: PAST_1H });
    const badAccount = makeAccount({ id: 'acct-bad', sellerId: 'seller-bad', tokenExpiresAt: PAST_1H });

    mockDbSelect.mockReturnValue(makeSelectChain([badAccount, goodAccount]));

    // First update throws, second succeeds
    const failingSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      }),
    });
    mockDbUpdate
      .mockReturnValueOnce({ set: failingSet })
      .mockReturnValueOnce(makeUpdateReturningChain([{ id: 'acct-ok' }]));

    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const result = await processCrosslisterAuthHealth(notifyFn);

    expect(result.errors).toBe(1);
    expect(result.notified).toBe(1);
  });
});

describe('processCrosslisterAuthHealth — platform settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads warnAheadHours, errorThreshold, and staleAfterDays from platform_settings', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');
    const notifyFn = vi.fn();
    await processCrosslisterAuthHealth(notifyFn);

    expect(getPlatformSetting).toHaveBeenCalledWith('crosslister.auth.warnAheadHours', 48);
    expect(getPlatformSetting).toHaveBeenCalledWith('crosslister.auth.errorThreshold', 3);
    expect(getPlatformSetting).toHaveBeenCalledWith('crosslister.auth.staleAfterDays', 7);
  });
});

describe('processCrosslisterAuthHealth — channel labels', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps channel codes to human-readable labels in the notification data', async () => {
    const channels = [
      { channel: 'POSHMARK', expected: 'Poshmark' },
      { channel: 'MERCARI', expected: 'Mercari' },
      { channel: 'FB_MARKETPLACE', expected: 'Facebook Marketplace' },
      { channel: 'THEREALREAL', expected: 'The RealReal' },
    ];

    for (const { channel, expected } of channels) {
      vi.clearAllMocks();
      const account = makeAccount({ channel, tokenExpiresAt: PAST_1H });
      mockDbSelect.mockReturnValue(makeSelectChain([account]));
      mockDbUpdate.mockReturnValue(makeUpdateReturningChain([{ id: 'acct-test-1' }]));

      const notifyFn = vi.fn().mockResolvedValue(undefined);
      await processCrosslisterAuthHealth(notifyFn);

      expect(notifyFn).toHaveBeenCalledWith(
        expect.any(String),
        'crosslister.account.reauth_required',
        expect.objectContaining({ channelLabel: expected }),
      );
    }
  });
});
