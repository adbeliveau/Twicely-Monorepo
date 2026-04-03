/**
 * Token encryption/decryption helpers for crosslister OAuth tokens.
 * Wraps @twicely/db/encryption (AES-256-GCM) with backward-compatible
 * plaintext handling for migration from unencrypted tokens.
 */

import { encrypt, decrypt } from '@twicely/db/encryption';
import type { CrosslisterAccount } from './db-types';

/**
 * Encrypt an OAuth token before storing in the database.
 * Returns null if the input is null/undefined.
 */
export function encryptToken(token: string | null | undefined): string | null {
  if (!token) return null;
  return encrypt(token);
}

/**
 * Decrypt an OAuth token read from the database.
 * Handles both encrypted (AES-256-GCM format) and legacy plaintext tokens.
 * Returns null if the input is null/undefined.
 */
export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return decrypt(stored);
  } catch {
    // Legacy plaintext token — return as-is
    return stored;
  }
}

/**
 * Encrypt session data (JSONB) before storing in the database.
 * Serializes the object to JSON, encrypts the string, returns the encrypted blob.
 * Returns null if the input is null/undefined.
 */
export function encryptSessionData(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  const json = JSON.stringify(data);
  return encrypt(json);
}

/**
 * Decrypt session data read from the database.
 * Handles both encrypted (AES-256-GCM string) and legacy plaintext objects.
 * Returns null if the input is null/undefined.
 */
export function decryptSessionData(stored: unknown): Record<string, unknown> | null {
  if (stored == null) return null;
  // Legacy plaintext — already a JSON object
  if (typeof stored === 'object') return stored as Record<string, unknown>;
  // Encrypted string — decrypt and parse
  if (typeof stored === 'string') {
    try {
      const json = decrypt(stored);
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      // Malformed — return null rather than crash
      return null;
    }
  }
  return null;
}

/**
 * Return a shallow copy of a CrosslisterAccount with decrypted tokens and session data.
 * Use this at the start of any connector method that reads account tokens.
 */
export function withDecryptedTokens<T extends Pick<CrosslisterAccount, 'accessToken' | 'refreshToken'> & { sessionData?: unknown }>(
  account: T,
): T {
  return {
    ...account,
    accessToken: decryptToken(account.accessToken),
    refreshToken: decryptToken(account.refreshToken),
    sessionData: decryptSessionData(account.sessionData),
  };
}
