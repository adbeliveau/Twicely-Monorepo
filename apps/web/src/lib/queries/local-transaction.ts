import { db } from '@twicely/db';
import { localTransaction, safeMeetupLocation } from '@twicely/db/schema';
import { eq, or, and, inArray } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LocalTransactionRow = typeof localTransaction.$inferSelect;

export type LocalTransactionWithLocation = LocalTransactionRow & {
  meetupLocation: typeof safeMeetupLocation.$inferSelect | null;
};

// ─── Status groups ───────────────────────────────────────────────────────────

const ACTIVE_STATUSES = [
  'SCHEDULED',
  'SELLER_CHECKED_IN',
  'BUYER_CHECKED_IN',
  'BOTH_CHECKED_IN',
  'ADJUSTMENT_PENDING',
  'RESCHEDULE_PENDING',
] as const;

const COMPLETED_STATUSES = [
  'COMPLETED',
  'RECEIPT_CONFIRMED',
] as const;

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Get a local transaction by orderId, joined with safeMeetupLocation data.
 * Used by order detail page to show meetup info.
 */
export async function getLocalTransactionByOrderId(
  orderId: string
): Promise<LocalTransactionWithLocation | null> {
  const [row] = await db
    .select()
    .from(localTransaction)
    .leftJoin(safeMeetupLocation, eq(localTransaction.meetupLocationId, safeMeetupLocation.id))
    .where(eq(localTransaction.orderId, orderId))
    .limit(1);

  if (!row) return null;

  return {
    ...row.local_transaction,
    meetupLocation: row.safe_meetup_location ?? null,
  };
}

/**
 * Get a single local transaction by its ID.
 * Used by server actions for validation.
 */
export async function getLocalTransactionById(
  transactionId: string
): Promise<LocalTransactionRow | null> {
  const [row] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, transactionId))
    .limit(1);

  return row ?? null;
}

/**
 * Get active local transactions for a user (as buyer or seller).
 * Active = SCHEDULED, SELLER_CHECKED_IN, BUYER_CHECKED_IN, BOTH_CHECKED_IN.
 * Ordered by scheduledAt ASC (soonest first).
 */
export async function getActiveLocalTransactionsForUser(
  userId: string
): Promise<LocalTransactionRow[]> {
  return db
    .select()
    .from(localTransaction)
    .where(
      and(
        or(
          eq(localTransaction.buyerId, userId),
          eq(localTransaction.sellerId, userId)
        ),
        inArray(localTransaction.status, [...ACTIVE_STATUSES])
      )
    )
    .orderBy(localTransaction.scheduledAt);
}

/**
 * Get completed local transactions for a user (as buyer or seller).
 * Completed = COMPLETED, RECEIPT_CONFIRMED.
 * Ordered by confirmedAt DESC (most recent first).
 */
export async function getCompletedLocalTransactionsForUser(
  userId: string,
  limit: number = 20
): Promise<LocalTransactionRow[]> {
  return db
    .select()
    .from(localTransaction)
    .where(
      and(
        or(
          eq(localTransaction.buyerId, userId),
          eq(localTransaction.sellerId, userId)
        ),
        inArray(localTransaction.status, [...COMPLETED_STATUSES])
      )
    )
    .orderBy(localTransaction.confirmedAt)
    .limit(limit);
}

// ─── Claim Context (A13) ──────────────────────────────────────────────────────

export interface MeetupPhotoContext {
  hasPhotos: boolean;
  photoUrls: string[];
  photosAt: Date | null;
}

/**
 * Get meetup photo evidence context for a local transaction.
 * Used by the buyer protection claim flow to show photo context to support staff.
 */
export async function getMeetupPhotoContext(
  localTransactionId: string
): Promise<MeetupPhotoContext | null> {
  const [row] = await db
    .select({
      meetupPhotoUrls: localTransaction.meetupPhotoUrls,
      meetupPhotosAt: localTransaction.meetupPhotosAt,
    })
    .from(localTransaction)
    .where(eq(localTransaction.id, localTransactionId))
    .limit(1);

  if (!row) return null;

  return {
    hasPhotos: row.meetupPhotoUrls.length > 0,
    photoUrls: row.meetupPhotoUrls,
    photosAt: row.meetupPhotosAt ?? null,
  };
}
