import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Additional identity-verification action tests.
 * Covers: checkVerificationResult and startEnhancedVerification edge cases.
 * getVerificationStatus additional tests are in identity-verification-status.test.ts.
 */

const mockAuthorize = vi.fn();
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn() }));

vi.mock('@twicely/casl', () => ({
  authorize: mockAuthorize,
  sub: (...args: unknown[]) => args,
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(24),
}));

const mockGetActiveVerification = vi.fn();
const mockGetVerificationHistory = vi.fn();
vi.mock('@/lib/queries/identity-verification', () => ({
  getActiveVerification: mockGetActiveVerification,
  getVerificationHistory: mockGetVerificationHistory,
}));

const mockCreateVerificationSession = vi.fn();
const mockGetVerificationSessionResult = vi.fn();
vi.mock('@twicely/stripe/identity-service', () => ({
  createVerificationSession: mockCreateVerificationSession,
  getVerificationSessionResult: mockGetVerificationSessionResult,
}));

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate },
}));

vi.mock('@twicely/db/schema', () => ({
  identityVerification: {
    id: 'id', userId: 'user_id', status: 'status',
    stripeSessionId: 'stripe_session_id', retryAfter: 'retry_after',
  },
  user: { id: 'id', emailVerified: 'email_verified', phoneVerified: 'phone_verified' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
}));

function makeSession(userId = 'user-1') {
  return {
    session: { userId, isSeller: true },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(), where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

// ─── checkVerificationResult ───────────────────────────────────────────────

describe('checkVerificationResult', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { checkVerificationResult } = await import('../identity-verification');
    const result = await checkVerificationResult('iv-test-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error when record not found (or belongs to other user)', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-a'));
    const chain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(chain);

    const { checkVerificationResult } = await import('../identity-verification');
    const result = await checkVerificationResult('iv-not-mine');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Forbidden when CASL denies read', async () => {
    const session = {
      session: { userId: 'user-b' },
      ability: { can: vi.fn().mockReturnValue(false) },
    };
    mockAuthorize.mockResolvedValue(session);
    const chain = makeSelectChain([{
      id: 'iv-b1', userId: 'user-b', status: 'PENDING', stripeSessionId: 'vs_b1',
    }]);
    mockDbSelect.mockReturnValue(chain);

    const { checkVerificationResult } = await import('../identity-verification');
    const result = await checkVerificationResult('iv-b1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns status directly when no stripeSessionId', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-c'));
    const chain = makeSelectChain([{
      id: 'iv-c1', userId: 'user-c', status: 'VERIFIED', stripeSessionId: null,
    }]);
    mockDbSelect.mockReturnValue(chain);

    const { checkVerificationResult } = await import('../identity-verification');
    const result = await checkVerificationResult('iv-c1');
    expect(result.success).toBe(true);
    expect(result.status).toBe('VERIFIED');
    expect(mockGetVerificationSessionResult).not.toHaveBeenCalled();
  });

  it('polls Stripe and returns status when stripeSessionId present', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-d'));
    const chain = makeSelectChain([{
      id: 'iv-d1', userId: 'user-d', status: 'PENDING', stripeSessionId: 'vs_d1',
    }]);
    mockDbSelect.mockReturnValue(chain);
    mockGetVerificationSessionResult.mockResolvedValue({ status: 'verified', reportId: 'vr_d1' });

    const { checkVerificationResult } = await import('../identity-verification');
    const result = await checkVerificationResult('iv-d1');
    expect(result.success).toBe(true);
    expect(result.status).toBe('verified');
    expect(mockGetVerificationSessionResult).toHaveBeenCalledWith('vs_d1');
  });
});

// ─── startEnhancedVerification edge cases ─────────────────────────────────────

describe('startEnhancedVerification — edge cases', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Invalid input for unrecognized triggeredBy value', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const { startEnhancedVerification } = await import('../identity-verification');
    const result = await startEnhancedVerification({
      triggeredBy: 'INVALID_TRIGGER' as 'USER_INITIATED',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('returns error when Stripe session creation throws', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-stripe-fail'));
    mockGetActiveVerification.mockResolvedValue(null);
    mockCreateVerificationSession.mockRejectedValue(new Error('Stripe API error'));

    const { startEnhancedVerification } = await import('../identity-verification');
    const result = await startEnhancedVerification({ triggeredBy: 'USER_INITIATED' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to start verification');
  });

  it('returns error when DB insert returns empty', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-no-insert'));
    mockGetActiveVerification.mockResolvedValue(null);
    mockCreateVerificationSession.mockResolvedValue({
      sessionId: 'vs_empty',
      clientSecret: 'vs_empty_secret',
    });
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    mockDbInsert.mockReturnValue(insertChain);

    const { startEnhancedVerification } = await import('../identity-verification');
    const result = await startEnhancedVerification({ triggeredBy: 'USER_INITIATED' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to create verification record');
  });

  it('allows STORE_PRO_UPGRADE as triggeredBy', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-upgrade'));
    mockGetActiveVerification.mockResolvedValue(null);
    mockCreateVerificationSession.mockResolvedValue({
      sessionId: 'vs_upgrade',
      clientSecret: 'vs_upgrade_secret',
    });
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'iv-upgrade', userId: 'user-upgrade' }]),
    };
    mockDbInsert.mockReturnValue(insertChain);

    const { startEnhancedVerification } = await import('../identity-verification');
    const result = await startEnhancedVerification({ triggeredBy: 'STORE_PRO_UPGRADE' });
    expect(result.success).toBe(true);
    expect(result.verificationId).toBe('iv-upgrade');
  });

  it('allows PAYOUT_THRESHOLD as triggeredBy', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-payout'));
    mockGetActiveVerification.mockResolvedValue(null);
    mockCreateVerificationSession.mockResolvedValue({
      sessionId: 'vs_payout',
      clientSecret: 'vs_payout_secret',
    });
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'iv-payout', userId: 'user-payout' }]),
    };
    mockDbInsert.mockReturnValue(insertChain);

    const { startEnhancedVerification } = await import('../identity-verification');
    const result = await startEnhancedVerification({ triggeredBy: 'PAYOUT_THRESHOLD' });
    expect(result.success).toBe(true);
  });

  it('passes past retry window (retryAfter in past) — proceeds normally', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-retry-ok'));
    mockGetActiveVerification.mockResolvedValue({
      id: 'iv-old-fail',
      status: 'FAILED',
      retryAfter: new Date(Date.now() - 86400000),
    });
    mockCreateVerificationSession.mockResolvedValue({
      sessionId: 'vs_retry_ok',
      clientSecret: 'vs_retry_ok_secret',
    });
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'iv-retry-ok', userId: 'user-retry-ok' }]),
    };
    mockDbInsert.mockReturnValue(insertChain);

    const { startEnhancedVerification } = await import('../identity-verification');
    const result = await startEnhancedVerification({ triggeredBy: 'USER_INITIATED' });
    expect(result.success).toBe(true);
  });
});
