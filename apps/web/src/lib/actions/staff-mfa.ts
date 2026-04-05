'use server';

/**
 * Shared MFA re-verification check for CRITICAL staff operations.
 * Actors Canonical §1.3 + §6.1
 */

import { db } from '@twicely/db';
import { staffUser, staffSession } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { STAFF_TOKEN_COOKIE } from '@twicely/casl/staff-authorize';
import { cookies } from 'next/headers';

/**
 * Enforce MFA re-verification for CRITICAL operations.
 * Only enforced when the acting staff user has mfaEnabled === true.
 * Returns null if OK, or an error response if MFA is required but not verified.
 */
export async function requireMfaForCriticalAction(
  actingStaffUserId: string,
): Promise<{ error: string; requiresMfa: true } | null> {
  const [actor] = await db
    .select({ mfaEnabled: staffUser.mfaEnabled })
    .from(staffUser)
    .where(eq(staffUser.id, actingStaffUserId))
    .limit(1);

  // SEC-031: MFA not enforced for ADMIN/SUPER_ADMIN yet. Requires DB migration to add
  // mfaRequired column + UI to force MFA setup on first admin login.
  if (!actor?.mfaEnabled) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_TOKEN_COOKIE)?.value;
  if (!token) return { error: 'MFA re-verification required', requiresMfa: true };

  const [sess] = await db
    .select({ mfaVerified: staffSession.mfaVerified })
    .from(staffSession)
    .where(eq(staffSession.token, token))
    .limit(1);

  if (!sess?.mfaVerified) {
    return { error: 'MFA re-verification required', requiresMfa: true };
  }
  return null;
}
