import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Identity Service — createVerificationSession and getVerificationSessionResult.
 * handleVerificationWebhook tests are in identity-service-webhook.test.ts.
 */

const mockVerificationSessionsCreate = vi.fn();
const mockVerificationSessionsRetrieve = vi.fn();

vi.mock('@twicely/stripe/server', () => ({
  stripe: {
    identity: {
      verificationSessions: {
        create: mockVerificationSessionsCreate,
        retrieve: mockVerificationSessionsRetrieve,
      },
    },
  },
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  identityVerification: { id: 'id', userId: 'user_id', stripeSessionId: 'stripe_session_id', status: 'status', level: 'level' },
  sellerProfile: { userId: 'user_id', verifiedAt: 'verified_at', updatedAt: 'updated_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(24),
}));

// ─── createVerificationSession ────────────────────────────────────────────────

describe('createVerificationSession', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns sessionId and clientSecret on success', async () => {
    mockVerificationSessionsCreate.mockResolvedValue({
      id: 'vs_abc123',
      client_secret: 'vs_abc123_secret_xyz',
    });

    const { createVerificationSession } = await import('../identity-service');
    const result = await createVerificationSession('user-test-1', 'ENHANCED');

    expect(result.sessionId).toBe('vs_abc123');
    expect(result.clientSecret).toBe('vs_abc123_secret_xyz');
  });

  it('passes userId in metadata', async () => {
    mockVerificationSessionsCreate.mockResolvedValue({
      id: 'vs_meta',
      client_secret: 'vs_meta_secret',
    });

    const { createVerificationSession } = await import('../identity-service');
    await createVerificationSession('user-meta-42', 'ENHANCED');

    const callArgs = mockVerificationSessionsCreate.mock.calls[0]?.[0];
    expect(callArgs?.metadata?.userId).toBe('user-meta-42');
  });

  it('requires live capture and matching selfie', async () => {
    mockVerificationSessionsCreate.mockResolvedValue({
      id: 'vs_opts',
      client_secret: 'vs_opts_secret',
    });

    const { createVerificationSession } = await import('../identity-service');
    await createVerificationSession('user-opts', 'ENHANCED');

    const callArgs = mockVerificationSessionsCreate.mock.calls[0]?.[0];
    expect(callArgs?.options?.document?.require_live_capture).toBe(true);
    expect(callArgs?.options?.document?.require_matching_selfie).toBe(true);
  });

  it('throws when Stripe returns no client_secret', async () => {
    mockVerificationSessionsCreate.mockResolvedValue({
      id: 'vs_no_secret',
      client_secret: null,
    });

    const { createVerificationSession } = await import('../identity-service');
    await expect(createVerificationSession('user-no-sec', 'ENHANCED')).rejects.toThrow(
      'client secret'
    );
  });
});

// ─── getVerificationSessionResult ─────────────────────────────────────────────

describe('getVerificationSessionResult', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns verified status and reportId', async () => {
    mockVerificationSessionsRetrieve.mockResolvedValue({
      id: 'vs_verified',
      status: 'verified',
      last_verification_report: 'vr_report1',
    });

    const { getVerificationSessionResult } = await import('../identity-service');
    const result = await getVerificationSessionResult('vs_verified');

    expect(result.status).toBe('verified');
    expect(result.reportId).toBe('vr_report1');
  });

  it('returns requires_input status without reportId', async () => {
    mockVerificationSessionsRetrieve.mockResolvedValue({
      id: 'vs_fail',
      status: 'requires_input',
      last_verification_report: null,
    });

    const { getVerificationSessionResult } = await import('../identity-service');
    const result = await getVerificationSessionResult('vs_fail');

    expect(result.status).toBe('requires_input');
    expect(result.reportId).toBeUndefined();
  });

  it('returns canceled status', async () => {
    mockVerificationSessionsRetrieve.mockResolvedValue({
      id: 'vs_cancel',
      status: 'canceled',
      last_verification_report: null,
    });

    const { getVerificationSessionResult } = await import('../identity-service');
    const result = await getVerificationSessionResult('vs_cancel');

    expect(result.status).toBe('canceled');
  });
});
