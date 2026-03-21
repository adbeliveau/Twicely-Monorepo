/**
 * Local Fraud Queries (G2.15)
 *
 * Read-only queries for the /mod/fraud hub page and staff review flows.
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A12
 */

import { db } from '@twicely/db';
import {
  localFraudFlag,
  localTransaction,
  listing,
  user,
} from '@twicely/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocalFraudFlagRow = typeof localFraudFlag.$inferSelect;

export type FraudFlagStatus = 'OPEN' | 'CONFIRMED' | 'DISMISSED';

export interface LocalFraudFlagSummary {
  id: string;
  sellerId: string;
  sellerName: string | null;
  listingId: string;
  listingTitle: string | null;
  localTransactionId: string;
  localTransactionStatus: string | null;
  trigger: string;
  severity: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface GetLocalFraudFlagsResult {
  flags: LocalFraudFlagSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ─── getLocalFraudFlags ───────────────────────────────────────────────────────

/**
 * Paginated fraud flag list for the /mod/fraud hub page.
 * Joins with user (seller name), listing (title), localTransaction (status).
 */
export async function getLocalFraudFlags(
  page: number,
  pageSize: number,
  statusFilter?: FraudFlagStatus,
): Promise<GetLocalFraudFlagsResult> {
  const offset = (page - 1) * pageSize;

  const conditions = statusFilter
    ? and(eq(localFraudFlag.status, statusFilter))
    : undefined;

  const [totalRow] = await db
    .select({ total: count() })
    .from(localFraudFlag)
    .where(conditions);

  const rows = await db
    .select({
      id: localFraudFlag.id,
      sellerId: localFraudFlag.sellerId,
      sellerName: user.name,
      listingId: localFraudFlag.listingId,
      listingTitle: listing.title,
      localTransactionId: localFraudFlag.localTransactionId,
      localTransactionStatus: localTransaction.status,
      trigger: localFraudFlag.trigger,
      severity: localFraudFlag.severity,
      status: localFraudFlag.status,
      createdAt: localFraudFlag.createdAt,
      resolvedAt: localFraudFlag.resolvedAt,
    })
    .from(localFraudFlag)
    .leftJoin(user, eq(user.id, localFraudFlag.sellerId))
    .leftJoin(listing, eq(listing.id, localFraudFlag.listingId))
    .leftJoin(localTransaction, eq(localTransaction.id, localFraudFlag.localTransactionId))
    .where(conditions)
    .orderBy(desc(localFraudFlag.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    flags: rows,
    totalCount: Number(totalRow?.total ?? 0),
    page,
    pageSize,
  };
}

// ─── getLocalFraudFlagById ────────────────────────────────────────────────────

/**
 * Returns a single fraud flag with full details for staff review.
 */
export async function getLocalFraudFlagById(
  flagId: string,
): Promise<LocalFraudFlagRow | null> {
  const [row] = await db
    .select()
    .from(localFraudFlag)
    .where(eq(localFraudFlag.id, flagId))
    .limit(1);

  return row ?? null;
}

// ─── getSellerFraudHistory ────────────────────────────────────────────────────

/**
 * Returns all fraud flags for a given seller.
 * Used in the resolve flow to check if this is a repeat offense.
 */
export async function getSellerFraudHistory(
  sellerId: string,
): Promise<LocalFraudFlagRow[]> {
  return db
    .select()
    .from(localFraudFlag)
    .where(eq(localFraudFlag.sellerId, sellerId))
    .orderBy(desc(localFraudFlag.createdAt));
}
