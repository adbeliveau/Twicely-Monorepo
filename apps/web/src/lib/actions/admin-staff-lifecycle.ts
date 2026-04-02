'use server';

/**
 * Admin Staff Lifecycle Actions (A4)
 * Deactivate, reactivate, reset password — all audited
 */

import { db } from '@twicely/db';
import { staffUser, staffUserRole, staffSession, auditEvent } from '@twicely/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { hash } from 'bcryptjs';
import {
  deactivateStaffSchema,
  reactivateStaffSchema,
  resetStaffPasswordSchema,
} from './admin-staff-schemas';
import { requireMfaForCriticalAction } from './staff-mfa';

// ─── deactivateStaffAction ────────────────────────────────────────────────────

export async function deactivateStaffAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'StaffUser')) {
    return { error: 'Forbidden' };
  }

  const mfaCheck = await requireMfaForCriticalAction(session.staffUserId);
  if (mfaCheck) return mfaCheck;

  const parsed = deactivateStaffSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { staffUserId, reason } = parsed.data;

  if (staffUserId === session.staffUserId) return { error: 'Cannot deactivate own account' };

  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    const targetRoles = await db
      .select({ role: staffUserRole.role })
      .from(staffUserRole)
      .where(and(eq(staffUserRole.staffUserId, staffUserId), isNull(staffUserRole.revokedAt)));

    if (targetRoles.some((r) => r.role === 'SUPER_ADMIN')) {
      return { error: 'Cannot deactivate SUPER_ADMIN' };
    }
  }

  await db.update(staffUser).set({ isActive: false }).where(eq(staffUser.id, staffUserId));
  await db.delete(staffSession).where(eq(staffSession.staffUserId, staffUserId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'DEACTIVATE_STAFF',
    subject: 'StaffUser',
    subjectId: staffUserId,
    severity: 'HIGH',
    detailsJson: { reason },
  });

  revalidatePath('/roles');
  revalidatePath('/roles/staff/' + staffUserId);
  return { success: true };
}

// ─── reactivateStaffAction ────────────────────────────────────────────────────

export async function reactivateStaffAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'StaffUser')) {
    return { error: 'Forbidden' };
  }

  const mfaCheck = await requireMfaForCriticalAction(session.staffUserId);
  if (mfaCheck) return mfaCheck;

  const parsed = reactivateStaffSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { staffUserId } = parsed.data;

  if (staffUserId === session.staffUserId) return { error: 'Cannot reactivate own account' };

  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    const targetRoles = await db
      .select({ role: staffUserRole.role })
      .from(staffUserRole)
      .where(and(eq(staffUserRole.staffUserId, staffUserId), isNull(staffUserRole.revokedAt)));

    if (targetRoles.some((r) => r.role === 'SUPER_ADMIN')) {
      return { error: 'Cannot reactivate SUPER_ADMIN' };
    }
  }

  await db.update(staffUser).set({ isActive: true }).where(eq(staffUser.id, staffUserId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'REACTIVATE_STAFF',
    subject: 'StaffUser',
    subjectId: staffUserId,
    severity: 'HIGH',
    detailsJson: {},
  });

  revalidatePath('/roles');
  revalidatePath('/roles/staff/' + staffUserId);
  return { success: true };
}

// ─── resetStaffPasswordAction ─────────────────────────────────────────────────

export async function resetStaffPasswordAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'StaffUser')) {
    return { error: 'Forbidden' };
  }

  const mfaCheck = await requireMfaForCriticalAction(session.staffUserId);
  if (mfaCheck) return mfaCheck;

  const parsed = resetStaffPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { staffUserId, newPassword } = parsed.data;

  if (staffUserId === session.staffUserId) {
    return { error: 'Cannot reset own password through this action' };
  }

  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    const targetRoles = await db
      .select({ role: staffUserRole.role })
      .from(staffUserRole)
      .where(and(eq(staffUserRole.staffUserId, staffUserId), isNull(staffUserRole.revokedAt)));

    if (targetRoles.some((r) => r.role === 'SUPER_ADMIN')) {
      return { error: 'Cannot reset SUPER_ADMIN password' };
    }
  }

  const passwordHash = await hash(newPassword, 10);
  await db.update(staffUser).set({ passwordHash }).where(eq(staffUser.id, staffUserId));
  await db.delete(staffSession).where(eq(staffSession.staffUserId, staffUserId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'RESET_STAFF_PASSWORD',
    subject: 'StaffUser',
    subjectId: staffUserId,
    severity: 'HIGH',
    detailsJson: {},
  });

  revalidatePath('/roles/staff/' + staffUserId);
  return { success: true };
}
