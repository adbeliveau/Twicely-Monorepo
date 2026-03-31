/**
 * Client-side Ed25519 token verification for local transactions (G2.7).
 *
 * Uses tweetnacl for offline signature verification in the browser.
 * NO Node.js dependencies — safe to import from 'use client' components.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A4
 */

import nacl from 'tweetnacl';
import { decodeBase64 } from 'tweetnacl-util';
import type { LocalTransactionTokenPayload } from './local-token-types';

export type { LocalTransactionTokenPayload };

// ─── Key Helpers ─────────────────────────────────────────────────────────────

// SPKI DER for Ed25519 has a 12-byte ASN.1 header before the raw 32-byte key.
const SPKI_HEADER_BYTES = 12;

/**
 * Read the public key from NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY.
 * Base64-decodes the SPKI DER, strips the 12-byte header, returns raw 32-byte key.
 */
export function getPublicKeyBytes(): Uint8Array {
  const b64 = process.env.NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY;
  if (!b64) {
    throw new Error('[local-token-client] NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY is not set');
  }
  const decoded = decodeBase64(b64);
  if (decoded.length < SPKI_HEADER_BYTES + 32) {
    throw new Error('[local-token-client] Public key is too short');
  }
  return decoded.slice(SPKI_HEADER_BYTES, SPKI_HEADER_BYTES + 32);
}

// ─── Base64url Helpers ────────────────────────────────────────────────────────

function fromBase64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  return decodeBase64(padded + '='.repeat(padding));
}

// ─── Client Token Verification ───────────────────────────────────────────────

export interface ClientTokenVerifyResult {
  valid: boolean;
  payload?: LocalTransactionTokenPayload;
  error?: string;
}

/**
 * Verify an Ed25519 token in the browser using tweetnacl.
 * Checks signature and expiry. Does not check nonce (server handles replay prevention).
 */
export function verifyTokenClient(token: string): ClientTokenVerifyResult {
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) {
    return { valid: false, error: 'Invalid token format' };
  }

  const payloadB64Url = token.slice(0, dotIdx);
  const signatureB64Url = token.slice(dotIdx + 1);

  let payloadBytes: Uint8Array;
  let signatureBytes: Uint8Array;
  try {
    payloadBytes = fromBase64Url(payloadB64Url);
    signatureBytes = fromBase64Url(signatureB64Url);
  } catch {
    return { valid: false, error: 'Invalid token encoding' };
  }

  let publicKeyBytes: Uint8Array;
  try {
    publicKeyBytes = getPublicKeyBytes();
  } catch {
    return { valid: false, error: 'Public key unavailable' };
  }

  const isValid = nacl.sign.detached.verify(payloadBytes, signatureBytes, publicKeyBytes);
  if (!isValid) {
    return { valid: false, error: 'Invalid signature' };
  }

  let payload: LocalTransactionTokenPayload;
  try {
    const json = new TextDecoder().decode(payloadBytes);
    payload = JSON.parse(json) as LocalTransactionTokenPayload;
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
