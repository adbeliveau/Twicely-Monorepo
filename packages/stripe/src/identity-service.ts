/**
 * Stripe Identity Service — G6
 *
 * Creates and manages Stripe Identity VerificationSessions.
 * Twicely does NOT store raw ID images — only status metadata.
 * Per Feature Lock-in §45 + Actors & Security Canonical §4.2.
 */

import { stripe } from './server';
import { db } from '@twicely/db';
import { identityVerification, sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { getValkeyClient } from '@twicely/db/cache';
import type Stripe from 'stripe';

export interface VerificationSessionResult {
  sessionId: string;
  clientSecret: string;
}

export interface VerificationResultData {
  status: 'verified' | 'requires_input' | 'canceled';
  reportId?: string;
}

/**
 * Create a Stripe Identity VerificationSession for ENHANCED level.
 * Returns sessionId and clientSecret for embedding the Stripe Identity UI.
 */
export async function createVerificationSession(
  userId: string,
  _level: 'ENHANCED'
): Promise<VerificationSessionResult> {
  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    options: {
      document: {
        require_id_number: false,
        require_live_capture: true,
        require_matching_selfie: true,
      },
    },
    metadata: { userId },
  });

  if (!session.client_secret) {
    throw new Error('Stripe Identity session did not return a client secret');
  }

  return {
    sessionId: session.id,
    clientSecret: session.client_secret,
  };
}

/**
 * Poll Stripe for the result of a VerificationSession.
 * Used as a fallback when the webhook has not yet fired.
 */
export async function getVerificationSessionResult(
  sessionId: string
): Promise<VerificationResultData> {
  const session = await stripe.identity.verificationSessions.retrieve(sessionId);

  return {
    status: session.status as 'verified' | 'requires_input' | 'canceled',
    reportId: session.last_verification_report?.toString(),
  };
}

/**
 * Handle Stripe Identity webhook events.
 * Updates identityVerification table — never stores raw ID images.
 *
 * Events handled:
 * - identity.verification_session.verified
 * - identity.verification_session.requires_input
 * - identity.verification_session.canceled
 */
export async function handleVerificationWebhook(
  event: Stripe.Event
): Promise<void> {
  // N2 Security: Deduplicate webhook events via Valkey (24h TTL)
  try {
    const valkey = getValkeyClient();
    const result = await valkey.set(`stripe-webhook:${event.id}`, '1', 'EX', 86400, 'NX');
    if (result === null) {
      logger.info('[identity-webhook] Duplicate event skipped', { eventId: event.id });
      return;
    }
  } catch { /* Valkey down — fail open */ }
  const session = event.data.object as Stripe.Identity.VerificationSession;
  const stripeSessionId = session.id;

  // Find the record in our DB
  const [record] = await db
    .select()
    .from(identityVerification)
    .where(eq(identityVerification.stripeSessionId, stripeSessionId))
    .limit(1);

  if (!record) {
    logger.warn('Stripe Identity webhook: no matching identityVerification record', {
      stripeSessionId,
      eventType: event.type,
    });
    return;
  }

  if (event.type === 'identity.verification_session.verified') {
    const reportId = session.last_verification_report?.toString();

    // Read expiration from platform settings — NOT hardcoded
    const expirationMonths = await getPlatformSetting<number>(
      'kyc.enhancedExpirationMonths',
      24
    );

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + expirationMonths);

    await db
      .update(identityVerification)
      .set({
        status: 'VERIFIED',
        stripeReportId: reportId ?? null,
        verifiedAt: new Date(),
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(identityVerification.id, record.id));

    // Also set sellerProfile.verifiedAt
    await db
      .update(sellerProfile)
      .set({ verifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(sellerProfile.userId, record.userId));

    logger.info('Identity verification completed', {
      userId: record.userId,
      level: record.level,
      expiresAt,
    });
  } else if (event.type === 'identity.verification_session.requires_input') {
    const failureReason =
      session.last_error?.code ?? 'unknown';

    // Read retry window from platform settings — NOT hardcoded
    const retryDays = await getPlatformSetting<number>('kyc.failedRetryDays', 30);

    const retryAfter = new Date();
    retryAfter.setDate(retryAfter.getDate() + retryDays);

    await db
      .update(identityVerification)
      .set({
        status: 'FAILED',
        failedAt: new Date(),
        failureReason,
        retryAfter,
        updatedAt: new Date(),
      })
      .where(eq(identityVerification.id, record.id));

    logger.info('Identity verification failed', {
      userId: record.userId,
      failureReason,
      retryAfter,
    });
  } else if (event.type === 'identity.verification_session.canceled') {
    const retryDays = await getPlatformSetting<number>('kyc.failedRetryDays', 30);

    const retryAfter = new Date();
    retryAfter.setDate(retryAfter.getDate() + retryDays);

    await db
      .update(identityVerification)
      .set({
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: 'canceled',
        retryAfter,
        updatedAt: new Date(),
      })
      .where(eq(identityVerification.id, record.id));
  }
}
