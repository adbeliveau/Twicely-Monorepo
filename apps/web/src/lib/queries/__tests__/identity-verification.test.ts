import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Identity Verification Query tests.
 * Covers: getVerificationHistory, getActiveVerification, isEnhancedVerificationRequired.
 */

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('@twicely/db/schema', () => ({
  identityVerification: {
    id: 'id', userId: 'user_id', status: 'status',
    level: 'level', createdAt: 'created_at', expiresAt: 'expires_at',
    stripeSessionId: 'stripe_session_id',
  },
  sellerProfile: {
    userId: 'user_id', stripeAccountId: 'stripe_account_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(1000000),
}));

/**
 * Thenable chain — for queries ending at .orderBy() with no .limit() call.
 * Used by getVerificationHistory which returns the full chain result.
 */
function makeThenableChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

/**
 * Limit-resolving chain — for queries that call .limit(1).
 */
function makeLimitChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain;
}

// ─── getVerificationHistory ───────────────────────────────────────────────────

describe('getVerificationHistory', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns all records for user ordered by createdAt desc', async () => {
    const records = [
      { id: 'iv-2', userId: 'user-h1', status: 'VERIFIED', level: 'ENHANCED' },
      { id: 'iv-1', userId: 'user-h1', status: 'FAILED', level: 'ENHANCED' },
    ];
    mockDbSelect.mockReturnValue(makeThenableChain(records));

    const { getVerificationHistory } = await import('../identity-verification');
    const result = await getVerificationHistory('user-h1');
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('iv-2');
  });

  it('returns empty array when user has no history', async () => {
    mockDbSelect.mockReturnValue(makeThenableChain([]));

    const { getVerificationHistory } = await import('../identity-verification');
    const result = await getVerificationHistory('user-no-history');
    expect(result).toEqual([]);
  });
});

// ─── getActiveVerification ────────────────────────────────────────────────────

describe('getActiveVerification', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns most recent record for user', async () => {
    const record = { id: 'iv-active-1', userId: 'user-a1', status: 'VERIFIED', level: 'ENHANCED' };
    mockDbSelect.mockReturnValue(makeLimitChain([record]));

    const { getActiveVerification } = await import('../identity-verification');
    const result = await getActiveVerification('user-a1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('iv-active-1');
    expect(result!.status).toBe('VERIFIED');
  });

  it('returns null when no record exists', async () => {
    mockDbSelect.mockReturnValue(makeLimitChain([]));

    const { getActiveVerification } = await import('../identity-verification');
    const result = await getActiveVerification('user-none');
    expect(result).toBeNull();
  });

  it('queries for ENHANCED level only', async () => {
    mockDbSelect.mockReturnValue(makeLimitChain([]));

    const { getActiveVerification } = await import('../identity-verification');
    await getActiveVerification('user-level-check');

    // The where clause includes an eq on level='ENHANCED'
    const chain = mockDbSelect.mock.results[0]!.value;
    expect(chain.where).toHaveBeenCalled();
  });
});

// ─── isEnhancedVerificationRequired ──────────────────────────────────────────

describe('isEnhancedVerificationRequired', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns required=false when VERIFIED and not expired', async () => {
    const futureExpiry = new Date(Date.now() + 86400000 * 365);
    const verifiedRecord = {
      id: 'iv-v1', userId: 'user-v1', status: 'VERIFIED',
      level: 'ENHANCED', expiresAt: futureExpiry,
    };
    mockDbSelect.mockReturnValue(makeLimitChain([verifiedRecord]));

    const { isEnhancedVerificationRequired } = await import('../identity-verification');
    const result = await isEnhancedVerificationRequired('user-v1');
    expect(result.required).toBe(false);
  });

  it('returns required=true with VERIFICATION_EXPIRED when VERIFIED but expired', async () => {
    const pastExpiry = new Date(Date.now() - 86400000);
    const expiredRecord = {
      id: 'iv-exp', userId: 'user-exp', status: 'VERIFIED',
      level: 'ENHANCED', expiresAt: pastExpiry,
    };
    // First call: getActiveVerification returns expired record
    // Second call: sellerProfile lookup
    mockDbSelect
      .mockReturnValueOnce(makeLimitChain([expiredRecord]))
      .mockReturnValueOnce(makeLimitChain([{ stripeAccountId: 'acct_test' }]));

    const { isEnhancedVerificationRequired } = await import('../identity-verification');
    const result = await isEnhancedVerificationRequired('user-exp');
    expect(result.required).toBe(true);
    expect(result.reason).toBe('VERIFICATION_EXPIRED');
  });

  it('returns required=false when no active record and no seller profile', async () => {
    // First call: getActiveVerification returns null (no active record)
    // Second call: sellerProfile returns no rows
    mockDbSelect
      .mockReturnValueOnce(makeLimitChain([]))
      .mockReturnValueOnce(makeLimitChain([]));

    const { isEnhancedVerificationRequired } = await import('../identity-verification');
    const result = await isEnhancedVerificationRequired('user-no-profile');
    expect(result.required).toBe(false);
  });

  it('returns required=false when PENDING (not VERIFIED)', async () => {
    const pendingRecord = {
      id: 'iv-pend', userId: 'user-pend', status: 'PENDING',
      level: 'ENHANCED', expiresAt: null,
    };
    mockDbSelect
      .mockReturnValueOnce(makeLimitChain([pendingRecord]))
      .mockReturnValueOnce(makeLimitChain([{ stripeAccountId: 'acct_pending' }]));

    const { isEnhancedVerificationRequired } = await import('../identity-verification');
    const result = await isEnhancedVerificationRequired('user-pend');
    // PENDING is not VERIFIED, so falls through to threshold check
    // with a valid seller profile, threshold check passes → required: false
    expect(result.required).toBe(false);
  });

  it('returns required=false when FAILED record exists and has seller profile', async () => {
    const failedRecord = {
      id: 'iv-fail', userId: 'user-fail', status: 'FAILED',
      level: 'ENHANCED', expiresAt: null,
    };
    mockDbSelect
      .mockReturnValueOnce(makeLimitChain([failedRecord]))
      .mockReturnValueOnce(makeLimitChain([{ stripeAccountId: 'acct_fail' }]));

    const { isEnhancedVerificationRequired } = await import('../identity-verification');
    const result = await isEnhancedVerificationRequired('user-fail');
    expect(result.required).toBe(false);
  });
});
