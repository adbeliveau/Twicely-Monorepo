'use server';

/**
 * Admin Staff Actions (A4)
 * createStaffUser, updateStaffUser, grantSystemRole, revokeSystemRole
 * Lifecycle actions (deactivate/reactivate/resetPassword): admin-staff-lifecycle.ts
 */

import { db } from '@twicely/db';
import { staffUser, staffUserRole, staffSession, auditEvent } from '@twicely/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { staffAuthorize, STAFF_TOKEN_COOKIE } from '@twicely/casl/staff-authorize';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { hash } from 'bcryptjs';
import { createId } from '@paralleldrive/cuid2';
import {
  ELEVATED_ROLES,
  createStaffUserSchema,
  updateStaffUserSchema,
  grantSystemRoleSchema,
  revokeSystemRoleSchema,
} from './admin-staff-schemas';

/**
 * Enforce MFA re-verification for CRITICAL operations (Actors Canonical §1.3 + §6.1).
 * Only enforced when the acting staff user has mfaEnabled === true.
 * Returns null if OK, or an error response if MFA is required but not verified.
 */
async function requireMfaForCriticalAction(actingStaffUserId: string): Promise<{ error: string; requiresMfa: true } | null> {
  const [actor] = await db
    .select({ mfaEnabled: staffUser.mfaEnabled })
    .from(staffUser)
    .where(eq(staffUser.id, actingStaffUserId))
    .limit(1);

  if (!actor?.mfaEnabled) return null; // MFA not set up — passes (enforced when enabled)

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

// ─── createStaffUserAction ────────────────────────────────────────────────────

export async function createStaffUserAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'StaffUser')) {
    return { error: 'Forbidden' };
  }

  const parsed = createStaffUserSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { email, displayName, password, roles } = parsed.data;

  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    const hasElevated = roles.some((r) => (ELEVATED_ROLES as readonly string[]).includes(r));
    if (hasElevated) return { error: 'Only SUPER_ADMIN can grant ADMIN roles' };
  }

  const [existing] = await db
    .select({ id: staffUser.id })
    .from(staffUser)
    .where(eq(staffUser.email, email))
    .limit(1);
  if (existing) return { error: 'Email already in use' };

  const passwordHash = await hash(password, 10);
  const newStaffUserId = createId();

  await db.insert(staffUser).values({ id: newStaffUserId, email, displayName, passwordHash });

  for (const role of roles) {
    await db.insert(staffUserRole).values({
      staffUserId: newStaffUserId,
      role,
      grantedByStaffId: session.staffUserId,
    });
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CREATE_STAFF_USER',
    subject: 'StaffUser',
    subjectId: newStaffUserId,
    severity: 'HIGH',
    detailsJson: { email, displayName, roles },
  });

  revalidatePath('/roles');
  return { success: true, staffUserId: newStaffUserId };
}

// ─── updateStaffUserAction ────────────────────────────────────────────────────

export async function updateStaffUserAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'StaffUser')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateStaffUserSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { staffUserId, displayName, email } = parsed.data;

  const [before] = await db
    .select({ email: staffUser.email, displayName: staffUser.displayName })
    .from(staffUser)
    .where(eq(staffUser.id, staffUserId))
    .limit(1);

  if (!before) return { error: 'Staff user not found' };

  if (email && email !== before.email) {
    const [dup] = await db
      .select({ id: staffUser.id })
      .from(staffUser)
      .where(eq(staffUser.email, email))
      .limit(1);
    if (dup) return { error: 'Email already in use' };
  }

  const updates: { email?: string; displayName?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (email) updates.email = email;
  if (displayName) updates.displayName = displayName;

  await db.update(staffUser).set(updates).where(eq(staffUser.id, staffUserId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_STAFF_USER',
    subject: 'StaffUser',
    subjectId: staffUserId,
    severity: 'MEDIUM',
    detailsJson: {
      before: { email: before.email, displayName: before.displayName },
      after: { email: email ?? before.email, displayName: displayName ?? before.displayName },
    },
  });

  revalidatePath('/roles');
  revalidatePath('/roles/staff/' + staffUserId);
  return { success: true };
}

// ─── grantSystemRoleAction ────────────────────────────────────────────────────

export async function grantSystemRoleAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'StaffUser')) {
    return { error: 'Forbidden' };
  }

  const parsed = grantSystemRoleSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { staffUserId, role } = parsed.data;

  // MFA re-verification for CRITICAL operations (Actors Canonical §1.3 + §6.1)
  const mfaCheck = await requireMfaForCriticalAction(session.staffUserId);
  if (mfaCheck) return mfaCheck;

  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    if ((ELEVATED_ROLES as readonly string[]).includes(role)) {
      return { error: 'Only SUPER_ADMIN can grant this role' };
    }
  }

  if (staffUserId === session.staffUserId) return { error: 'Cannot modify own roles' };

  const [alreadyAssigned] = await db
    .select({ id: staffUserRole.id })
    .from(staffUserRole)
    .where(and(
      eq(staffUserRole.staffUserId, staffUserId),
      eq(staffUserRole.role, role),
      isNull(staffUserRole.revokedAt)
    ))
    .limit(1);
  if (alreadyAssigned) return { error: 'Role already assigned' };

  await db.insert(staffUserRole).values({ staffUserId, role, grantedByStaffId: session.staffUserId });

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'GRANT_SYSTEM_ROLE',
    subject: 'StaffUser',
    subjectId: staffUserId,
    severity: 'CRITICAL',
    detailsJson: { role, grantedBy: session.staffUserId },
  });

  revalidatePath('/roles/staff/' + staffUserId);
  return { success: true };
}

// ─── revokeSystemRoleAction ───────────────────────────────────────────────────

export async function revokeSystemRoleAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'StaffUser')) {
    return { error: 'Forbidden' };
  }

  const parsed = revokeSystemRoleSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { staffUserId, role } = parsed.data;

  // MFA re-verification for CRITICAL operations (Actors Canonical §1.3 + §6.1)
  const mfaCheck = await requireMfaForCriticalAction(session.staffUserId);
  if (mfaCheck) return mfaCheck;

  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    if ((ELEVATED_ROLES as readonly string[]).includes(role)) {
      return { error: 'Only SUPER_ADMIN can revoke this role' };
    }
  }

  if (staffUserId === session.staffUserId) return { error: 'Cannot modify own roles' };

  const [activeRole] = await db
    .select({ id: staffUserRole.id })
    .from(staffUserRole)
    .where(and(
      eq(staffUserRole.staffUserId, staffUserId),
      eq(staffUserRole.role, role),
      isNull(staffUserRole.revokedAt)
    ))
    .limit(1);
  if (!activeRole) return { error: 'Role not currently assigned' };

  await db.update(staffUserRole).set({ revokedAt: new Date() }).where(eq(staffUserRole.id, activeRole.id));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'REVOKE_SYSTEM_ROLE',
    subject: 'StaffUser',
    subjectId: staffUserId,
    severity: 'CRITICAL',
    detailsJson: { role, revokedBy: session.staffUserId },
  });

  revalidatePath('/roles/staff/' + staffUserId);
  return { success: true };
}
