/**
 * Tests for server-side Ed25519 token service (G2.7).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// We use actual crypto for sign/verify since we are testing the real functionality.
// We only need to control env vars and createId.

vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn().mockReturnValue('test-nonce-cuid2'),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { generateKeyPairSync } from 'crypto';

/**
 * Generate a real Ed25519 key pair and return base64-encoded PKCS8 private + SPKI public.
 */
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

// ─── Import after env setup ───────────────────────────────────────────────────

import {
  getSigningKey,
  getVerifyKey,
  signToken,
  verifyTokenServer,
  generateOfflineCode,
  generateTokenPair,
} from '../local-token';
import type { LocalTransactionTokenPayload } from '../local-token-types';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getSigningKey', () => {
  afterEach(clearTestEnv);

  it('returns a Buffer when LOCAL_TX_SIGNING_KEY is set', () => {
    setTestEnv();
    const key = getSigningKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBeGreaterThan(0);
  });

  it('throws when LOCAL_TX_SIGNING_KEY is not set', () => {
    clearTestEnv();
    expect(() => getSigningKey()).toThrow('LOCAL_TX_SIGNING_KEY');
  });
});

describe('getVerifyKey', () => {
  afterEach(clearTestEnv);

  it('returns the public key base64 string', () => {
    setTestEnv();
    const key = getVerifyKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
    expect(key).toBe(TEST_KEYS.publicKeyB64);
  });

  it('throws when NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY is not set', () => {
    clearTestEnv();
    expect(() => getVerifyKey()).toThrow('NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY');
  });
});

describe('signToken + verifyTokenServer', () => {
  beforeEach(setTestEnv);
  afterEach(clearTestEnv);

  function makePayload(overrides: Partial<LocalTransactionTokenPayload> = {}): LocalTransactionTokenPayload {
    return {
      transactionId: 'tx-abc123',
      amountCents: 5000,
      buyerId: 'buyer-001',
      sellerId: 'seller-001',
      role: 'SELLER',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      nonce: 'nonce-xyz',
      ...overrides,
    };
  }

  it('produces a token with two dot-separated base64url parts', () => {
    const token = signToken(makePayload());
    const parts = token.split('.');
    expect(parts.length).toBe(2);
    expect(parts[0]?.length).toBeGreaterThan(0);
    expect(parts[1]?.length).toBeGreaterThan(0);
  });

  it('verifyTokenServer returns valid=true for a freshly signed token', () => {
    const payload = makePayload();
    const token = signToken(payload);
    const result = verifyTokenServer(token);
    expect(result.valid).toBe(true);
    expect(result.payload?.transactionId).toBe('tx-abc123');
    expect(result.payload?.role).toBe('SELLER');
  });

  it('verifyTokenServer rejects a tampered payload', () => {
    const token = signToken(makePayload());
    const parts = token.split('.');
    // Flip one character in the payload part
    const tamperedPayload = parts[0]!.slice(0, -1) + (parts[0]!.slice(-1) === 'A' ? 'B' : 'A');
    const tamperedToken = `${tamperedPayload}.${parts[1]}`;
    const result = verifyTokenServer(tamperedToken);
    expect(result.valid).toBe(false);
  });

  it('verifyTokenServer rejects an expired token', () => {
    const payload = makePayload({
      expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second in the past
    });
    const token = signToken(payload);
    const result = verifyTokenServer(token);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it('verifyTokenServer rejects a token with no dot separator', () => {
    const result = verifyTokenServer('notavalidtoken');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid token format');
  });

  it('verifyTokenServer returns the full payload when valid', () => {
    const payload = makePayload({ role: 'BUYER', amountCents: 9900 });
    const token = signToken(payload);
    const result = verifyTokenServer(token);
    expect(result.valid).toBe(true);
    expect(result.payload?.amountCents).toBe(9900);
    expect(result.payload?.role).toBe('BUYER');
    expect(result.payload?.nonce).toBe('nonce-xyz');
  });
});

describe('generateOfflineCode', () => {
  it('returns a 6-digit string', () => {
    const code = generateOfflineCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('returns a value in range 100000-999999', () => {
    for (let i = 0; i < 20; i++) {
      const code = parseInt(generateOfflineCode(), 10);
      expect(code).toBeGreaterThanOrEqual(100000);
      expect(code).toBeLessThanOrEqual(999999);
    }
  });
});

describe('generateTokenPair', () => {
  beforeEach(setTestEnv);
  afterEach(clearTestEnv);

  it('returns sellerToken, buyerToken, sellerOfflineCode, buyerOfflineCode', () => {
    const result = generateTokenPair({
      transactionId: 'tx-1',
      amountCents: 5000,
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      expiresAt: new Date(Date.now() + 3600_000),
    });

    expect(typeof result.sellerToken).toBe('string');
    expect(typeof result.buyerToken).toBe('string');
    expect(result.sellerOfflineCode).toMatch(/^\d{6}$/);
    expect(result.buyerOfflineCode).toMatch(/^\d{6}$/);
    expect(typeof result.sellerNonce).toBe('string');
    expect(typeof result.buyerNonce).toBe('string');
  });

  it('seller token has role=SELLER, buyer token has role=BUYER', () => {
    const result = generateTokenPair({
      transactionId: 'tx-2',
      amountCents: 2000,
      buyerId: 'b2',
      sellerId: 's2',
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const sellerVerify = verifyTokenServer(result.sellerToken);
    const buyerVerify = verifyTokenServer(result.buyerToken);

    expect(sellerVerify.valid).toBe(true);
    expect(sellerVerify.payload?.role).toBe('SELLER');
    expect(buyerVerify.valid).toBe(true);
    expect(buyerVerify.payload?.role).toBe('BUYER');
  });

  it('both tokens share same transactionId and amountCents', () => {
    const result = generateTokenPair({
      transactionId: 'tx-shared',
      amountCents: 7500,
      buyerId: 'b3',
      sellerId: 's3',
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const sellerVerify = verifyTokenServer(result.sellerToken);
    const buyerVerify = verifyTokenServer(result.buyerToken);

    expect(sellerVerify.payload?.transactionId).toBe('tx-shared');
    expect(buyerVerify.payload?.transactionId).toBe('tx-shared');
    expect(sellerVerify.payload?.amountCents).toBe(7500);
    expect(buyerVerify.payload?.amountCents).toBe(7500);
  });
});
