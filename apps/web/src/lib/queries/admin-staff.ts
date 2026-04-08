/**
 * Admin Staff Queries (A4)
 * Staff user list, detail, and custom role queries for /roles
 */

import { db } from '@twicely/db';
import { staffUser, staffUserRole } from '@twicely/db/schema/staff';
import { customRole, staffUserCustomRole } from '@twicely/db/schema/platform';
import { eq, or, ilike, count, desc, and, isNull } from 'drizzle-orm';
import type { PlatformRole } from '@twicely/casl/types';
import { escapeLike } from '@twicely/utils/escape-like';

export interface StaffListItem {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: PlatformRole[];
}

interface StaffListResult {
  staff: StaffListItem[];
  total: number;
}

export async function getStaffList(opts: {
  page: number;
  pageSize: number;
  search?: string;
  activeOnly?: boolean;
}): Promise<StaffListResult> {
  const { page, pageSize, search, activeOnly } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (search) {
    const escaped = escapeLike(search);
    conditions.push(
      or(
        ilike(staffUser.email, `%${escaped}%`),
        ilike(staffUser.displayName, `%${escaped}%`)
      )
    );
  }
  if (activeOnly) {
    conditions.push(eq(staffUser.isActive, true));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(staffUser)
    .where(where);

  const rows = await db
    .select({
      id: staffUser.id,
      email: staffUser.email,
      displayName: staffUser.displayName,
      isActive: staffUser.isActive,
      lastLoginAt: staffUser.lastLoginAt,
      createdAt: staffUser.createdAt,
    })
    .from(staffUser)
    .where(where)
    .orderBy(desc(staffUser.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Load active roles for each staff user
  const staffIds = rows.map((r) => r.id);
  const allRoles =
    staffIds.length > 0
      ? await db
          .select({
            staffUserId: staffUserRole.staffUserId,
            role: staffUserRole.role,
          })
          .from(staffUserRole)
          .where(isNull(staffUserRole.revokedAt))
      : [];

  const rolesByStaffId = new Map<string, PlatformRole[]>();
  for (const row of allRoles) {
    if (!staffIds.includes(row.staffUserId)) continue;
    const existing = rolesByStaffId.get(row.staffUserId) ?? [];
    existing.push(row.role as PlatformRole);
    rolesByStaffId.set(row.staffUserId, existing);
  }

  return {
    staff: rows.map((r) => ({
      ...r,
      roles: rolesByStaffId.get(r.id) ?? [],
    })),
    total: totalResult?.count ?? 0,
  };
}

export interface StaffDetail {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  systemRoles: Array<{
    id: string;
    role: PlatformRole;
    grantedByStaffId: string;
    grantedAt: Date;
    revokedAt: Date | null;
  }>;
  customRoles: Array<{
    id: string;
    customRoleId: string;
    customRoleName: string;
    customRoleCode: string;
    grantedByStaffId: string;
    grantedAt: Date;
    revokedAt: Date | null;
  }>;
}

export async function getStaffById(staffUserId: string): Promise<StaffDetail | null> {
  const [row] = await db
    .select({
      id: staffUser.id,
      email: staffUser.email,
      displayName: staffUser.displayName,
      isActive: staffUser.isActive,
      mfaEnabled: staffUser.mfaEnabled,
      lastLoginAt: staffUser.lastLoginAt,
      createdAt: staffUser.createdAt,
      updatedAt: staffUser.updatedAt,
    })
    .from(staffUser)
    .where(eq(staffUser.id, staffUserId))
    .limit(1);

  if (!row) return null;

  // Run system roles and custom roles queries in parallel (independent)
  const [systemRoleRows, customRoleRows] = await Promise.all([
    db
      .select({
        id: staffUserRole.id,
        role: staffUserRole.role,
        grantedByStaffId: staffUserRole.grantedByStaffId,
        grantedAt: staffUserRole.grantedAt,
        revokedAt: staffUserRole.revokedAt,
      })
      .from(staffUserRole)
      .where(eq(staffUserRole.staffUserId, staffUserId))
      .orderBy(desc(staffUserRole.grantedAt)),
    db
      .select({
        id: staffUserCustomRole.id,
        customRoleId: staffUserCustomRole.customRoleId,
        customRoleName: customRole.name,
        customRoleCode: customRole.code,
        grantedByStaffId: staffUserCustomRole.grantedByStaffId,
        grantedAt: staffUserCustomRole.grantedAt,
        revokedAt: staffUserCustomRole.revokedAt,
      })
      .from(staffUserCustomRole)
      .innerJoin(customRole, eq(staffUserCustomRole.customRoleId, customRole.id))
      .where(eq(staffUserCustomRole.staffUserId, staffUserId))
      .orderBy(desc(staffUserCustomRole.grantedAt)),
  ]);

  return {
    ...row,
    systemRoles: systemRoleRows.map((r) => ({ ...r, role: r.role as PlatformRole })),
    customRoles: customRoleRows,
  };
}

export interface CustomRoleListItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
}

export async function getCustomRoleList(): Promise<CustomRoleListItem[]> {
  return db
    .select({
      id: customRole.id,
      name: customRole.name,
      code: customRole.code,
      description: customRole.description,
      isActive: customRole.isActive,
      createdAt: customRole.createdAt,
    })
    .from(customRole)
    .where(eq(customRole.isActive, true))
    .orderBy(customRole.name);
}

export interface CustomRoleDetail {
  id: string;
  name: string;
  code: string;
  description: string | null;
  permissionsJson: unknown;
  isActive: boolean;
  createdByStaffId: string;
  updatedByStaffId: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignedCount: number;
  assignedStaff: Array<{ id: string; email: string; displayName: string }>;
}

/**
 * Get all active staff users NOT already assigned the given custom role.
 * Used to populate the "Assign Staff" dropdown on the custom role detail page.
 */
export async function getStaffForCustomRoleAssignment(
  customRoleId: string
): Promise<Array<{ id: string; email: string; displayName: string }>> {
  const assignedRows = await db
    .select({ staffUserId: staffUserCustomRole.staffUserId })
    .from(staffUserCustomRole)
    .where(
      and(
        eq(staffUserCustomRole.customRoleId, customRoleId),
        isNull(staffUserCustomRole.revokedAt)
      )
    );

  const assignedIds = new Set(assignedRows.map((r) => r.staffUserId));

  const allActiveStaff = await db
    .select({
      id: staffUser.id,
      email: staffUser.email,
      displayName: staffUser.displayName,
    })
    .from(staffUser)
    .where(eq(staffUser.isActive, true))
    .orderBy(staffUser.displayName);

  return allActiveStaff.filter((s) => !assignedIds.has(s.id));
}

export async function getCustomRoleById(customRoleId: string): Promise<CustomRoleDetail | null> {
  const [row] = await db
    .select()
    .from(customRole)
    .where(eq(customRole.id, customRoleId))
    .limit(1);

  if (!row) return null;

  const assignedRows = await db
    .select({
      id: staffUser.id,
      email: staffUser.email,
      displayName: staffUser.displayName,
    })
    .from(staffUserCustomRole)
    .innerJoin(staffUser, eq(staffUserCustomRole.staffUserId, staffUser.id))
    .where(
      and(
        eq(staffUserCustomRole.customRoleId, customRoleId),
        isNull(staffUserCustomRole.revokedAt)
      )
    );

  return {
    ...row,
    assignedCount: assignedRows.length,
    assignedStaff: assignedRows,
  };
}
