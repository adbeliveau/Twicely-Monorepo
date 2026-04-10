import { db } from '@twicely/db';
import { sellerAppeal } from '@twicely/db/schema';
import { eq, and, count, desc, lte, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { AppealInput, AppealAction, PaginationInput, PaginatedResult } from './types';

interface AppealRow {
  id: string;
  sellerId: string;
  appealType: string;
  entityId: string | null;
  reason: string;
  status: string;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  responseNote: string | null;
  slaDeadlineAt: Date;
  createdAt: Date;
}

/**
 * Create a new seller appeal.
 * Computes SLA deadline from platform settings.
 */
export async function createAppeal(
  sellerId: string,
  input: AppealInput
): Promise<{ id: string }> {
  const slaHours = await getPlatformSetting<number>('seller.appeal.slaHours', 48);

  const slaDeadlineAt = new Date();
  slaDeadlineAt.setHours(slaDeadlineAt.getHours() + slaHours);

  const id = createId();
  await db.insert(sellerAppeal).values({
    id,
    sellerId,
    appealType: input.appealType,
    entityId: input.entityId ?? null,
    reason: input.reason,
    status: 'PENDING',
    slaDeadlineAt,
  });

  return { id };
}

/**
 * Get all appeals for a seller.
 */
export async function getAppeals(sellerId: string): Promise<AppealRow[]> {
  const rows = await db
    .select({
      id: sellerAppeal.id,
      sellerId: sellerAppeal.sellerId,
      appealType: sellerAppeal.appealType,
      entityId: sellerAppeal.entityId,
      reason: sellerAppeal.reason,
      status: sellerAppeal.status,
      reviewedByUserId: sellerAppeal.reviewedByUserId,
      reviewedAt: sellerAppeal.reviewedAt,
      responseNote: sellerAppeal.responseNote,
      slaDeadlineAt: sellerAppeal.slaDeadlineAt,
      createdAt: sellerAppeal.createdAt,
    })
    .from(sellerAppeal)
    .where(eq(sellerAppeal.sellerId, sellerId))
    .orderBy(desc(sellerAppeal.createdAt));

  return rows as unknown as AppealRow[];
}

/**
 * Get a single appeal by ID.
 */
export async function getAppeal(id: string): Promise<AppealRow | null> {
  const [row] = await db
    .select({
      id: sellerAppeal.id,
      sellerId: sellerAppeal.sellerId,
      appealType: sellerAppeal.appealType,
      entityId: sellerAppeal.entityId,
      reason: sellerAppeal.reason,
      status: sellerAppeal.status,
      reviewedByUserId: sellerAppeal.reviewedByUserId,
      reviewedAt: sellerAppeal.reviewedAt,
      responseNote: sellerAppeal.responseNote,
      slaDeadlineAt: sellerAppeal.slaDeadlineAt,
      createdAt: sellerAppeal.createdAt,
    })
    .from(sellerAppeal)
    .where(eq(sellerAppeal.id, id))
    .limit(1);

  return (row as unknown as AppealRow) ?? null;
}

/**
 * Review an appeal (approve or deny).
 */
export async function reviewAppeal(
  id: string,
  action: AppealAction,
  reviewerId: string,
  note?: string
): Promise<void> {
  await db
    .update(sellerAppeal)
    .set({
      status: action,
      reviewedByUserId: reviewerId,
      reviewedAt: new Date(),
      responseNote: note ?? null,
    })
    .where(eq(sellerAppeal.id, id));
}

/**
 * Get pending appeals with pagination (staff queue).
 */
export async function getPendingAppeals(
  pagination: PaginationInput = {}
): Promise<PaginatedResult<AppealRow>> {
  const page = pagination.page ?? 1;
  const pageSize = pagination.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [totalResult] = await db
    .select({ count: count() })
    .from(sellerAppeal)
    .where(inArray(sellerAppeal.status, ['PENDING', 'UNDER_REVIEW']));

  const items = await db
    .select({
      id: sellerAppeal.id,
      sellerId: sellerAppeal.sellerId,
      appealType: sellerAppeal.appealType,
      entityId: sellerAppeal.entityId,
      reason: sellerAppeal.reason,
      status: sellerAppeal.status,
      reviewedByUserId: sellerAppeal.reviewedByUserId,
      reviewedAt: sellerAppeal.reviewedAt,
      responseNote: sellerAppeal.responseNote,
      slaDeadlineAt: sellerAppeal.slaDeadlineAt,
      createdAt: sellerAppeal.createdAt,
    })
    .from(sellerAppeal)
    .where(inArray(sellerAppeal.status, ['PENDING', 'UNDER_REVIEW']))
    .orderBy(sellerAppeal.slaDeadlineAt)
    .limit(pageSize)
    .offset(offset);

  return {
    items: items as unknown as AppealRow[],
    total: totalResult?.count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Check for SLA breaches on pending appeals.
 * Returns the count of appeals that breached SLA.
 */
export async function checkSlaBreaches(): Promise<number> {
  const now = new Date();

  const breached = await db
    .select({ id: sellerAppeal.id })
    .from(sellerAppeal)
    .where(
      and(
        inArray(sellerAppeal.status, ['PENDING', 'UNDER_REVIEW']),
        lte(sellerAppeal.slaDeadlineAt, now)
      )
    );

  return breached.length;
}
