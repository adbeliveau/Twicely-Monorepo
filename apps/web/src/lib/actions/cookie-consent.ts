'use server';

/**
 * Cookie Consent Server Action — G8.3
 *
 * Persists authenticated users' cookie consent preferences to the user record.
 * Per Feature Lock-in section 37 (EU/EEA cookie consent).
 *
 * Strictly Necessary cookies are always on and cannot be toggled.
 * Functional and Analytics categories are optional (opt-in).
 */

import { z } from 'zod';
import { db } from '@twicely/db';
import { user as userTable, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';
import { cookies } from 'next/headers';
import { notify } from '@twicely/notifications/service';

const CONSENT_VERSION = 1;

const UpdateCookieConsentSchema = z.object({
  functional: z.boolean(),
  analytics: z.boolean(),
}).strict();

export type CookieConsentInput = z.infer<typeof UpdateCookieConsentSchema>;

export interface CookieConsentResult {
  success: boolean;
  error?: string;
}

/**
 * Persist cookie consent preferences for the authenticated user.
 * Creates a LOW severity audit event on change.
 *
 * Guests must store consent in the `twicely_consent` cookie on the client.
 * This action only handles authenticated users.
 */
export async function updateCookieConsent(
  input: CookieConsentInput
): Promise<CookieConsentResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!ability.can('update', sub('User', { id: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = UpdateCookieConsentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { functional, analytics } = parsed.data;

  const consentEnabled = await getPlatformSetting<boolean>(
    'gdpr.cookieConsentRequired',
    true
  );

  if (!consentEnabled) {
    return { success: true };
  }

  const consentJson = {
    functional,
    analytics,
    updatedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };

  await db
    .update(userTable)
    .set({
      cookieConsentJson: consentJson,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, session.userId));

  // LOW severity audit event for consent change
  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'COOKIE_CONSENT_UPDATED',
    subject: 'User',
    subjectId: session.userId,
    severity: 'LOW',
    detailsJson: {
      functional,
      analytics,
      version: CONSENT_VERSION,
    },
  });

  await notify(session.userId, 'privacy.consent_changed', {});

  logger.info('[cookieConsent] Consent updated', {
    userId: session.userId,
    functional,
    analytics,
  });

  return { success: true };
}

/**
 * Get cookie consent preferences for the authenticated user.
 * Returns null if user has no stored preferences.
 */
export async function getCookieConsent(): Promise<{
  functional: boolean;
  analytics: boolean;
} | null> {
  const { session } = await authorize();
  if (!session) return null;

  const [userData] = await db
    .select({ cookieConsentJson: userTable.cookieConsentJson })
    .from(userTable)
    .where(eq(userTable.id, session.userId))
    .limit(1);

  if (!userData?.cookieConsentJson) return null;

  const consent = userData.cookieConsentJson as {
    functional?: boolean;
    analytics?: boolean;
  };

  return {
    functional: consent.functional ?? false,
    analytics: consent.analytics ?? false,
  };
}

const GuestConsentCookieSchema = z.object({
  functional: z.boolean(),
  analytics: z.boolean(),
}).strict();

const GUEST_CONSENT_COOKIE = 'twicely_consent';

/**
 * Merge guest-session cookie consent into the authenticated user's record.
 * Called after successful login/signup when the user has no stored consent.
 * No-op if the user already has cookieConsentJson or the cookie is absent/invalid.
 */
export async function mergeGuestCookieConsent(): Promise<void> {
  const { session, ability } = await authorize();
  if (!session) return;
  if (!ability.can('update', sub('User', { id: session.userId }))) return;

  const cookieStore = await cookies();
  const raw = cookieStore.get(GUEST_CONSENT_COOKIE)?.value;
  if (!raw) return;

  let parsed: z.infer<typeof GuestConsentCookieSchema>;
  try {
    const json = JSON.parse(raw) as unknown;
    const result = GuestConsentCookieSchema.safeParse(json);
    if (!result.success) return;
    parsed = result.data;
  } catch {
    return;
  }

  const [userData] = await db
    .select({ cookieConsentJson: userTable.cookieConsentJson })
    .from(userTable)
    .where(eq(userTable.id, session.userId))
    .limit(1);

  if (userData?.cookieConsentJson) return; // already has consent stored

  const consentJson = {
    functional: parsed.functional,
    analytics: parsed.analytics,
    updatedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };

  await db
    .update(userTable)
    .set({ cookieConsentJson: consentJson, updatedAt: new Date() })
    .where(eq(userTable.id, session.userId));

  logger.info('[cookieConsent] Guest consent merged on login', { userId: session.userId });
}
