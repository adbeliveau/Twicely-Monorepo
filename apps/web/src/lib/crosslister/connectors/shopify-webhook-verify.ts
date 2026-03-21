/**
 * Shopify webhook HMAC-SHA256 signature verification.
 * Source: H3.4 install prompt §2.3; Lister Canonical §13.5
 *
 * Key difference from Whatnot: Shopify uses Base64 encoding (not hex) and
 * reads the secret from crosslister.shopify.clientSecret (same secret used
 * for OAuth HMAC in the callback route).
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import * as crypto from 'crypto';
import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';

/** Header name Shopify uses to send the HMAC signature. */
export const SHOPIFY_SIGNATURE_HEADER = 'X-Shopify-Hmac-Sha256';

/**
 * Verify an incoming Shopify webhook signature.
 *
 * @param rawBody - Raw request body string (read before JSON parsing).
 * @param signatureHeader - Value of the X-Shopify-Hmac-Sha256 header.
 * @returns { valid: true } on success, { valid: false, error: string } on failure.
 */
export async function verifyShopifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
): Promise<{ valid: boolean; error?: string }> {
  // Load client secret from platform_settings (same secret as OAuth HMAC)
  let secret: string;
  try {
    const [row] = await db
      .select({ value: platformSetting.value })
      .from(platformSetting)
      .where(eq(platformSetting.key, 'crosslister.shopify.clientSecret'))
      .limit(1);

    secret = row !== undefined && row.value !== null ? String(row.value) : '';
  } catch (err) {
    logger.error('[shopifyWebhookVerify] Failed to load client secret from settings', {
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

  // Compute expected HMAC-SHA256 signature — Shopify uses Base64, NOT hex
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  // timingSafeEqual requires equal-length buffers
  const computedBuf = Buffer.from(computed);
  const providedBuf = Buffer.from(signatureHeader);

  if (computedBuf.length !== providedBuf.length) {
    return { valid: false, error: 'Invalid signature' };
  }

  const isValid = crypto.timingSafeEqual(computedBuf, providedBuf);
  return isValid ? { valid: true } : { valid: false, error: 'Invalid signature' };
}
