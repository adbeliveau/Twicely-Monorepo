/**
 * Tests for client-side Ed25519 token verification (G2.7).
 * Uses real keys to ensure cross-compatibility between server sign and client verify.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { generateKeyPairSync } from 'crypto';

// ─── Key Setup ────────────────────────────────────────────────────────────────

function generateTestKeyPair(): { privateKeyB64: string; publicKeyB64: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    publicKeyEncoding: { type: 'spki', format: 'der' },
  });
  return {
    privateKeyB64: privateKey.toString('base64'),
    publicKeyB64: publicKey.toString('base64'),
  };
}

const TEST_KEYS = generateTestKeyPair();

function setTestEnv() {
  process.env.LOCAL_TX_SIGNING_KEY = TEST_KEYS.privateKeyB64;
  process.env.NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY = TEST_KEYS.publicKeyB64;
}

function clearTestEnv() {
  delete process.env.LOCAL_TX_SIGNING_KEY;
  delete process.env.NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY;
}

// ─── Imports ──────────────────────────────────────────────────────────────────

import { signToken } from '../local-token';
import { verifyTokenClient, getPublicKeyBytes } from '../local-token-client';
import type { LocalTransactionTokenPayload } from '../local-token-types';

function makePayload(overrides: Partial<LocalTransactionTokenPayload> = {}): LocalTransactionTokenPayload {
  return {
    transactionId: 'tx-abc',
    amountCents: 5000,
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    role: 'BUYER',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    nonce: 'nonce-abc',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getPublicKeyBytes', () => {
  afterEach(clearTestEnv);

  it('returns a 32-byte Uint8Array from SPKI DER', () => {
    setTestEnv();
    const bytes = getPublicKeyBytes();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
  });

  it('throws when public key env var is not set', () => {
    clearTestEnv();
    expect(() => getPublicKeyBytes()).toThrow('NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY');
  });
});

describe('verifyTokenClient', () => {
  afterEach(clearTestEnv);

  it('verifies a token signed by the server', () => {
    setTestEnv();
    const payload = makePayload();
    const token = signToken(payload);
    const result = verifyTokenClient(token);
    expect(result.valid).toBe(true);
    expect(result.payload?.transactionId).toBe('tx-abc');
    expect(result.payload?.role).toBe('BUYER');
  });

  it('rejects a tampered token', () => {
    setTestEnv();
    const token = signToken(makePayload());
    const parts = token.split('.');
    const tampered = parts[0]!.slice(0, -1) + (parts[0]!.slice(-1) === 'A' ? 'B' : 'A');
    const result = verifyTokenClient(`${tampered}.${parts[1]}`);
    expect(result.valid).toBe(false);
  });

  it('rejects an expired token', () => {
    setTestEnv();
    const payload = makePayload({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    const token = signToken(payload);
    const result = verifyTokenClient(token);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it('rejects a token with no dot separator', () => {
    setTestEnv();
    const result = verifyTokenClient('invalidtoken');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid token format');
  });

  it('returns the full payload on valid token', () => {
    setTestEnv();
    const payload = makePayload({ amountCents: 9900, role: 'SELLER' });
    const token = signToken(payload);
    const result = verifyTokenClient(token);
    expect(result.valid).toBe(true);
    expect(result.payload?.amountCents).toBe(9900);
    expect(result.payload?.role).toBe('SELLER');
  });
});
