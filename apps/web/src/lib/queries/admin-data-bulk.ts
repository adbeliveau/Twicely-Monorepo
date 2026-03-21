/**
 * Admin Data Management — Bulk Operations Queries (I12)
 * Listing and user bulk summary/list queries for /bulk hub page.
 */

import { db } from '@twicely/db';
import { listing, user } from '@twicely/db/schema';
import { and, count, eq, ilike, inArray, or, sql } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BulkListingSummary {
  totalListings: number;
  activeListings: number;
  removedListings: number;
  draftListings: number;
}

export interface BulkListingRow {
  id: string;
  title: string | null;
  sellerName: string;
  status: string;
  priceCents: number | null;
  createdAt: Date;
  ownerUserId: string;
}

export interface BulkUserSummary {
  totalUsers: number;
  bannedUsers: number;
  activeUsers: number;
}

export interface BulkUserRow {
  id: string;
  name: string;
  email: string;
  isSeller: boolean;
  isBanned: boolean;
  createdAt: Date;
}

// ─── Listing Queries ──────────────────────────────────────────────────────────

export async function getBulkListingSummary(): Promise<BulkListingSummary> {
  const [totals] = await db
    .select({
      totalListings: count(),
      activeListings: sql<number>`sum(case when ${listing.status} = 'ACTIVE' then 1 else 0 end)::int`,
      removedListings: sql<number>`sum(case when ${listing.status} = 'REMOVED' then 1 else 0 end)::int`,
      draftListings: sql<number>`sum(case when ${listing.status} = 'DRAFT' then 1 else 0 end)::int`,
    })
    .from(listing);

  return {
    totalListings: totals?.totalListings ?? 0,
    activeListings: totals?.activeListings ?? 0,
    removedListings: totals?.removedListings ?? 0,
    draftListings: totals?.draftListings ?? 0,
  };
}

export async function getBulkListings(opts: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}): Promise<{ listings: BulkListingRow[]; total: number }> {
  const { page, pageSize, search, status } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) conditions.push(eq(listing.status, status as 'ACTIVE' | 'PAUSED' | 'ENDED' | 'REMOVED' | 'DRAFT' | 'SOLD' | 'RESERVED'));
  if (search) {
    conditions.push(
      or(
        ilike(listing.title, `%${search}%`),
        ilike(listing.id, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      status: listing.status,
      priceCents: listing.priceCents,
      createdAt: listing.createdAt,
      ownerUserId: listing.ownerUserId,
      sellerName: user.name,
    })
    .from(listing)
    .leftJoin(user, eq(user.id, listing.ownerUserId))
    .where(whereClause)
    .limit(pageSize)
    .offset(offset);

  const [countRow] = await db
    .select({ total: count() })
    .from(listing)
    .where(whereClause);

  return {
    listings: rows.map((r) => ({
      id: r.id,
      title: r.title,
      sellerName: r.sellerName ?? 'Unknown',
      status: r.status,
      priceCents: r.priceCents,
      createdAt: r.createdAt,
      ownerUserId: r.ownerUserId,
    })),
    total: countRow?.total ?? 0,
  };
}

// ─── User Queries ─────────────────────────────────────────────────────────────

export async function getBulkUserSummary(): Promise<BulkUserSummary> {
  const [totals] = await db
    .select({
      totalUsers: count(),
      bannedUsers: sql<number>`sum(case when ${user.isBanned} = true then 1 else 0 end)::int`,
      activeUsers: sql<number>`sum(case when ${user.isBanned} = false then 1 else 0 end)::int`,
    })
    .from(user);

  return {
    totalUsers: totals?.totalUsers ?? 0,
    bannedUsers: totals?.bannedUsers ?? 0,
    activeUsers: totals?.activeUsers ?? 0,
  };
}

export async function getBulkUsers(opts: {
  page: number;
  pageSize: number;
  search?: string;
  bannedOnly?: boolean;
}): Promise<{ users: BulkUserRow[]; total: number }> {
  const { page, pageSize, search, bannedOnly } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (bannedOnly) conditions.push(eq(user.isBanned, true));
  if (search) {
    conditions.push(
      or(
        ilike(user.name, `%${search}%`),
        ilike(user.email, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      isSeller: user.isSeller,
      isBanned: user.isBanned,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(whereClause)
    .limit(pageSize)
    .offset(offset);

  const [countRow] = await db
    .select({ total: count() })
    .from(user)
    .where(whereClause);

  return {
    users: rows,
    total: countRow?.total ?? 0,
  };
}

export async function getBulkUsersByIds(ids: string[]): Promise<BulkUserRow[]> {
  if (ids.length === 0) return [];
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      isSeller: user.isSeller,
      isBanned: user.isBanned,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(inArray(user.id, ids));
}
