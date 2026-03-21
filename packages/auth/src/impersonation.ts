import { createHmac } from 'crypto';
import { cookies } from 'next/headers';

export interface ImpersonationTokenPayload {
  targetUserId: string;
  staffUserId: string;
  staffDisplayName: string;
  expiresAt: number; // ms since epoch
}

const COOKIE_NAME = 'twicely.impersonation_token';

function getSecret(): string {
  const secret = process.env.IMPERSONATION_SECRET;
  if (!secret) {
    throw new Error('IMPERSONATION_SECRET is not configured');
  }
  return secret;
}

/**
 * Creates a signed impersonation token string.
 * Token structure: base64url(payload) + '.' + hmac_sha256_hex
 * Throws if IMPERSONATION_SECRET is not set.
 */
export function createImpersonationToken(
  payload: ImpersonationTokenPayload
): string {
  const secret = getSecret();
  const json = JSON.stringify(payload);
  const encodedPayload = Buffer.from(json).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('hex');
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies signature and expiry. Returns null on any failure.
 */
export function verifyImpersonationToken(
  token: string
): ImpersonationTokenPayload | null {
  if (!token) return null;

  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return null;

  const encodedPayload = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);

  if (!encodedPayload || !providedSig) return null;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }

  const expectedSig = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (providedSig.length !== expectedSig.length) return null;

  let mismatch = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= providedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  let payload: ImpersonationTokenPayload;
  try {
    const json = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    payload = JSON.parse(json) as ImpersonationTokenPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.targetUserId !== 'string' ||
    typeof payload.staffUserId !== 'string' ||
    typeof payload.staffDisplayName !== 'string' ||
    typeof payload.expiresAt !== 'number'
  ) {
    return null;
  }

  if (payload.expiresAt <= Date.now()) return null;

  return payload;
}

/**
 * Reads twicely.impersonation_token from Next.js cookies().
 * Returns null if absent or invalid.
 * Must be called from a Server Component, Route Handler, or Server Action.
 */
export async function getImpersonationSession(): Promise<ImpersonationTokenPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return verifyImpersonationToken(raw);
}
