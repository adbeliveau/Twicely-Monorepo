import { db } from '@twicely/db';
import { delegatedAccess, sellerProfile, user } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StaffMember = {
  id: string;
  userId: string;
  email: string;
  name: string;
  scopes: string[];
  status: 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  invitedAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export type ActiveDelegation = {
  delegationId: string;
  sellerId: string;
  scopes: string[];
  ownerUserId: string;
  ownerName: string;
};

export type DelegationRecord = {
  id: string;
  sellerId: string;
  userId: string;
  email: string;
  scopes: string[];
  status: string;
  invitedAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  expiresAt: Date | null;
};

export type PendingInvitation = {
  id: string;
  sellerId: string;
  ownerName: string;
  scopes: string[];
  invitedAt: Date;
};

// ─── Query 1: getStaffMembers ─────────────────────────────────────────────────

/**
 * Returns all delegation records for a seller with user info joined.
 * Ordered by createdAt desc. Includes all statuses.
 */
export async function getStaffMembers(sellerId: string): Promise<StaffMember[]> {
  const rows = await db
    .select({
      id: delegatedAccess.id,
      userId: delegatedAccess.userId,
      email: delegatedAccess.email,
      name: user.name,
      scopes: delegatedAccess.scopes,
      status: delegatedAccess.status,
      invitedAt: delegatedAccess.invitedAt,
      acceptedAt: delegatedAccess.acceptedAt,
      revokedAt: delegatedAccess.revokedAt,
    })
    .from(delegatedAccess)
    .innerJoin(user, eq(delegatedAccess.userId, user.id))
    .where(eq(delegatedAccess.sellerId, sellerId))
    .orderBy(delegatedAccess.createdAt);

  return rows.map((row) => ({
    ...row,
    status: row.status as StaffMember['status'],
  }));
}

// ─── Query 2: getActiveDelegation ────────────────────────────────────────────

/**
 * Returns the active delegation context for a user.
 * Called on every authenticated request inside authorize().
 * Must be fast — indexed on da_user + da_status.
 */
export async function getActiveDelegation(userId: string): Promise<ActiveDelegation | null> {
  const now = new Date();

  const rows = await db
    .select({
      delegationId: delegatedAccess.id,
      sellerId: delegatedAccess.sellerId,
      scopes: delegatedAccess.scopes,
      expiresAt: delegatedAccess.expiresAt,
      ownerUserId: sellerProfile.userId,
      ownerName: user.name,
    })
    .from(delegatedAccess)
    .innerJoin(sellerProfile, eq(delegatedAccess.sellerId, sellerProfile.id))
    .innerJoin(user, eq(sellerProfile.userId, user.id))
    .where(
      and(
        eq(delegatedAccess.userId, userId),
        eq(delegatedAccess.status, 'ACTIVE'),
      )
    )
    .orderBy(delegatedAccess.acceptedAt)
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Check expiry: if expired, update to EXPIRED and return null
  if (row.expiresAt && row.expiresAt < now) {
    await db
      .update(delegatedAccess)
      .set({ status: 'EXPIRED', updatedAt: now })
      .where(eq(delegatedAccess.id, row.delegationId));
    return null;
  }

  return {
    delegationId: row.delegationId,
    sellerId: row.sellerId,
    scopes: row.scopes,
    ownerUserId: row.ownerUserId,
    ownerName: row.ownerName,
  };
}

// ─── Query 3: getDelegationById ───────────────────────────────────────────────

/**
 * Returns a specific delegation record by ID for action verification.
 */
export async function getDelegationById(delegationId: string): Promise<DelegationRecord | null> {
  const rows = await db
    .select({
      id: delegatedAccess.id,
      sellerId: delegatedAccess.sellerId,
      userId: delegatedAccess.userId,
      email: delegatedAccess.email,
      scopes: delegatedAccess.scopes,
      status: delegatedAccess.status,
      invitedAt: delegatedAccess.invitedAt,
      acceptedAt: delegatedAccess.acceptedAt,
      revokedAt: delegatedAccess.revokedAt,
      revokedByUserId: delegatedAccess.revokedByUserId,
      expiresAt: delegatedAccess.expiresAt,
    })
    .from(delegatedAccess)
    .where(eq(delegatedAccess.id, delegationId))
    .limit(1);

  return rows[0] ?? null;
}

// ─── Query 4: getStaffCountForSeller ─────────────────────────────────────────

/**
 * Returns count of ACTIVE and PENDING delegations for a seller.
 * Used by inviteStaffMember to check staff limits.
 */
export async function getStaffCountForSeller(sellerId: string): Promise<number> {
  const rows = await db
    .select({ id: delegatedAccess.id })
    .from(delegatedAccess)
    .where(
      and(
        eq(delegatedAccess.sellerId, sellerId),
        inArray(delegatedAccess.status, ['ACTIVE', 'PENDING']),
      )
    );

  return rows.length;
}

// ─── Query 5: getPendingInvitations ──────────────────────────────────────────

/**
 * Returns pending invitations for the current user.
 * Shown in their hub when they log in.
 */
export async function getPendingInvitations(userId: string): Promise<PendingInvitation[]> {
  const rows = await db
    .select({
      id: delegatedAccess.id,
      sellerId: delegatedAccess.sellerId,
      scopes: delegatedAccess.scopes,
      invitedAt: delegatedAccess.invitedAt,
      ownerName: user.name,
    })
    .from(delegatedAccess)
    .innerJoin(sellerProfile, eq(delegatedAccess.sellerId, sellerProfile.id))
    .innerJoin(user, eq(sellerProfile.userId, user.id))
    .where(
      and(
        eq(delegatedAccess.userId, userId),
        eq(delegatedAccess.status, 'PENDING'),
      )
    )
    .orderBy(delegatedAccess.invitedAt);

  return rows;
}
