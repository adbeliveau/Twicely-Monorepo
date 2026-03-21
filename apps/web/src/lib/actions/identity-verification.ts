'use server';

/**
 * Identity Verification Server Actions — G6
 * Per Feature Lock-in §45.
 */

import { z } from 'zod';
import { db } from '@twicely/db';
import { identityVerification, user as userTable } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { createVerificationSession, getVerificationSessionResult } from '@twicely/stripe/identity-service';
import { getActiveVerification, getVerificationHistory } from '@/lib/queries/identity-verification';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { IdentityVerificationRecord } from '@/lib/queries/identity-verification';

const StartVerificationSchema = z.object({
  triggeredBy: z.enum([
    'STORE_PRO_UPGRADE',
    'PAYOUT_THRESHOLD',
    'FRAUD_FLAG',
    'CATEGORY_REQUIREMENT',
    'ADMIN_REQUEST',
    'USER_INITIATED',
  ]),
});

export interface VerificationStatusResult {
  status: 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED' | 'NONE';
  record: IdentityVerificationRecord | null;
  basicVerified: boolean;
}

/**
 * Returns the current verification status for the authenticated user.
 * BASIC is derived from emailVerified + phoneVerified (not a stored record).
 */
export async function getVerificationStatus(): Promise<VerificationStatusResult> {
  const { session } = await authorize();
  if (!session) {
    return { status: 'NOT_REQUIRED', record: null, basicVerified: false };
  }

  const { userId } = session;

  // BASIC = derived from user flags (email + phone)
  const [userRow] = await db
    .select({ emailVerified: userTable.emailVerified, phoneVerified: userTable.phoneVerified })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  const basicVerified = !!(userRow?.emailVerified && userRow?.phoneVerified);

  const active = await getActiveVerification(userId);
  if (!active) {
    return { status: 'NONE', record: null, basicVerified };
  }

  // Check expiry for VERIFIED records
  if (active.status === 'VERIFIED' && active.expiresAt) {
    const now = new Date();
    if (active.expiresAt <= now) {
      return { status: 'EXPIRED', record: active, basicVerified };
    }
  }

  return {
    status: active.status as VerificationStatusResult['status'],
    record: active,
    basicVerified,
  };
}

/**
 * Start an ENHANCED verification flow via Stripe Identity.
 * Creates an identityVerification record and returns the Stripe client secret.
 */
export async function startEnhancedVerification(
  input: z.infer<typeof StartVerificationSchema>
): Promise<{ success: boolean; clientSecret?: string; verificationId?: string; error?: string }> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('create', sub('IdentityVerification', { userId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = StartVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { userId } = session;
  const { triggeredBy } = parsed.data;

  // Block if already PENDING
  const active = await getActiveVerification(userId);
  if (active?.status === 'PENDING') {
    return { success: false, error: 'Verification already in progress' };
  }

  // Block if within retry window
  if (active?.status === 'FAILED' && active.retryAfter) {
    const now = new Date();
    if (active.retryAfter > now) {
      return {
        success: false,
        error: `Verification retry available after ${active.retryAfter.toISOString()}`,
      };
    }
  }

  // Calculate expiry from settings — NOT hardcoded
  const expirationMonths = await getPlatformSetting<number>(
    'kyc.enhancedExpirationMonths',
    24
  );
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + expirationMonths);

  // Create Stripe Identity session
  let stripeResult: { sessionId: string; clientSecret: string };
  try {
    stripeResult = await createVerificationSession(userId, 'ENHANCED');
  } catch (err) {
    logger.error('Failed to create Stripe Identity session', { userId, error: err });
    return { success: false, error: 'Failed to start verification. Please try again.' };
  }

  // Record in DB
  const inserted = await db
    .insert(identityVerification)
    .values({
      userId,
      level: 'ENHANCED',
      status: 'PENDING',
      stripeSessionId: stripeResult.sessionId,
      triggeredBy,
      lastAttemptAt: new Date(),
      expiresAt,
    })
    .returning();

  const record = inserted[0];
  if (!record) {
    return { success: false, error: 'Failed to create verification record.' };
  }

  logger.info('Enhanced verification started', {
    userId,
    verificationId: record.id,
    triggeredBy,
  });

  return {
    success: true,
    clientSecret: stripeResult.clientSecret,
    verificationId: record.id,
  };
}

/**
 * Poll verification result from Stripe (backup for webhook).
 * Only callable by the owner of the record.
 */
export async function checkVerificationResult(
  verificationId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const [record] = await db
    .select()
    .from(identityVerification)
    .where(
      and(
        eq(identityVerification.id, verificationId),
        eq(identityVerification.userId, session.userId)
      )
    )
    .limit(1);

  if (!record) return { success: false, error: 'Not found' };

  if (!ability.can('read', sub('IdentityVerification', { userId: record.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  if (!record.stripeSessionId) {
    return { success: true, status: record.status };
  }

  const result = await getVerificationSessionResult(record.stripeSessionId);
  return { success: true, status: result.status };
}

/**
 * Returns full verification history for the authenticated user.
 */
export async function getMyVerificationHistory(): Promise<IdentityVerificationRecord[]> {
  const { session } = await authorize();
  if (!session) return [];
  return getVerificationHistory(session.userId);
}
