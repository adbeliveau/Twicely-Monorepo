/**
 * Ed25519 Token Service for Local Transactions (G2.7)
 *
 * Server-side only. Signs and verifies tokens using Ed25519.
 * Keys read from environment variables — never hardcoded.
 *
 * Token format: base64url(JSON payload).base64url(64-byte signature)
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A4
 */

import { sign, verify, createPrivateKey, createPublicKey } from 'crypto';
import { createId } from '@paralleldrive/cuid2';
import type { LocalTransactionTokenPayload } from './local-token-types';

export type { LocalTransactionTokenPayload };

// ─── Key Helpers ─────────────────────────────────────────────────────────────

/**
 * Read and decode the Ed25519 private key from environment.
 * Key must be base64-encoded PKCS8 DER (64 bytes raw → 118 bytes DER).
 */
export function getSigningKey(): Buffer {
  const b64 = process.env.LOCAL_TX_SIGNING_KEY;
  if (!b64) {
    throw new Error('[local-token] LOCAL_TX_SIGNING_KEY environment variable is not set');
  }
  return Buffer.from(b64, 'base64');
}

/**
 * Read the Ed25519 public key (base64-encoded) from environment.
 * Returns the raw base64 string for embedding in responses.
 */
export function getVerifyKey(): string {
  const b64 = process.env.NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY;
  if (!b64) {
    throw new Error('[local-token] NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY environment variable is not set');
  }
  return b64;
}

// ─── Base64url Helpers ────────────────────────────────────────────────────────

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromBase64Url(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padding), 'base64');
}

// ─── Token Signing ────────────────────────────────────────────────────────────

/**
 * Sign a token payload with Ed25519.
 * Returns: base64url(JSON).base64url(signature)
 */
export function signToken(payload: LocalTransactionTokenPayload): string {
  const keyBuf = getSigningKey();
  const privateKey = createPrivateKey({
    key: keyBuf,
    format: 'der',
    type: 'pkcs8',
  });

  const payloadJson = JSON.stringify(payload);
  const payloadBuf = Buffer.from(payloadJson, 'utf8');
  const payloadB64Url = toBase64Url(payloadBuf);

  const signatureBuf = sign(null, payloadBuf, privateKey);
  const signatureB64Url = toBase64Url(signatureBuf);

  return `${payloadB64Url}.${signatureB64Url}`;
}

// ─── Token Verification (Server) ─────────────────────────────────────────────

export interface TokenVerifyResult {
  valid: boolean;
  payload?: LocalTransactionTokenPayload;
  error?: string;
}

/**
 * Verify an Ed25519 token on the server.
 * Checks signature, expiry. Does not check nonce (caller must do that).
 */
export function verifyTokenServer(token: string): TokenVerifyResult {
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) {
    return { valid: false, error: 'Invalid token format' };
  }

  const payloadB64Url = token.slice(0, dotIdx);
  const signatureB64Url = token.slice(dotIdx + 1);

  let payloadBuf: Buffer;
  let signatureBuf: Buffer;
  try {
    payloadBuf = fromBase64Url(payloadB64Url);
    signatureBuf = fromBase64Url(signatureB64Url);
  } catch {
    return { valid: false, error: 'Invalid token encoding' };
  }

  // Reconstruct public key from PKCS8 DER private key bytes
  let verified = false;
  try {
    const keyBuf = getSigningKey();
    const privateKey = createPrivateKey({ key: keyBuf, format: 'der', type: 'pkcs8' });
    const publicKey = createPublicKey(privateKey);

    verified = verify(null, payloadBuf, publicKey, signatureBuf);
  } catch {
    return { valid: false, error: 'Signature verification failed' };
  }

  if (!verified) {
    return { valid: false, error: 'Invalid signature' };
  }

  let payload: LocalTransactionTokenPayload;
  try {
    payload = JSON.parse(payloadBuf.toString('utf8')) as LocalTransactionTokenPayload;
  } catch {
    return { valid: false, error: 'Invalid token payload' };
  }

  // Check expiry
  const expiresAt = new Date(payload.expiresAt);
  if (isNaN(expiresAt.getTime()) || new Date() > expiresAt) {
    return { valid: false, error: 'Token expired' };
  }

  return { valid: true, payload };
}

// ─── Offline Code Generation ──────────────────────────────────────────────────

/**
 * Generate a cryptographically random 6-digit numeric code.
 * Range: 100000-999999 (always 6 digits, no leading zeros).
 */
export function generateOfflineCode(): string {
  const { randomInt } = require('crypto') as typeof import('crypto');
  return randomInt(100000, 1000000).toString();
}

// ─── Token Pair Generation ────────────────────────────────────────────────────

export interface TokenPairResult {
  sellerToken: string;
  buyerToken: string;
  sellerOfflineCode: string;
  buyerOfflineCode: string;
  sellerNonce: string;
  buyerNonce: string;
}

export interface GenerateTokenPairParams {
  transactionId: string;
  amountCents: number;
  buyerId: string;
  sellerId: string;
  expiresAt: Date;
}

/**
 * Generate a seller token, buyer token, and two 6-digit offline codes
 * for a local transaction. Both tokens are signed with Ed25519.
 */
export function generateTokenPair(params: GenerateTokenPairParams): TokenPairResult {
  const { transactionId, amountCents, buyerId, sellerId, expiresAt } = params;
  const expiresAtIso = expiresAt.toISOString();

  const sellerNonce = createId();
  const buyerNonce = createId();

  const sellerPayload: LocalTransactionTokenPayload = {
    transactionId,
    amountCents,
    buyerId,
    sellerId,
    role: 'SELLER',
    expiresAt: expiresAtIso,
    nonce: sellerNonce,
  };

  const buyerPayload: LocalTransactionTokenPayload = {
    transactionId,
    amountCents,
    buyerId,
    sellerId,
    role: 'BUYER',
    expiresAt: expiresAtIso,
    nonce: buyerNonce,
  };

  return {
    sellerToken: signToken(sellerPayload),
    buyerToken: signToken(buyerPayload),
    sellerOfflineCode: generateOfflineCode(),
    buyerOfflineCode: generateOfflineCode(),
    sellerNonce,
    buyerNonce,
  };
}
