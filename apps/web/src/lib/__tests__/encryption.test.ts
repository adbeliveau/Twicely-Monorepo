import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, maskTaxId } from '@twicely/db/encryption';

/**
 * Tests for src/lib/encryption.ts
 * AES-256-GCM encrypt/decrypt round-trip + maskTaxId display formats.
 * Uses real Node.js crypto — no mocking needed.
 * getKey() is called per-operation so env var changes take effect immediately.
 */

const VALID_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

describe('encrypt / decrypt round-trip', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it('decrypts SSN back to original 9-digit string', () => {
    const ciphertext = encrypt('123456789');
    expect(decrypt(ciphertext)).toBe('123456789');
  });

  it('decrypts EIN plaintext correctly', () => {
    const plaintext = '987654321';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('decrypts ITIN (starts with 9) correctly', () => {
    const plaintext = '912345678';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('produces iv:tag:ciphertext format with exactly 3 colon-separated parts', () => {
    const result = encrypt('123456789');
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
  });

  it('produces different ciphertext each call due to random IV', () => {
    const c1 = encrypt('123456789');
    const c2 = encrypt('123456789');
    expect(c1).not.toBe(c2);
  });

  it('throws when ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set');
  });

  it('throws when ENCRYPTION_KEY is wrong length (not 32 bytes)', () => {
    process.env.ENCRYPTION_KEY = 'aabbcc'; // only 3 bytes
    expect(() => encrypt('test')).toThrow('64-character hex string');
  });

  it('throws on tampered ciphertext (GCM auth tag mismatch)', () => {
    const ciphertext = encrypt('sensitive-data');
    const parts = ciphertext.split(':');
    // Replace ciphertext portion with garbage base64
    const tampered = `${parts[0]}:${parts[1]}:AAAAAAAAAAAAAAAA`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws when encrypted string has wrong number of colon-separated parts', () => {
    expect(() => decrypt('only-two:parts')).toThrow('Invalid encrypted string format');
  });

  it('round-trip preserves unicode / special characters', () => {
    const text = 'test-value-with-special-chars!@#';
    expect(decrypt(encrypt(text))).toBe(text);
  });
});

describe('maskTaxId', () => {
  it('formats SSN as ***-**-XXXX', () => {
    expect(maskTaxId('6789', 'SSN')).toBe('***-**-6789');
  });

  it('formats ITIN as ***-**-XXXX (same pattern as SSN)', () => {
    expect(maskTaxId('1234', 'ITIN')).toBe('***-**-1234');
  });

  it('formats EIN as **-***XXXX', () => {
    expect(maskTaxId('5678', 'EIN')).toBe('**-***5678');
  });

  it('non-EIN type defaults to SSN/ITIN format', () => {
    expect(maskTaxId('0000', 'UNKNOWN')).toBe('***-**-0000');
  });
});
