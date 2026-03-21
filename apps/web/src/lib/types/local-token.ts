/**
 * Shared types for dual-token Ed25519 local transaction system (G2.7).
 * Shared between server-side token service and client-side token verification.
 */

export interface LocalTransactionTokenPayload {
  transactionId: string;
  amountCents: number;
  buyerId: string;
  sellerId: string;
  role: 'BUYER' | 'SELLER';
  expiresAt: string; // ISO 8601
  nonce: string;     // cuid2 — unique per token, marked used on first submission
}

export interface PreloadedTokenData {
  sellerToken: string;
  buyerToken: string;
  sellerOfflineCode: string;
  buyerOfflineCode: string;
  transactionId: string;
  amountCents: number;
  expiresAt: string;
  storedAt: string; // ISO 8601
}
