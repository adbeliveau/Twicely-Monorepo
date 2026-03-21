import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * getVerificationStatus additional tests — PENDING, FAILED, basicVerified states.
 * Core getVerificationStatus tests are in identity-verification.test.ts.
 */

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

vi.mock('@twicely/stripe/identity-service', () => ({
  createVerificationSession: vi.fn(),
  getVerificationSessionResult: vi.fn(),
}));

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, insert: vi.fn(), update: vi.fn() },
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

// ─── getVerificationStatus — additional status cases ─────────────────────────

describe('getVerificationStatus — PENDING record', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns PENDING status for active PENDING record', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-pending'));
    const chain = makeSelectChain([{ emailVerified: false, phoneVerified: false }]);
    mockDbSelect.mockReturnValue(chain);
    mockGetActiveVerification.mockResolvedValue({
      id: 'iv-pending', userId: 'user-pending', status: 'PENDING', expiresAt: null,
    });

    const { getVerificationStatus } = await import('../identity-verification');
    const result = await getVerificationStatus();
    expect(result.status).toBe('PENDING');
  });

  it('returns FAILED status for active FAILED record not in retry window', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-failed'));
    const chain = makeSelectChain([{ emailVerified: false, phoneVerified: false }]);
    mockDbSelect.mockReturnValue(chain);
    const pastRetry = new Date(Date.now() - 86400000);
    mockGetActiveVerification.mockResolvedValue({
      id: 'iv-failed', userId: 'user-failed', status: 'FAILED',
      retryAfter: pastRetry, expiresAt: null,
    });

    const { getVerificationStatus } = await import('../identity-verification');
    const result = await getVerificationStatus();
    expect(result.status).toBe('FAILED');
  });

  it('returns basicVerified=true when both email and phone verified', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-both'));
    const chain = makeSelectChain([{ emailVerified: true, phoneVerified: true }]);
    mockDbSelect.mockReturnValue(chain);
    mockGetActiveVerification.mockResolvedValue(null);

    const { getVerificationStatus } = await import('../identity-verification');
    const result = await getVerificationStatus();
    expect(result.basicVerified).toBe(true);
    expect(result.status).toBe('NONE');
  });

  it('returns basicVerified=false when only email verified (phone missing)', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-email-only'));
    const chain = makeSelectChain([{ emailVerified: true, phoneVerified: false }]);
    mockDbSelect.mockReturnValue(chain);
    mockGetActiveVerification.mockResolvedValue(null);

    const { getVerificationStatus } = await import('../identity-verification');
    const result = await getVerificationStatus();
    expect(result.basicVerified).toBe(false);
  });

  it('returns basicVerified=false when user row not found in DB', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-no-row'));
    const chain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(chain);
    mockGetActiveVerification.mockResolvedValue(null);

    const { getVerificationStatus } = await import('../identity-verification');
    const result = await getVerificationStatus();
    expect(result.basicVerified).toBe(false);
  });
});
