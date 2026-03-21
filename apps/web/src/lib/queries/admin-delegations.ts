/**
 * Admin Delegation Queries (I14)
 * Platform-wide delegation oversight — distinct from /my/selling/staff seller-scoped queries.
 */

import { db } from '@twicely/db';
import { delegatedAccess, sellerProfile, user } from '@twicely/db/schema';
import { eq, count, inArray, like, or, and } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DelegationKPIs = {
  totalActive: number;
  totalPending: number;
  totalRevoked: number;
  sellersWithStaff: number;
};

export type AdminDelegationRow = {
  id: string;
  staffUserId: string;
  staffName: string;
  staffEmail: string;
  sellerId: string;
  sellerUserId: string;
  sellerName: string;
  scopes: string[];
  status: string;
  invitedAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export type AdminDelegationFilter = {
  status?: 'ACTIVE' | 'REVOKED' | 'PENDING' | 'EXPIRED';
  search?: string;
  limit?: number;
  offset?: number;
};

// ─── Query 1: getAdminDelegationKPIs ─────────────────────────────────────────

/**
 * Returns aggregate KPI counts for the delegated access platform-wide view.
 */
export async function getAdminDelegationKPIs(): Promise<DelegationKPIs> {
  const [activeCnt, pendingCnt, revokedCnt, sellersCnt] = await Promise.all([
    db
      .select({ c: count() })
      .from(delegatedAccess)
      .where(eq(delegatedAccess.status, 'ACTIVE')),
    db
      .select({ c: count() })
      .from(delegatedAccess)
      .where(eq(delegatedAccess.status, 'PENDING')),
    db
      .select({ c: count() })
      .from(delegatedAccess)
      .where(eq(delegatedAccess.status, 'REVOKED')),
    db
      .select({ c: count() })
      .from(delegatedAccess)
      .where(inArray(delegatedAccess.status, ['ACTIVE', 'PENDING'])),
  ]);

  return {
    totalActive: activeCnt[0]?.c ?? 0,
    totalPending: pendingCnt[0]?.c ?? 0,
    totalRevoked: revokedCnt[0]?.c ?? 0,
    sellersWithStaff: sellersCnt[0]?.c ?? 0,
  };
}

// ─── Query 2: getAdminDelegations ─────────────────────────────────────────────

/**
 * Returns platform-wide delegations with staff + seller info joined.
 * Supports optional status filter, search, pagination.
 */
export async function getAdminDelegations(
  filter: AdminDelegationFilter
): Promise<{ rows: AdminDelegationRow[]; total: number }> {
  const { status, search, limit = 50, offset = 0 } = filter;

  // Build where conditions
  const conditions: ReturnType<typeof eq>[] = [];
  if (status) {
    conditions.push(eq(delegatedAccess.status, status));
  }

  const staffUser = user;

  const baseQuery = db
    .select({
      id: delegatedAccess.id,
      staffUserId: delegatedAccess.userId,
      staffName: staffUser.name,
      staffEmail: delegatedAccess.email,
      sellerId: delegatedAccess.sellerId,
      sellerUserId: sellerProfile.userId,
      scopes: delegatedAccess.scopes,
      status: delegatedAccess.status,
      invitedAt: delegatedAccess.invitedAt,
      acceptedAt: delegatedAccess.acceptedAt,
      revokedAt: delegatedAccess.revokedAt,
    })
    .from(delegatedAccess)
    .innerJoin(staffUser, eq(delegatedAccess.userId, staffUser.id))
    .innerJoin(sellerProfile, eq(delegatedAccess.sellerId, sellerProfile.id));

  let whereClause: ReturnType<typeof eq> | ReturnType<typeof and> | ReturnType<typeof or> | undefined;

  if (status && search) {
    whereClause = and(
      eq(delegatedAccess.status, status),
      or(
        like(delegatedAccess.email, `%${search}%`),
        like(staffUser.name, `%${search}%`)
      )
    );
  } else if (status) {
    whereClause = eq(delegatedAccess.status, status);
  } else if (search) {
    whereClause = or(
      like(delegatedAccess.email, `%${search}%`),
      like(staffUser.name, `%${search}%`)
    );
  }

  const rows = await (whereClause
    ? baseQuery
        .where(whereClause)
        .orderBy(delegatedAccess.invitedAt)
        .limit(limit)
        .offset(offset)
    : baseQuery
        .orderBy(delegatedAccess.invitedAt)
        .limit(limit)
        .offset(offset));

  const totalQuery = db
    .select({ c: count() })
    .from(delegatedAccess);

  const totalRows = await (whereClause
    ? totalQuery.where(whereClause)
    : totalQuery);

  const total = totalRows[0]?.c ?? 0;

  // Resolve seller names via a second join pass
  const sellerUserIds = rows.map((r) => r.sellerUserId);
  const sellerUsers = sellerUserIds.length > 0
    ? await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, sellerUserIds))
    : [];

  const sellerNameMap = new Map(sellerUsers.map((u) => [u.id, u.name]));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      staffUserId: r.staffUserId,
      staffName: r.staffName,
      staffEmail: r.staffEmail,
      sellerId: r.sellerId,
      sellerUserId: r.sellerUserId,
      sellerName: sellerNameMap.get(r.sellerUserId) ?? r.sellerUserId,
      scopes: r.scopes,
      status: r.status,
      invitedAt: r.invitedAt,
      acceptedAt: r.acceptedAt,
      revokedAt: r.revokedAt,
    })),
    total,
  };
}
