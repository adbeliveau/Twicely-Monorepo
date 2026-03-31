/**
 * SMS Verification — OTP code generation, storage, and validation.
 *
 * - 6-digit code via crypto.randomInt (cryptographically random)
 * - Stored in Valkey with 10-minute TTL
 * - Phone numbers hashed with SHA-256 before use as Valkey keys
 * - Max 3 attempts before lockout (5-minute lockout window)
 */

import { createHash, randomInt } from 'node:crypto';
import { getValkeyClient } from '@twicely/db/cache';
import { logger } from '@twicely/logger';
import { getSmsProvider } from './index';
import type { VerifyResult } from './types';

const CODE_TTL_SECONDS = 600; // 10 minutes
const MAX_ATTEMPTS = 3;
const LOCKOUT_TTL_SECONDS = 300; // 5 minutes

/** Hash a phone number with SHA-256 for use as a Valkey key. */
function hashPhone(phone: string): string {
  return createHash('sha256').update(phone).digest('hex');
}

/** Generate a cryptographically random 6-digit code. */
export function generateCode(): string {
  return String(randomInt(100000, 999999));
}

/**
 * Send a verification code to a phone number.
 * Generates a code, stores it in Valkey, and sends via SMS.
 */
export async function sendVerificationCode(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  const hashed = hashPhone(phone);
  const codeKey = `sms:verify:${hashed}`;
  const attemptKey = `sms:attempts:${hashed}`;
  const valkey = getValkeyClient();

  // Check if locked out
  const attempts = await valkey.get(attemptKey);
  if (attempts && parseInt(attempts, 10) >= MAX_ATTEMPTS) {
    return { success: false, error: 'Too many attempts. Please wait 5 minutes.' };
  }

  const code = generateCode();

  // Store code in Valkey with TTL
  await valkey.set(codeKey, code, 'EX', CODE_TTL_SECONDS);
  // Reset attempt counter when a new code is sent
  await valkey.del(attemptKey);

  // Send via SMS provider
  const provider = getSmsProvider();
  const result = await provider.sendVerificationCode(phone, code);

  if (!result.success) {
    // Clean up the stored code if SMS failed
    await valkey.del(codeKey);
    logger.error('Failed to send verification SMS', { error: result.error });
    return { success: false, error: 'Failed to send verification code' };
  }

  logger.info('Verification code sent', { phoneHash: hashed.slice(0, 8) });
  return { success: true };
}

/**
 * Verify a code submitted by the user.
 * One-time use — code is deleted on success.
 * Max 3 attempts before lockout.
 */
export async function verifyCode(
  phone: string,
  code: string
): Promise<VerifyResult> {
  const hashed = hashPhone(phone);
  const codeKey = `sms:verify:${hashed}`;
  const attemptKey = `sms:attempts:${hashed}`;
  const valkey = getValkeyClient();

  // Check lockout
  const attempts = await valkey.get(attemptKey);
  if (attempts && parseInt(attempts, 10) >= MAX_ATTEMPTS) {
    return { success: false, error: 'Too many attempts. Please wait 5 minutes.' };
  }

  // Get stored code
  const storedCode = await valkey.get(codeKey);
  if (!storedCode) {
    return { success: false, error: 'Code expired or not found' };
  }

  // Check code
  if (storedCode !== code) {
    // Increment attempt counter with lockout TTL
    await valkey.incr(attemptKey);
    await valkey.expire(attemptKey, LOCKOUT_TTL_SECONDS);

    const newAttempts = parseInt(await valkey.get(attemptKey) ?? '0', 10);
    const remaining = MAX_ATTEMPTS - newAttempts;

    if (remaining <= 0) {
      await valkey.del(codeKey); // Delete code on lockout
      return { success: false, error: 'Too many attempts. Please request a new code.' };
    }

    return {
      success: false,
      error: `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    };
  }

  // Success — delete code (one-time use) and clear attempts
  await valkey.del(codeKey);
  await valkey.del(attemptKey);

  logger.info('Verification code verified', { phoneHash: hashed.slice(0, 8) });
  return { success: true };
}
