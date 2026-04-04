'use server';

/**
 * Admin Custom Role Actions (A4.1)
 * createCustomRoleAction, updateCustomRoleAction
 * deleteCustomRoleAction, assignCustomRoleAction, revokeCustomRoleAction: admin-custom-roles-assign.ts
 */

import { db } from '@twicely/db';
import { customRole, auditEvent } from '@twicely/db/schema';
import { eq, count } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { validatePermissions } from '@/lib/casl/permission-registry';
import {
  createCustomRoleSchema,
  updateCustomRoleSchema,
} from './admin-custom-role-schemas';
import { requireMfaForCriticalAction } from './staff-mfa';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// ─── createCustomRoleAction ───────────────────────────────────────────────────

export async function createCustomRoleAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'CustomRole')) {
    return { error: 'Forbidden' };
  }
  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    return { error: 'Forbidden' };
  }

  const mfaCheck = await requireMfaForCriticalAction(session.staffUserId);
  if (mfaCheck) return mfaCheck;

  const parsed = createCustomRoleSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { name, description, permissions } = parsed.data;

  // Enforce max 20 active custom roles
  const [countResult] = await db
    .select({ count: count() })
    .from(customRole)
    .where(eq(customRole.isActive, true));
  const maxCustomRoles = await getPlatformSetting<number>('admin.customRoles.maxCount', 20);
  if ((countResult?.count ?? 0) >= maxCustomRoles) {
    return { error: `Maximum ${maxCustomRoles} custom roles allowed` };
  }

  // Auto-generate code from name
  const code = name.trim().toUpperCase().replace(/\s+/g, '_');

  // Unique name check
  const [dupName] = await db
    .select({ id: customRole.id })
    .from(customRole)
    .where(eq(customRole.name, name))
    .limit(1);
  if (dupName) return { error: 'A role with this name already exists' };

  // Unique code check
  const [dupCode] = await db
    .select({ id: customRole.id })
    .from(customRole)
    .where(eq(customRole.code, code))
    .limit(1);
  if (dupCode) return { error: 'A role with this code already exists' };

  // Validate permissions against registry
  if (permissions.length > 0) {
    const validation = validatePermissions(permissions);
    if (!validation.valid) {
      return { error: validation.errors[0] ?? 'Invalid permission' };
    }
  }

  const [newRole] = await db
    .insert(customRole)
    .values({
      name,
      code,
      description: description ?? null,
      permissionsJson: permissions,
      isActive: true,
      createdByStaffId: session.staffUserId,
    })
    .returning({ id: customRole.id });

  const newRoleId = newRole!.id;

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CREATE_CUSTOM_ROLE',
    subject: 'CustomRole',
    subjectId: newRoleId,
    severity: 'CRITICAL',
    detailsJson: { name, code, permissionCount: permissions.length },
  });

  revalidatePath('/roles');
  return { success: true, customRoleId: newRoleId };
}

// ─── updateCustomRoleAction ───────────────────────────────────────────────────

export async function updateCustomRoleAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'CustomRole')) {
    return { error: 'Forbidden' };
  }
  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    return { error: 'Forbidden' };
  }

  const mfaCheck = await requireMfaForCriticalAction(session.staffUserId);
  if (mfaCheck) return mfaCheck;

  const parsed = updateCustomRoleSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { customRoleId, name, description, permissions } = parsed.data;

  const [existing] = await db
    .select({
      id: customRole.id,
      name: customRole.name,
      code: customRole.code,
      description: customRole.description,
      permissionsJson: customRole.permissionsJson,
    })
    .from(customRole)
    .where(eq(customRole.id, customRoleId))
    .limit(1);

  if (!existing) return { error: 'Custom role not found' };

  // Check name uniqueness if changing
  if (name && name !== existing.name) {
    const [dupName] = await db
      .select({ id: customRole.id })
      .from(customRole)
      .where(eq(customRole.name, name))
      .limit(1);
    if (dupName) return { error: 'A role with this name already exists' };
  }

  // Validate permissions if provided
  if (permissions !== undefined && permissions.length > 0) {
    const validation = validatePermissions(permissions);
    if (!validation.valid) {
      return { error: validation.errors[0] ?? 'Invalid permission' };
    }
  }

  const updates: Record<string, unknown> = {
    updatedByStaffId: session.staffUserId,
    updatedAt: new Date(),
  };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (permissions !== undefined) updates.permissionsJson = permissions;

  await db.update(customRole).set(updates).where(eq(customRole.id, customRoleId));

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  if (name !== undefined && name !== existing.name) {
    before.name = existing.name;
    after.name = name;
  }
  if (description !== undefined) {
    before.description = existing.description;
    after.description = description;
  }
  if (permissions !== undefined) {
    after.permissionCount = permissions.length;
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_CUSTOM_ROLE',
    subject: 'CustomRole',
    subjectId: customRoleId,
    severity: 'CRITICAL',
    detailsJson: { before, after },
  });

  revalidatePath('/roles');
  revalidatePath('/roles/custom/' + customRoleId);
  return { success: true };
}
