import { headers } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import type { JWTPayload } from 'jose';
import { and, eq } from 'drizzle-orm';
import { auth } from '@twicely/auth/server';
import { db } from '@twicely/db';
import { account, session as authSession, user } from '@twicely/db/schema';

type ExtensionTokenPurpose = 'extension-registration' | 'extension-session';

const CREDENTIAL_PROVIDER_ID = 'credential';

export interface ExtensionTokenClaims {
  userId: string;
  sessionId: string;
  credentialUpdatedAtMs: number | null;
}

export interface ExtensionPrincipal {
  userId: string;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatarUrl: string | null;
}

export interface ExtensionAuthContext {
  claims: ExtensionTokenClaims;
  principal: ExtensionPrincipal;
}

export type ExtensionRegistrationContext =
  | { kind: 'anonymous' }
  | { kind: 'forbidden' }
  | { kind: 'ok'; context: ExtensionAuthContext };

export class ExtensionAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ExtensionAuthError';
    this.status = status;
  }
}

function getExtensionSecret(): Uint8Array {
  const rawSecret = process.env['EXTENSION_JWT_SECRET'];
  if (!rawSecret) {
    throw new ExtensionAuthError(503, 'Extension authentication unavailable');
  }

  return new TextEncoder().encode(rawSecret);
}

function parseExtensionClaims(
  payload: JWTPayload,
  expectedPurpose: ExtensionTokenPurpose,
): ExtensionTokenClaims {
  if (payload['purpose'] !== expectedPurpose) {
    throw new ExtensionAuthError(403, 'Invalid token');
  }

  const userId = payload['userId'];
  if (typeof userId !== 'string' || !userId) {
    throw new ExtensionAuthError(403, 'Invalid token');
  }

  const sessionId = payload['sessionId'];
  if (typeof sessionId !== 'string' || !sessionId) {
    throw new ExtensionAuthError(403, 'Invalid token');
  }

  const rawCredentialUpdatedAtMs = payload['credentialUpdatedAtMs'];
  if (
    rawCredentialUpdatedAtMs !== undefined &&
    rawCredentialUpdatedAtMs !== null &&
    (typeof rawCredentialUpdatedAtMs !== 'number' || !Number.isFinite(rawCredentialUpdatedAtMs))
  ) {
    throw new ExtensionAuthError(403, 'Invalid token');
  }

  return {
    userId,
    sessionId,
    credentialUpdatedAtMs:
      typeof rawCredentialUpdatedAtMs === 'number' ? rawCredentialUpdatedAtMs : null,
  };
}

async function buildExtensionContext(
  userId: string,
  sessionId: string,
): Promise<ExtensionAuthContext | null> {
  const now = new Date();

  const [userRows, sessionRows, credentialRows] = await Promise.all([
    db
      .select({
        id: user.id,
        isSeller: user.isSeller,
        isBanned: user.isBanned,
        displayName: user.displayName,
        name: user.name,
        image: user.image,
        avatarUrl: user.avatarUrl,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),
    db
      .select({
        id: authSession.id,
        expiresAt: authSession.expiresAt,
      })
      .from(authSession)
      .where(and(eq(authSession.id, sessionId), eq(authSession.userId, userId)))
      .limit(1),
    db
      .select({ updatedAt: account.updatedAt })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, CREDENTIAL_PROVIDER_ID)))
      .limit(1),
  ]);

  const dbUser = userRows[0];
  const activeSession = sessionRows[0];
  const credentialAccount = credentialRows[0];

  if (!dbUser || dbUser.isBanned || !dbUser.isSeller) {
    return null;
  }

  if (!activeSession || activeSession.expiresAt <= now) {
    return null;
  }

  return {
    claims: {
      userId,
      sessionId,
      credentialUpdatedAtMs: credentialAccount?.updatedAt?.getTime() ?? null,
    },
    principal: {
      userId,
      displayName: dbUser.displayName ?? null,
      name: dbUser.name ?? null,
      image: dbUser.image ?? null,
      avatarUrl: dbUser.avatarUrl ?? null,
    },
  };
}

export async function getCurrentExtensionRegistrationContext(): Promise<ExtensionRegistrationContext> {
  let betterAuthSession:
    | {
        user?: { id?: string | null };
        session?: { id?: string | null };
      }
    | null = null;

  try {
    betterAuthSession = await auth.api.getSession({
      headers: await headers(),
    });
  } catch {
    return { kind: 'anonymous' };
  }

  const userId = betterAuthSession?.user?.id;
  const sessionId = betterAuthSession?.session?.id;

  if (typeof userId !== 'string' || !userId || typeof sessionId !== 'string' || !sessionId) {
    return { kind: 'anonymous' };
  }

  const context = await buildExtensionContext(userId, sessionId);
  if (!context) {
    return { kind: 'forbidden' };
  }

  return { kind: 'ok', context };
}

export async function issueExtensionToken(
  claims: ExtensionTokenClaims,
  purpose: ExtensionTokenPurpose,
  expiresIn: string,
): Promise<string> {
  const secret = getExtensionSecret();

  return new SignJWT({
    ...claims,
    purpose,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyExtensionToken(
  token: string,
  expectedPurpose: ExtensionTokenPurpose,
): Promise<ExtensionAuthContext> {
  const secret = getExtensionSecret();

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, secret));
  } catch {
    throw new ExtensionAuthError(401, 'Invalid token');
  }

  const claims = parseExtensionClaims(payload, expectedPurpose);
  const context = await buildExtensionContext(claims.userId, claims.sessionId);

  if (!context) {
    throw new ExtensionAuthError(403, 'Invalid or revoked token');
  }

  if (claims.credentialUpdatedAtMs !== context.claims.credentialUpdatedAtMs) {
    throw new ExtensionAuthError(403, 'Invalid or revoked token');
  }

  return context;
}

export async function authenticateExtensionRequest(
  request: Request,
): Promise<ExtensionAuthContext> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ExtensionAuthError(401, 'Unauthorized');
  }

  return verifyExtensionToken(authHeader.slice(7), 'extension-session');
}
