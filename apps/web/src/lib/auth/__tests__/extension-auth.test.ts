import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jwtVerify } from 'jose';

const mockGetSession = vi.fn();
const mockDbSelect = vi.fn();

vi.mock('@twicely/auth/server', () => ({
  auth: { api: { getSession: mockGetSession } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('@twicely/db/schema', () => ({
  user: {
    id: 'user.id',
    isSeller: 'user.isSeller',
    isBanned: 'user.isBanned',
    displayName: 'user.displayName',
    name: 'user.name',
    image: 'user.image',
    avatarUrl: 'user.avatarUrl',
  },
  session: {
    id: 'session.id',
    userId: 'session.userId',
    expiresAt: 'session.expiresAt',
  },
  account: {
    updatedAt: 'account.updatedAt',
    userId: 'account.userId',
    providerId: 'account.providerId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => 'eq'),
  and: vi.fn((..._args: unknown[]) => 'and'),
}));

const TEST_SECRET = 'test-extension-jwt-secret-32chars!!';

function makeSelectResult(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function queueActiveSellerState(overrides?: {
  userRow?: Record<string, unknown>;
  sessionRows?: Array<Record<string, unknown>>;
  credentialRows?: Array<Record<string, unknown>>;
}): void {
  mockDbSelect
    .mockReturnValueOnce(makeSelectResult([
      {
        id: 'user-abc',
        isSeller: true,
        isBanned: false,
        displayName: 'Jane Seller',
        name: 'Jane',
        image: null,
        avatarUrl: null,
        ...overrides?.userRow,
      },
    ]))
    .mockReturnValueOnce(makeSelectResult(
      overrides?.sessionRows ?? [
        { id: 'sess-123', expiresAt: new Date(Date.now() + 60_000) },
      ],
    ))
    .mockReturnValueOnce(makeSelectResult(
      overrides?.credentialRows ?? [{ updatedAt: new Date('2026-04-03T12:00:00.000Z') }],
    ));
}

async function makeToken(
  payload: Record<string, unknown>,
  expiresIn = '30d',
): Promise<string> {
  const { SignJWT } = await import('jose');
  const secret = new TextEncoder().encode(TEST_SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

describe('extension-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);
  });

  it('returns anonymous registration context when Better Auth has no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const { getCurrentExtensionRegistrationContext } = await import('../extension-auth');
    await expect(getCurrentExtensionRegistrationContext()).resolves.toEqual({ kind: 'anonymous' });
  });

  it('returns ok registration context for an active seller session', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user-abc' },
      session: { id: 'sess-123' },
    });
    queueActiveSellerState();

    const { getCurrentExtensionRegistrationContext } = await import('../extension-auth');
    const result = await getCurrentExtensionRegistrationContext();

    expect(result).toEqual({
      kind: 'ok',
      context: {
        claims: {
          userId: 'user-abc',
          sessionId: 'sess-123',
          credentialUpdatedAtMs: new Date('2026-04-03T12:00:00.000Z').getTime(),
        },
        principal: {
          userId: 'user-abc',
          displayName: 'Jane Seller',
          name: 'Jane',
          image: null,
          avatarUrl: null,
        },
      },
    });
  });

  it('rejects extension tokens for banned users', async () => {
    queueActiveSellerState({ userRow: { isBanned: true } });
    const token = await makeToken({
      userId: 'user-abc',
      sessionId: 'sess-123',
      credentialUpdatedAtMs: new Date('2026-04-03T12:00:00.000Z').getTime(),
      purpose: 'extension-session',
    });

    const { verifyExtensionToken } = await import('../extension-auth');

    await expect(verifyExtensionToken(token, 'extension-session')).rejects.toMatchObject({
      status: 403,
      message: 'Invalid or revoked token',
    });
  });

  it('rejects extension tokens when the credential timestamp changes', async () => {
    queueActiveSellerState({
      credentialRows: [{ updatedAt: new Date('2026-04-04T12:00:00.000Z') }],
    });
    const token = await makeToken({
      userId: 'user-abc',
      sessionId: 'sess-123',
      credentialUpdatedAtMs: new Date('2026-04-03T12:00:00.000Z').getTime(),
      purpose: 'extension-session',
    });

    const { verifyExtensionToken } = await import('../extension-auth');

    await expect(verifyExtensionToken(token, 'extension-session')).rejects.toMatchObject({
      status: 403,
      message: 'Invalid or revoked token',
    });
  });

  it('issues signed tokens with session-bound claims', async () => {
    const { issueExtensionToken } = await import('../extension-auth');
    const token = await issueExtensionToken(
      {
        userId: 'user-abc',
        sessionId: 'sess-123',
        credentialUpdatedAtMs: 123,
      },
      'extension-session',
      '30d',
    );

    const secret = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(token, secret);

    expect(payload['userId']).toBe('user-abc');
    expect(payload['sessionId']).toBe('sess-123');
    expect(payload['credentialUpdatedAtMs']).toBe(123);
    expect(payload['purpose']).toBe('extension-session');
  });
});
