'use server';

/**
 * Admin Custom Role Assignment Actions (A4.1)
 * deleteCustomRoleAction, assignCustomRoleAction, revokeCustomRoleAction
 * Split from admin-custom-roles.ts to keep files under 300 lines.
 */

import { db } from '@twicely/db';
import { customRole, staffUserCustomRole, auditEvent, staffUser } from '@twicely/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import {
  deleteCustomRoleSchema,
  assignCustomRoleSchema,
  revokeCustomRoleSchema,
} from './admin-custom-role-schemas';
import { requireMfaForCriticalAction } from './staff-mfa';

// ─── deleteCustomRoleAction ───────────────────────────────────────────────────

export async function deleteCustomRoleAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'CustomRole')) {
    return { error: 'Forbidden' };
  }
  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    return { error: 'Forbidden' };
  }

  const mfaCheck = await requireMfaForCriticalAction(session.staffUserId);
  if (mfaCheck) return mfaCheck;

  const parsed = deleteCustomRoleSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { customRoleId } = parsed.data;

  const [existing] = await db
    .select({ id: customRole.id, name: customRole.name, code: customRole.code })
    .from(customRole)
    .where(eq(customRole.id, customRoleId))
    .limit(1);

  if (!existing) return { error: 'Custom role not found' };

  // Auto-revoke all active assignments
  const activeAssignments = await db
    .select({ id: staffUserCustomRole.id })
    .from(staffUserCustomRole)
    .where(
      and(
        eq(staffUserCustomRole.customRoleId, customRoleId),
        isNull(staffUserCustomRole.revokedAt)
      )
    );

  const affectedStaffCount = activeAssignments.length;

  if (affectedStaffCount > 0) {
    await db
      .update(staffUserCustomRole)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(staffUserCustomRole.customRoleId, customRoleId),
          isNull(staffUserCustomRole.revokedAt)
        )
      );
  }

  // Soft-delete the role
  await db
    .update(customRole)
    .set({ isActive: false, updatedAt: new Date(), updatedByStaffId: session.staffUserId })
    .where(eq(customRole.id, customRoleId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'DELETE_CUSTOM_ROLE',
    subject: 'CustomRole',
    subjectId: customRoleId,
    severity: 'CRITICAL',
    detailsJson: {
      roleName: existing.name,
      roleCode: existing.code,
      affectedStaffCount,
    },
  });

  revalidatePath('/roles');
  return { success: true };
}

// ─── assignCustomRoleAction ───────────────────────────────────────────────────

export async function assignCustomRoleAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'CustomRole')) {
    return { error: 'Forbidden' };
  }
  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    return { error: 'Forbidden' };
  }

  const mfaCheck = await requireMfaForCriticalAction(session.staffUserId);
  if (mfaCheck) return mfaCheck;

  const parsed = assignCustomRoleSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { staffUserId, customRoleId } = parsed.data;

  // Verify custom role exists and is active
  const [role] = await db
    .select({ id: customRole.id, name: customRole.name, isActive: customRole.isActive })
    .from(customRole)
    .where(eq(customRole.id, customRoleId))
    .limit(1);

  if (!role || !role.isActive) return { error: 'Custom role not found' };

  // Verify staff user exists and is active
  const [targetStaff] = await db
    .select({ id: staffUser.id, isActive: staffUser.isActive })
    .from(staffUser)
    .where(eq(staffUser.id, staffUserId))
    .limit(1);

  if (!targetStaff || !targetStaff.isActive) return { error: 'Staff user not found' };

  // Check for duplicate active assignment
  const [existing] = await db
    .select({ id: staffUserCustomRole.id })
    .from(staffUserCustomRole)
    .where(
      and(
        eq(staffUserCustomRole.staffUserId, staffUserId),
        eq(staffUserCustomRole.customRoleId, customRoleId),
        isNull(staffUserCustomRole.revokedAt)
      )
    )
    .limit(1);

  if (existing) return { error: 'Role already assigned' };

  await db.insert(staffUserCustomRole).values({
    staffUserId,
    customRoleId,
    grantedByStaffId: session.staffUserId,
  });

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'ASSIGN_CUSTOM_ROLE',
    subject: 'StaffUser',
    subjectId: staffUserId,
    severity: 'CRITICAL',
    detailsJson: {
      customRoleId,
      customRoleName: role.name,
      grantedBy: session.staffUserId,
    },
  });

  revalidatePath('/roles/staff/' + staffUserId);
  revalidatePath('/roles/custom/' + customRoleId);
  return { success: true };
}

// ─── revokeCustomRoleAction ───────────────────────────────────────────────────

export async function revokeCustomRoleAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'CustomRole')) {
    return { error: 'Forbidden' };
  }
  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    return { error: 'Forbidden' };
  }

  const mfaCheck = await requireMfaForCriticalAction(session.staffUserId);
  if (mfaCheck) return mfaCheck;

  const parsed = revokeCustomRoleSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { staffUserId, customRoleId } = parsed.data;

  // Find the active assignment
  const [assignment] = await db
    .select({ id: staffUserCustomRole.id, customRoleName: customRole.name })
    .from(staffUserCustomRole)
    .innerJoin(customRole, eq(staffUserCustomRole.customRoleId, customRole.id))
    .where(
      and(
        eq(staffUserCustomRole.staffUserId, staffUserId),
        eq(staffUserCustomRole.customRoleId, customRoleId),
        isNull(staffUserCustomRole.revokedAt)
      )
    )
    .limit(1);

  if (!assignment) return { error: 'Role not currently assigned' };

  await db
    .update(staffUserCustomRole)
    .set({ revokedAt: new Date() })
    .where(eq(staffUserCustomRole.id, assignment.id));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'REVOKE_CUSTOM_ROLE',
    subject: 'StaffUser',
    subjectId: staffUserId,
    severity: 'CRITICAL',
    detailsJson: {
      customRoleId,
      customRoleName: assignment.customRoleName,
      revokedBy: session.staffUserId,
    },
  });

  revalidatePath('/roles/staff/' + staffUserId);
  revalidatePath('/roles/custom/' + customRoleId);
  return { success: true };
}
