import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    update: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', cookieConsentJson: 'cookie_consent_json' },
  auditEvent: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
}));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((type: string, props: Record<string, unknown>) => ({ __caslSubjectType__: type, ...props })),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(true),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

function makeUpdateChain() {
  const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  chain.set.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeSelectChain(value: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(value),
  };
  return chain;
}

describe('updateCookieConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when no session', async () => {
    const { authorize } = await import('@/lib/casl');
    vi.mocked(authorize).mockResolvedValue({ session: null, ability: null } as unknown as Awaited<ReturnType<typeof authorize>>);

    const { updateCookieConsent } = await import('../cookie-consent');
    const result = await updateCookieConsent({ functional: true, analytics: false });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('rejects invalid input', async () => {
    const { authorize } = await import('@/lib/casl');
    vi.mocked(authorize).mockResolvedValue({
      session: { userId: 'user-1' },
      ability: { can: vi.fn().mockReturnValue(true) },
    } as unknown as Awaited<ReturnType<typeof authorize>>);

    const { updateCookieConsent } = await import('../cookie-consent');
    // Pass unknown field to trigger strict rejection
    const result = await updateCookieConsent({ functional: true, analytics: false, extra: true } as unknown as { functional: boolean; analytics: boolean });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('returns success without saving when consentRequired is false', async () => {
    const { authorize } = await import('@/lib/casl');
    const { getPlatformSetting } = await import('@/lib/queries/platform-settings');
    const { db } = await import('@/lib/db');

    vi.mocked(authorize).mockResolvedValue({
      session: { userId: 'user-2' },
      ability: { can: vi.fn().mockReturnValue(true) },
    } as unknown as Awaited<ReturnType<typeof authorize>>);
    vi.mocked(getPlatformSetting).mockResolvedValue(false as unknown as never);

    const { updateCookieConsent } = await import('../cookie-consent');
    const result = await updateCookieConsent({ functional: true, analytics: true });

    expect(result.success).toBe(true);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('saves consent to cookieConsentJson field', async () => {
    const { authorize } = await import('@/lib/casl');
    const { getPlatformSetting } = await import('@/lib/queries/platform-settings');
    const { db } = await import('@/lib/db');

    vi.mocked(authorize).mockResolvedValue({
      session: { userId: 'user-3' },
      ability: { can: vi.fn().mockReturnValue(true) },
    } as unknown as Awaited<ReturnType<typeof authorize>>);
    vi.mocked(getPlatformSetting).mockResolvedValue(true as unknown as never);

    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);

    const { updateCookieConsent } = await import('../cookie-consent');
    const result = await updateCookieConsent({ functional: true, analytics: false });

    expect(result.success).toBe(true);
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('creates LOW severity audit event on consent change', async () => {
    const { authorize } = await import('@/lib/casl');
    const { getPlatformSetting } = await import('@/lib/queries/platform-settings');
    const { db } = await import('@/lib/db');

    vi.mocked(authorize).mockResolvedValue({
      session: { userId: 'user-4' },
      ability: { can: vi.fn().mockReturnValue(true) },
    } as unknown as Awaited<ReturnType<typeof authorize>>);
    vi.mocked(getPlatformSetting).mockResolvedValue(true as unknown as never);

    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
    const insertChain = makeInsertChain();
    vi.mocked(db.insert).mockReturnValue(insertChain as unknown as ReturnType<typeof db.insert>);

    const { updateCookieConsent } = await import('../cookie-consent');
    await updateCookieConsent({ functional: false, analytics: false });

    expect(db.insert).toHaveBeenCalledTimes(1);
    const valuesPayload = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(valuesPayload?.severity).toBe('LOW');
    expect(valuesPayload?.action).toBe('COOKIE_CONSENT_UPDATED');
  });
});

describe('getCookieConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns null when not authenticated', async () => {
    const { authorize } = await import('@/lib/casl');
    vi.mocked(authorize).mockResolvedValue({ session: null, ability: null } as unknown as Awaited<ReturnType<typeof authorize>>);

    const { getCookieConsent } = await import('../cookie-consent');
    const result = await getCookieConsent();

    expect(result).toBeNull();
  });

  it('returns null when user has no stored consent', async () => {
    const { authorize } = await import('@/lib/casl');
    const { db } = await import('@/lib/db');

    vi.mocked(authorize).mockResolvedValue({
      session: { userId: 'user-5' },
      ability: { can: vi.fn().mockReturnValue(true) },
    } as unknown as Awaited<ReturnType<typeof authorize>>);
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ cookieConsentJson: null }]) as unknown as ReturnType<typeof db.select>
    );

    const { getCookieConsent } = await import('../cookie-consent');
    const result = await getCookieConsent();

    expect(result).toBeNull();
  });

  it('returns parsed consent when stored', async () => {
    const { authorize } = await import('@/lib/casl');
    const { db } = await import('@/lib/db');

    vi.mocked(authorize).mockResolvedValue({
      session: { userId: 'user-6' },
      ability: { can: vi.fn().mockReturnValue(true) },
    } as unknown as Awaited<ReturnType<typeof authorize>>);
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([
        { cookieConsentJson: { functional: true, analytics: false, version: 1 } },
      ]) as unknown as ReturnType<typeof db.select>
    );

    const { getCookieConsent } = await import('../cookie-consent');
    const result = await getCookieConsent();

    expect(result).toEqual({ functional: true, analytics: false });
  });
});
