/**
 * Admin Finance Queries (E3.4 + I4)
 * Finance dashboard KPIs, ledger explorer, payout list, costs
 */

import { db } from '@twicely/db';
import { order, ledgerEntry, payout, user } from '@twicely/db/schema';
import { count, desc, eq, gte, sql, and, lte, inArray, or } from 'drizzle-orm';

// Re-export I3/I4 detail functions from their split file
export { getFinanceOverviewEnriched, getPayoutKPIs, getPayoutDetail } from './admin-finance-detail';

interface FinanceKPIs {
  gmvCents: number;
  feesCollectedCents: number;
  payoutsSentCents: number;
  takeRatePercent: number;
}

export async function getFinanceKPIs(days: number = 30): Promise<FinanceKPIs> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [gmvResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${order.totalCents}), 0)` })
    .from(order)
    .where(gte(order.createdAt, since));

  const [feesResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${ledgerEntry.amountCents}), 0)` })
    .from(ledgerEntry)
    .where(and(eq(ledgerEntry.type, 'ORDER_TF_FEE'), gte(ledgerEntry.createdAt, since)));

  const [payoutsResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${payout.amountCents}), 0)` })
    .from(payout)
    .where(and(eq(payout.status, 'COMPLETED'), gte(payout.createdAt, since)));

  const gmv = Number(gmvResult?.total ?? 0);
  const fees = Number(feesResult?.total ?? 0);
  const payouts = Number(payoutsResult?.total ?? 0);

  return {
    gmvCents: gmv,
    feesCollectedCents: fees,
    payoutsSentCents: payouts,
    takeRatePercent: gmv > 0 ? Math.round((fees / gmv) * 10000) / 100 : 0,
  };
}

export async function getLedgerEntries(opts: {
  page: number;
  pageSize: number;
  type?: string;
  userId?: string;
  status?: string;
  orderId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const { page, pageSize, type, userId, status, orderId, dateFrom, dateTo } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (type) conditions.push(eq(ledgerEntry.type, type as typeof ledgerEntry.type.enumValues[number]));
  if (userId) {
    conditions.push(
      or(
        eq(ledgerEntry.userId, userId),
        sql`${ledgerEntry.userId} IN (SELECT id FROM "user" WHERE email ILIKE ${`%${userId}%`})`
      )
    );
  }
  if (status) conditions.push(eq(ledgerEntry.status, status as typeof ledgerEntry.status.enumValues[number]));
  if (orderId) conditions.push(eq(ledgerEntry.orderId, orderId));
  if (dateFrom) conditions.push(gte(ledgerEntry.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(ledgerEntry.createdAt, dateTo));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(ledgerEntry).where(where);

  const rows = await db
    .select()
    .from(ledgerEntry)
    .where(where)
    .orderBy(desc(ledgerEntry.createdAt))
    .limit(pageSize)
    .offset(offset);

  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
  const users =
    userIds.length > 0
      ? await db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(inArray(user.id, userIds))
      : [];
  const userMap = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]));

  const enrichedRows = rows.map((r) => ({
    ...r,
    userName: r.userId ? (userMap.get(r.userId)?.name ?? null) : null,
    userEmail: r.userId ? (userMap.get(r.userId)?.email ?? null) : null,
  }));

  return { entries: enrichedRows, total: totalResult?.count ?? 0 };
}

// I4 enrichment: getPayoutList with user names + date/search filters
export async function getPayoutList(opts: {
  page: number;
  pageSize: number;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}) {
  const { page, pageSize, status, dateFrom, dateTo, search } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) conditions.push(eq(payout.status, status as typeof payout.status.enumValues[number]));
  if (dateFrom) conditions.push(gte(payout.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(payout.createdAt, dateTo));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(payout).where(where);

  let rows = await db
    .select()
    .from(payout)
    .where(where)
    .orderBy(desc(payout.createdAt))
    .limit(search ? 1000 : pageSize)
    .offset(search ? 0 : offset);

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users =
    userIds.length > 0
      ? await db
          .select({ id: user.id, name: user.name, email: user.email })
          .from(user)
          .where(inArray(user.id, userIds))
      : [];
  const userMap = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]));

  let enriched = rows.map((r) => ({
    ...r,
    userName: userMap.get(r.userId)?.name ?? null,
    userEmail: userMap.get(r.userId)?.email ?? null,
  }));

  if (search) {
    const q = search.toLowerCase();
    enriched = enriched.filter(
      (r) =>
        (r.userName?.toLowerCase().includes(q) ?? false) ||
        (r.userEmail?.toLowerCase().includes(q) ?? false)
    );
    const total = enriched.length;
    return { payouts: enriched.slice(offset, offset + pageSize), total };
  }

  return { payouts: enriched, total: totalResult?.count ?? 0 };
}

export async function getManualAdjustments(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const where = sql`${ledgerEntry.type} IN ('MANUAL_CREDIT', 'MANUAL_DEBIT')`;

  const [totalResult] = await db.select({ count: count() }).from(ledgerEntry).where(where);

  const rows = await db
    .select()
    .from(ledgerEntry)
    .where(where)
    .orderBy(desc(ledgerEntry.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { adjustments: rows, total: totalResult?.count ?? 0 };
}

export async function getPlatformCosts(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const where = eq(ledgerEntry.type, 'PLATFORM_ABSORBED_COST');

  const [totalResult] = await db.select({ count: count() }).from(ledgerEntry).where(where);
  const [sumResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${ledgerEntry.amountCents}), 0)` })
    .from(ledgerEntry)
    .where(where);

  const rows = await db
    .select()
    .from(ledgerEntry)
    .where(where)
    .orderBy(desc(ledgerEntry.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    costs: rows,
    total: totalResult?.count ?? 0,
    totalCostsCents: Number(sumResult?.total ?? 0),
  };
}
