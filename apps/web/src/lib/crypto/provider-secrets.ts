/**
 * AES-256-GCM encryption for provider secrets (API keys, tokens).
 * Secrets are stored encrypted in provider_secret.encrypted_value.
 * Requires PROVIDER_ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.PROVIDER_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'PROVIDER_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    );
  }
  return Buffer.from(hex, 'hex');
}

/** Encrypt plaintext → "iv:ciphertext:tag" (all hex). */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/** Decrypt "iv:ciphertext:tag" → plaintext. */
export function decryptSecret(encryptedValue: string): string {
  const key = getKey();
  const [ivHex, encHex, tagHex] = encryptedValue.split(':');
  if (!ivHex || !encHex || !tagHex) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Show "••••••••" + last 4 chars (or just dots if too short). */
export function maskSecret(value: string): string {
  if (value.length <= 4) return '••••••••';
  return '••••••••' + value.slice(-4);
}
