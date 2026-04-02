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
 * Return a shallow copy of a CrosslisterAccount with decrypted tokens.
 * Use this at the start of any connector method that reads account tokens.
 */
export function withDecryptedTokens<T extends Pick<CrosslisterAccount, 'accessToken' | 'refreshToken'>>(
  account: T,
): T {
  return {
    ...account,
    accessToken: decryptToken(account.accessToken),
    refreshToken: decryptToken(account.refreshToken),
  };
}
