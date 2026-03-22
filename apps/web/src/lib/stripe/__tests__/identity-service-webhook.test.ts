import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn().mockReturnValue({ set: vi.fn().mockResolvedValue('OK') }),
}));

/**
 * Identity Service — handleVerificationWebhook tests.
 * createVerificationSession / getVerificationSessionResult are in identity-service-fns.test.ts.
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

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate },
}));

vi.mock('@twicely/db/schema', () => ({
  identityVerification: {
    id: 'id', userId: 'user_id', stripeSessionId: 'stripe_session_id',
    status: 'status', level: 'level',
  },
  sellerProfile: {
    userId: 'user_id', verifiedAt: 'verified_at', updatedAt: 'updated_at',
  },
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

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({ rowCount: 1 }),
  };
}

// ─── no record found ──────────────────────────────────────────────────────────

describe('handleVerificationWebhook — no record found', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('logs warning and returns without updating when record not found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { logger } = await import('@/lib/logger');

    const { handleVerificationWebhook } = await import('../identity-service');
    const event = {
      type: 'identity.verification_session.verified',
      data: { object: { id: 'vs_unknown', last_verification_report: null, last_error: null } },
    };

    await handleVerificationWebhook(event as Parameters<typeof handleVerificationWebhook>[0]);
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});

// ─── verified event ───────────────────────────────────────────────────────────

describe('handleVerificationWebhook — verified event', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates status to VERIFIED and sets expiresAt', async () => {
    const record = { id: 'iv-test-1', userId: 'user-v1', level: 'ENHANCED', stripeSessionId: 'vs_v1' };
    mockDbSelect.mockReturnValue(makeSelectChain([record]));
    const updateChain1 = makeUpdateChain();
    const updateChain2 = makeUpdateChain();
    mockDbUpdate
      .mockReturnValueOnce(updateChain1)
      .mockReturnValueOnce(updateChain2);

    const { handleVerificationWebhook } = await import('../identity-service');
    const event = {
      type: 'identity.verification_session.verified',
      data: { object: { id: 'vs_v1', last_verification_report: 'vr_abc', last_error: null } },
    };

    await handleVerificationWebhook(event as Parameters<typeof handleVerificationWebhook>[0]);

    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    const setArgs = updateChain1.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.status).toBe('VERIFIED');
    expect(setArgs.verifiedAt).toBeInstanceOf(Date);
    expect(setArgs.expiresAt).toBeInstanceOf(Date);
  });

  it('sets expiresAt approximately 24 months in future', async () => {
    const record = { id: 'iv-exp', userId: 'user-exp', level: 'ENHANCED', stripeSessionId: 'vs_exp' };
    mockDbSelect.mockReturnValue(makeSelectChain([record]));
    const uc1 = makeUpdateChain();
    const uc2 = makeUpdateChain();
    mockDbUpdate.mockReturnValueOnce(uc1).mockReturnValueOnce(uc2);

    const { handleVerificationWebhook } = await import('../identity-service');
    const event = {
      type: 'identity.verification_session.verified',
      data: { object: { id: 'vs_exp', last_verification_report: null, last_error: null } },
    };

    await handleVerificationWebhook(event as Parameters<typeof handleVerificationWebhook>[0]);

    const setArgs = uc1.set.mock.calls[0]?.[0] as Record<string, unknown>;
    const expiresAt = setArgs.expiresAt as Date;
    const nowPlusTwoYears = new Date();
    nowPlusTwoYears.setMonth(nowPlusTwoYears.getMonth() + 24);
    expect(Math.abs(expiresAt.getTime() - nowPlusTwoYears.getTime())).toBeLessThan(5000);
  });

  it('also updates sellerProfile.verifiedAt', async () => {
    const record = { id: 'iv-seller', userId: 'user-sel', level: 'ENHANCED', stripeSessionId: 'vs_sel' };
    mockDbSelect.mockReturnValue(makeSelectChain([record]));
    const ivChain = makeUpdateChain();
    const spChain = makeUpdateChain();
    mockDbUpdate.mockReturnValueOnce(ivChain).mockReturnValueOnce(spChain);

    const { handleVerificationWebhook } = await import('../identity-service');
    const event = {
      type: 'identity.verification_session.verified',
      data: { object: { id: 'vs_sel', last_verification_report: null, last_error: null } },
    };

    await handleVerificationWebhook(event as Parameters<typeof handleVerificationWebhook>[0]);

    // Second update is to sellerProfile
    const spSetArgs = spChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(spSetArgs.verifiedAt).toBeInstanceOf(Date);
  });
});

// ─── requires_input event ─────────────────────────────────────────────────────

describe('handleVerificationWebhook — requires_input event', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates status to FAILED with failure reason and retryAfter', async () => {
    const record = { id: 'iv-fail-1', userId: 'user-f1', level: 'ENHANCED', stripeSessionId: 'vs_f1' };
    mockDbSelect.mockReturnValue(makeSelectChain([record]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);

    const { handleVerificationWebhook } = await import('../identity-service');
    const event = {
      type: 'identity.verification_session.requires_input',
      data: { object: { id: 'vs_f1', last_error: { code: 'document_expired' }, last_verification_report: null } },
    };

    await handleVerificationWebhook(event as Parameters<typeof handleVerificationWebhook>[0]);

    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.status).toBe('FAILED');
    expect(setArgs.failureReason).toBe('document_expired');
    expect(setArgs.retryAfter).toBeInstanceOf(Date);
    expect(setArgs.failedAt).toBeInstanceOf(Date);
  });

  it('uses unknown as failure reason when last_error is null', async () => {
    const record = { id: 'iv-fail-2', userId: 'user-f2', level: 'ENHANCED', stripeSessionId: 'vs_f2' };
    mockDbSelect.mockReturnValue(makeSelectChain([record]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);

    const { handleVerificationWebhook } = await import('../identity-service');
    const event = {
      type: 'identity.verification_session.requires_input',
      data: { object: { id: 'vs_f2', last_error: null, last_verification_report: null } },
    };

    await handleVerificationWebhook(event as Parameters<typeof handleVerificationWebhook>[0]);

    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.failureReason).toBe('unknown');
  });
});

// ─── canceled event ───────────────────────────────────────────────────────────

describe('handleVerificationWebhook — canceled event', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates status to FAILED with failureReason=canceled', async () => {
    const record = { id: 'iv-cancel-1', userId: 'user-c1', level: 'ENHANCED', stripeSessionId: 'vs_c1' };
    mockDbSelect.mockReturnValue(makeSelectChain([record]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);

    const { handleVerificationWebhook } = await import('../identity-service');
    const event = {
      type: 'identity.verification_session.canceled',
      data: { object: { id: 'vs_c1', last_error: null, last_verification_report: null } },
    };

    await handleVerificationWebhook(event as Parameters<typeof handleVerificationWebhook>[0]);

    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.status).toBe('FAILED');
    expect(setArgs.failureReason).toBe('canceled');
    expect(setArgs.retryAfter).toBeInstanceOf(Date);
  });
});
