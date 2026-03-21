/**
 * Local Transaction Token Validation (G2.7)
 *
 * Validates Ed25519 signed tokens and 6-digit offline codes
 * for local pickup transactions (dual-token system).
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A4
 */

import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { verifyTokenServer } from './local-token';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CodeValidationResult {
  valid: boolean;
  transaction?: typeof localTransaction.$inferSelect;
  error?: string;
}

// ─── Token Validation ────────────────────────────────────────────────────────

/**
 * Validate the seller's Ed25519 token (buyer scans seller's QR).
 * Verifies signature, checks role === 'SELLER', checks DB record.
 */
export async function validateSellerToken(token: string): Promise<CodeValidationResult> {
  const verify = verifyTokenServer(token);
  if (!verify.valid || !verify.payload) {
    return { valid: false, error: verify.error ?? 'Invalid seller token' };
  }

  if (verify.payload.role !== 'SELLER') {
    return { valid: false, error: 'Token role mismatch' };
  }

  const [transaction] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.sellerConfirmationCode, token))
    .limit(1);

  if (!transaction) {
    return { valid: false, error: 'Invalid seller token' };
  }

  if (transaction.confirmedAt) {
    return { valid: false, error: 'Token already used' };
  }

  return { valid: true, transaction };
}

/**
 * Validate the buyer's Ed25519 token (seller scans buyer's QR, offline dual mode).
 * Verifies signature, checks role === 'BUYER', checks DB record.
 */
export async function validateBuyerToken(token: string): Promise<CodeValidationResult> {
  const verify = verifyTokenServer(token);
  if (!verify.valid || !verify.payload) {
    return { valid: false, error: verify.error ?? 'Invalid buyer token' };
  }

  if (verify.payload.role !== 'BUYER') {
    return { valid: false, error: 'Token role mismatch' };
  }

  const [transaction] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.buyerConfirmationCode, token))
    .limit(1);

  if (!transaction) {
    return { valid: false, error: 'Invalid buyer token' };
  }

  if (transaction.confirmedAt) {
    return { valid: false, error: 'Token already used' };
  }

  return { valid: true, transaction };
}

// ─── Offline Code Validation ─────────────────────────────────────────────────

/**
 * Validate the seller's 6-digit offline code.
 * Used in CODE_ONLINE and CODE_DUAL_OFFLINE modes.
 */
export async function validateSellerOfflineCode(
  code: string,
  transactionId: string,
): Promise<CodeValidationResult> {
  if (!/^\d{6}$/.test(code)) {
    return { valid: false, error: 'Invalid code format' };
  }

  const [transaction] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, transactionId))
    .limit(1);

  if (!transaction) {
    return { valid: false, error: 'Transaction not found' };
  }

  if (transaction.confirmedAt) {
    return { valid: false, error: 'Code already used' };
  }

  if (transaction.sellerOfflineCode !== code) {
    return { valid: false, error: 'Invalid seller code' };
  }

  return { valid: true, transaction };
}

/**
 * Validate the buyer's 6-digit offline code.
 * Used in CODE_DUAL_OFFLINE mode.
 */
export async function validateBuyerOfflineCode(
  code: string,
  transactionId: string,
): Promise<CodeValidationResult> {
  if (!/^\d{6}$/.test(code)) {
    return { valid: false, error: 'Invalid code format' };
  }

  const [transaction] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, transactionId))
    .limit(1);

  if (!transaction) {
    return { valid: false, error: 'Transaction not found' };
  }

  if (transaction.confirmedAt) {
    return { valid: false, error: 'Code already used' };
  }

  if (transaction.buyerOfflineCode !== code) {
    return { valid: false, error: 'Invalid buyer code' };
  }

  return { valid: true, transaction };
}
