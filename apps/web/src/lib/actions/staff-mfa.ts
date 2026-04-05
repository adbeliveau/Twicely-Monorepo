'use server';

/**
 * Shared MFA re-verification check for CRITICAL staff operations.
 * Actors Canonical §1.3 + §6.1
 */

import { db } from '@twicely/db';
import { staffUser, staffSession, staffUserRole } from '@twicely/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { STAFF_TOKEN_COOKIE } from '@twicely/casl/staff-authorize';
import { cookies } from 'next/headers';

/** Return type expanded for SEC-031: includes mfaSetupRequired flag */
export type MfaCheckResult = {
  error: string;
  requiresMfa: true;
  mfaSetupRequired?: boolean;
} | null;

/**
 * Enforce MFA re-verification for CRITICAL operations.
 * SEC-031: ADMIN and SUPER_ADMIN roles always require MFA, regardless of mfaRequired column.
 * Returns null if OK, or an error response if MFA is required but not verified.
 */
export async function requireMfaForCriticalAction(
  actingStaffUserId: string,
): Promise<MfaCheckResult> {
  const [actor] = await db
    .select({ mfaEnabled: staffUser.mfaEnabled, mfaRequired: staffUser.mfaRequired })
    .from(staffUser)
    .where(eq(staffUser.id, actingStaffUserId))
    .limit(1);

  if (!actor) return null;

  // SEC-031: Check active roles — ADMIN/SUPER_ADMIN always require MFA
  const activeRoles = await db
    .select({ role: staffUserRole.role })
    .from(staffUserRole)
    .where(
      and(
        eq(staffUserRole.staffUserId, actingStaffUserId),
        isNull(staffUserRole.revokedAt),
      ),
    );

  const roleNames = activeRoles.map((r) => r.role);
  const isAdminRole = roleNames.includes('ADMIN') || roleNames.includes('SUPER_ADMIN');
  const effectiveMfaRequired = actor.mfaRequired || isAdminRole;

  // If MFA not required for this user's role, skip enforcement
  if (!effectiveMfaRequired && !actor.mfaEnabled) return null;

  // If MFA is required but user hasn't set it up yet
  if (effectiveMfaRequired && !actor.mfaEnabled) {
    return {
      error: 'MFA setup required for admin operations',
      requiresMfa: true,
      mfaSetupRequired: true,
    };
  }

  // MFA is enabled — check session verification
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
