import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStaffSession } from '@twicely/auth/staff-auth';
import { defineAbilitiesFor } from '@twicely/casl/ability';
import { ForbiddenError } from '@twicely/casl/authorize';
import type { AppAbility, PlatformRole } from '@twicely/casl/types';
import { db } from '@twicely/db';
import { staffUserCustomRole, customRole } from '@twicely/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

// Cookie name for staff sessions (separate from marketplace session)
export const STAFF_TOKEN_COOKIE = 'twicely.staff_token';

export interface StaffCaslSession {
  staffUserId: string;
  email: string;
  displayName: string;
  isPlatformStaff: true;
  platformRoles: PlatformRole[];
}

/**
 * Load all active custom role permissions for a staff user.
 * Joins staffUserCustomRole -> customRole to get permissionsJson for each active assignment.
 */
async function loadCustomRolePermissions(
  staffUserId: string
): Promise<Array<{ subject: string; action: string }>> {
  const rows = await db
    .select({ permissionsJson: customRole.permissionsJson })
    .from(staffUserCustomRole)
    .innerJoin(customRole, eq(staffUserCustomRole.customRoleId, customRole.id))
    .where(
      and(
        eq(staffUserCustomRole.staffUserId, staffUserId),
        isNull(staffUserCustomRole.revokedAt),
        eq(customRole.isActive, true)
      )
    );

  const allPermissions: Array<{ subject: string; action: string }> = [];
  for (const row of rows) {
    const perms = row.permissionsJson as Array<{ subject: string; action: string }>;
    if (Array.isArray(perms)) {
      allPermissions.push(...perms);
    }
  }
  return allPermissions;
}

/**
 * Server-side authorization helper for hub (admin) routes.
 * Reads the staff token cookie, resolves the session, and builds CASL abilities.
 * Throws ForbiddenError if no valid staff session exists.
 */
export async function staffAuthorize(): Promise<{
  ability: AppAbility;
  session: StaffCaslSession;
}> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(STAFF_TOKEN_COOKIE);

  if (!tokenCookie?.value) {
    throw new ForbiddenError('Staff authentication required');
  }

  const staffSession = await getStaffSession(tokenCookie.value);

  if (!staffSession) {
    throw new ForbiddenError('Staff session expired or invalid');
  }

  const customRolePermissions = await loadCustomRolePermissions(staffSession.staffUserId);

  const caslSession = {
    userId: staffSession.staffUserId,
    email: staffSession.email,
    isSeller: false,
    sellerId: null,
    sellerStatus: null,
    delegationId: null,
    onBehalfOfSellerId: null,
    onBehalfOfSellerProfileId: null,
    delegatedScopes: [],
    isPlatformStaff: true as const,
    platformRoles: staffSession.roles,
    customRolePermissions,
  };

  const ability = defineAbilitiesFor(caslSession);

  const session: StaffCaslSession = {
    staffUserId: staffSession.staffUserId,
    email: staffSession.email,
    displayName: staffSession.displayName,
    isPlatformStaff: true,
    platformRoles: staffSession.roles,
  };

  return { ability, session };
}

/**
 * Convenience wrapper around `staffAuthorize` that redirects to the staff
 * login page if no valid staff session is present, instead of throwing.
 * Use this in pages and layouts under (helpdesk)/(hub) so a missing or
 * expired session results in a clean redirect rather than a runtime error.
 */
export async function staffAuthorizeOrRedirect(): Promise<{
  ability: AppAbility;
  session: StaffCaslSession;
}> {
  try {
    return await staffAuthorize();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      redirect('/login');
    }
    throw err;
  }
}
