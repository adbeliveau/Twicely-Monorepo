/**
 * Whatnot webhook HMAC-SHA256 signature verification.
 * Source: H2.3 install prompt §2.3; Lister Canonical §13.5 (Webhook Supplement)
 *
 * Reads secret from platform_settings (key: crosslister.whatnot.webhookSecret).
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import * as crypto from 'crypto';
import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';

/** Header name Whatnot uses to send the HMAC signature. */
export const WHATNOT_SIGNATURE_HEADER = 'X-Whatnot-Signature';

/**
 * Verify an incoming Whatnot webhook signature.
 *
 * @param rawBody - Raw request body string (read before JSON parsing).
 * @param signatureHeader - Value of the X-Whatnot-Signature header.
 * @returns { valid: true } on success, { valid: false, error: string } on failure.
 */
export async function verifyWhatnotSignature(
  rawBody: string,
  signatureHeader: string,
): Promise<{ valid: boolean; error?: string }> {
  // Load webhook secret from platform_settings
  let secret: string;
  try {
    const [row] = await db
      .select({ value: platformSetting.value })
      .from(platformSetting)
      .where(eq(platformSetting.key, 'crosslister.whatnot.webhookSecret'))
      .limit(1);

    secret = row !== undefined && row.value !== null ? String(row.value) : '';
  } catch (err) {
    logger.error('[whatnotWebhookVerify] Failed to load webhook secret from settings', {
      error: String(err),
    });
    return { valid: false, error: 'Failed to load webhook secret' };
  }

  if (!secret) {
    return { valid: false, error: 'Webhook secret not configured' };
  }

  if (!signatureHeader) {
    return { valid: false, error: 'Invalid signature' };
  }

  // Compute expected HMAC-SHA256 signature
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  // timingSafeEqual requires equal-length buffers
  const computedBuf = Buffer.from(computed);
  const providedBuf = Buffer.from(signatureHeader);

  if (computedBuf.length !== providedBuf.length) {
    return { valid: false, error: 'Invalid signature' };
  }

  const isValid = crypto.timingSafeEqual(computedBuf, providedBuf);
  return isValid ? { valid: true } : { valid: false, error: 'Invalid signature' };
}
