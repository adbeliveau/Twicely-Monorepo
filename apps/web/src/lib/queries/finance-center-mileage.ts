/**
 * Mileage entry queries for the Financial Center.
 */
import { db } from '@twicely/db';
import { mileageEntry } from '@twicely/db/schema';
import { eq, and, gte, lte, sql, desc, asc, count } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type { ListMileageInput } from '@/lib/validations/finance-center';

export interface MileageRow {
  id: string;
  description: string;
  miles: number;
  ratePerMile: number;
  deductionCents: number;
  tripDate: Date;
  createdAt: Date;
}

export interface MileageListResult {
  entries: MileageRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MileagePeriodSummary {
  totalMiles: number;
  totalDeductionCents: number;
  tripCount: number;
  ratePerMile: number;
}

const MILEAGE_COLUMNS = {
  id: mileageEntry.id,
  description: mileageEntry.description,
  miles: mileageEntry.miles,
  ratePerMile: mileageEntry.ratePerMile,
  deductionCents: mileageEntry.deductionCents,
  tripDate: mileageEntry.tripDate,
  createdAt: mileageEntry.createdAt,
} as const;

function buildSortColumn(
  sortBy: ListMileageInput['sortBy'],
  sortOrder: ListMileageInput['sortOrder'],
) {
  const col =
    sortBy === 'miles'
      ? mileageEntry.miles
      : sortBy === 'deductionCents'
        ? mileageEntry.deductionCents
        : sortBy === 'createdAt'
          ? mileageEntry.createdAt
          : mileageEntry.tripDate;
  return sortOrder === 'asc' ? asc(col) : desc(col);
}

export async function getMileageList(
  userId: string,
  opts: ListMileageInput,
): Promise<MileageListResult> {
  const { page, pageSize, startDate, endDate, sortBy, sortOrder } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(mileageEntry.userId, userId)];
  if (startDate) conditions.push(gte(mileageEntry.tripDate, new Date(startDate)));
  if (endDate) conditions.push(lte(mileageEntry.tripDate, new Date(endDate)));

  const where = and(...conditions);

  const [totalRow] = await db
    .select({ total: count() })
    .from(mileageEntry)
    .where(where);

  const rows = await db
    .select(MILEAGE_COLUMNS)
    .from(mileageEntry)
    .where(where)
    .orderBy(buildSortColumn(sortBy, sortOrder))
    .limit(pageSize)
    .offset(offset);

  return {
    entries: rows,
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getMileageById(
  userId: string,
  entryId: string,
): Promise<MileageRow | null> {
  const [row] = await db
    .select(MILEAGE_COLUMNS)
    .from(mileageEntry)
    .where(and(eq(mileageEntry.userId, userId), eq(mileageEntry.id, entryId)))
    .limit(1);

  return row ?? null;
}

export async function getMileagePeriodSummary(
  userId: string,
  days: number,
): Promise<MileagePeriodSummary> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [row] = await db
    .select({
      totalMiles: sql<number>`coalesce(sum(${mileageEntry.miles}), 0)`,
      totalDeductionCents: sql<number>`coalesce(sum(${mileageEntry.deductionCents}), 0)::int`,
      tripCount: sql<number>`count(*)::int`,
    })
    .from(mileageEntry)
    .where(and(eq(mileageEntry.userId, userId), gte(mileageEntry.tripDate, since)));

  const irsRate = await getPlatformSetting<number>('finance.mileageRatePerMile', 0.70);

  return {
    totalMiles: row?.totalMiles ?? 0,
    totalDeductionCents: row?.totalDeductionCents ?? 0,
    tripCount: row?.tripCount ?? 0,
    ratePerMile: irsRate,
  };
}
