import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
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
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

vi.mock('@twicely/db/schema', () => ({
  identityVerification: { id: 'id', userId: 'user_id', status: 'status', stripeSessionId: 'stripe_session_id', retryAfter: 'retry_after' },
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

// ─── getVerificationStatus ────────────────────────────────────────────────────

describe('getVerificationStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns NOT_REQUIRED with basicVerified=false when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { getVerificationStatus } = await import('../identity-verification');
    const result = await getVerificationStatus();
    expect(result.status).toBe('NOT_REQUIRED');
    expect(result.basicVerified).toBe(false);
  });

  it('returns NONE when no active verification record exists', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue([{ emailVerified: false, phoneVerified: false }]) };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    mockDbSelect.mockReturnValue(chain);
    mockGetActiveVerification.mockResolvedValue(null);

    const { getVerificationStatus } = await import('../identity-verification');
    const result = await getVerificationStatus();
    expect(result.status).toBe('NONE');
    expect(result.record).toBeNull();
  });

  it('returns VERIFIED for active verified record', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue([{ emailVerified: true, phoneVerified: true }]) };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    mockDbSelect.mockReturnValue(chain);
    const futureDate = new Date(Date.now() + 86400000 * 365);
    mockGetActiveVerification.mockResolvedValue({
      id: 'iv-1',
      userId: 'user-1',
      status: 'VERIFIED',
      level: 'ENHANCED',
      expiresAt: futureDate,
    });

    const { getVerificationStatus } = await import('../identity-verification');
    const result = await getVerificationStatus();
    expect(result.status).toBe('VERIFIED');
    expect(result.basicVerified).toBe(true);
  });

  it('returns EXPIRED for verified record past expiresAt', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue([{ emailVerified: true, phoneVerified: false }]) };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    mockDbSelect.mockReturnValue(chain);
    const pastDate = new Date(Date.now() - 86400000);
    mockGetActiveVerification.mockResolvedValue({
      id: 'iv-1',
      userId: 'user-1',
      status: 'VERIFIED',
      level: 'ENHANCED',
      expiresAt: pastDate,
    });

    const { getVerificationStatus } = await import('../identity-verification');
    const result = await getVerificationStatus();
    expect(result.status).toBe('EXPIRED');
  });
});

// ─── startEnhancedVerification ───────────────────────────────────────────────

describe('startEnhancedVerification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { startEnhancedVerification } = await import('../identity-verification');
    const result = await startEnhancedVerification({ triggeredBy: 'USER_INITIATED' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error when already PENDING', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockGetActiveVerification.mockResolvedValue({ id: 'iv-1', status: 'PENDING' });

    const { startEnhancedVerification } = await import('../identity-verification');
    const result = await startEnhancedVerification({ triggeredBy: 'USER_INITIATED' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already in progress');
  });

  it('returns error when in retry window', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockGetActiveVerification.mockResolvedValue({
      id: 'iv-1',
      status: 'FAILED',
      retryAfter: new Date(Date.now() + 86400000),
    });

    const { startEnhancedVerification } = await import('../identity-verification');
    const result = await startEnhancedVerification({ triggeredBy: 'USER_INITIATED' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('retry available after');
  });

  it('creates record and returns clientSecret on success', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockGetActiveVerification.mockResolvedValue(null);
    mockCreateVerificationSession.mockResolvedValue({
      sessionId: 'vs_123',
      clientSecret: 'vs_123_secret',
    });
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'iv-1', userId: 'user-1' }]),
    };
    mockDbInsert.mockReturnValue(insertChain);

    const { startEnhancedVerification } = await import('../identity-verification');
    const result = await startEnhancedVerification({ triggeredBy: 'USER_INITIATED' });
    expect(result.success).toBe(true);
    expect(result.clientSecret).toBe('vs_123_secret');
    expect(result.verificationId).toBe('iv-1');
  });

  it('returns error when CASL denies access', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-1' },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { startEnhancedVerification } = await import('../identity-verification');
    const result = await startEnhancedVerification({ triggeredBy: 'USER_INITIATED' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});

// ─── getMyVerificationHistory ─────────────────────────────────────────────────

describe('getMyVerificationHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null });
    const { getMyVerificationHistory } = await import('../identity-verification');
    const result = await getMyVerificationHistory();
    expect(result).toEqual([]);
  });

  it('delegates to getVerificationHistory', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-2'));
    const records = [{ id: 'iv-1', userId: 'user-2', status: 'VERIFIED' }];
    mockGetVerificationHistory.mockResolvedValue(records);

    const { getMyVerificationHistory } = await import('../identity-verification');
    const result = await getMyVerificationHistory();
    expect(result).toBe(records);
    expect(mockGetVerificationHistory).toHaveBeenCalledWith('user-2');
  });
});
