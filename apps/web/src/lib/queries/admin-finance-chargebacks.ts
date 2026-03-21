/**
 * Admin Chargeback Queries (I3)
 * Chargebacks are ledger entries grouped by stripeDisputeId.
 * Types: CHARGEBACK_DEBIT, CHARGEBACK_REVERSAL, CHARGEBACK_FEE
 */

import { db } from '@twicely/db';
import { ledgerEntry } from '@twicely/db/schema';
import { and, count, desc, gte, inArray, lte, sql } from 'drizzle-orm';

const CHARGEBACK_TYPES = ['CHARGEBACK_DEBIT', 'CHARGEBACK_REVERSAL', 'CHARGEBACK_FEE'] as const;

type ChargebackType = (typeof CHARGEBACK_TYPES)[number];

interface ChargebackListOpts {
  page: number;
  pageSize: number;
  status?: 'all' | 'open' | 'won';
  dateFrom?: Date;
  dateTo?: Date;
}

interface ChargebackCase {
  stripeDisputeId: string;
  userId: string | null;
  orderId: string | null;
  totalDebitCents: number;
  status: 'Won' | 'Open';
  createdAt: Date;
}

export async function getChargebackStats(days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [countResult] = await db
    .select({ total: count() })
    .from(ledgerEntry)
    .where(
      and(
        inArray(ledgerEntry.type, ['CHARGEBACK_DEBIT' as ChargebackType]),
        gte(ledgerEntry.createdAt, since)
      )
    );

  const [amountResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(ABS(${ledgerEntry.amountCents})), 0)` })
    .from(ledgerEntry)
    .where(
      and(
        inArray(ledgerEntry.type, ['CHARGEBACK_DEBIT' as ChargebackType]),
        gte(ledgerEntry.createdAt, since)
      )
    );

  const [reversalResult] = await db
    .select({ total: count() })
    .from(ledgerEntry)
    .where(
      and(
        inArray(ledgerEntry.type, ['CHARGEBACK_REVERSAL' as ChargebackType]),
        gte(ledgerEntry.createdAt, since)
      )
    );

  const totalCount = countResult?.total ?? 0;
  const totalAmount = Number(amountResult?.total ?? 0);
  const reversalCount = reversalResult?.total ?? 0;
  const avgAmount = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;
  const reversalRate = totalCount > 0 ? Math.round((reversalCount / totalCount) * 10000) / 100 : 0;

  return {
    totalCount,
    totalAmountCents: totalAmount,
    reversalRate,
    avgAmountCents: avgAmount,
  };
}

export async function getChargebackList(opts: ChargebackListOpts): Promise<{
  chargebacks: ChargebackCase[];
  total: number;
}> {
  const { page, pageSize, status, dateFrom, dateTo } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [
    inArray(ledgerEntry.type, [...CHARGEBACK_TYPES] as ChargebackType[]),
  ];
  if (dateFrom) conditions.push(gte(ledgerEntry.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(ledgerEntry.createdAt, dateTo));

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  // Fetch raw entries — group in-memory by stripeDisputeId
  const rows = await db
    .select({
      id: ledgerEntry.id,
      type: ledgerEntry.type,
      amountCents: ledgerEntry.amountCents,
      userId: ledgerEntry.userId,
      orderId: ledgerEntry.orderId,
      stripeDisputeId: ledgerEntry.stripeDisputeId,
      createdAt: ledgerEntry.createdAt,
    })
    .from(ledgerEntry)
    .where(where)
    .orderBy(desc(ledgerEntry.createdAt));

  // Group by stripeDisputeId
  const caseMap = new Map<
    string,
    { entries: typeof rows; userId: string | null; orderId: string | null; createdAt: Date }
  >();
  for (const row of rows) {
    const key = row.stripeDisputeId ?? row.id;
    const existing = caseMap.get(key);
    if (existing) {
      existing.entries.push(row);
    } else {
      caseMap.set(key, {
        entries: [row],
        userId: row.userId,
        orderId: row.orderId,
        createdAt: row.createdAt,
      });
    }
  }

  const allCases: ChargebackCase[] = Array.from(caseMap.entries()).map(
    ([disputeId, { entries, userId, orderId, createdAt }]) => {
      const hasReversal = entries.some((e) => e.type === 'CHARGEBACK_REVERSAL');
      const debitEntry = entries.find((e) => e.type === 'CHARGEBACK_DEBIT');
      const totalDebitCents = debitEntry ? Math.abs(debitEntry.amountCents) : 0;
      return {
        stripeDisputeId: disputeId,
        userId,
        orderId,
        totalDebitCents,
        status: hasReversal ? ('Won' as const) : ('Open' as const),
        createdAt,
      };
    }
  );

  // Apply status filter
  const filtered =
    status === 'won'
      ? allCases.filter((c) => c.status === 'Won')
      : status === 'open'
        ? allCases.filter((c) => c.status === 'Open')
        : allCases;

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + pageSize);

  return { chargebacks: paginated, total };
}

export async function getChargebackDetail(stripeDisputeId: string) {
  const entries = await db
    .select()
    .from(ledgerEntry)
    .where(
      and(
        sql`${ledgerEntry.stripeDisputeId} = ${stripeDisputeId}`,
        inArray(ledgerEntry.type, [...CHARGEBACK_TYPES] as ChargebackType[])
      )
    )
    .orderBy(desc(ledgerEntry.createdAt));

  if (entries.length === 0) return null;

  const hasReversal = entries.some((e) => e.type === 'CHARGEBACK_REVERSAL');
  const debitEntry = entries.find((e) => e.type === 'CHARGEBACK_DEBIT');
  const totalDebitCents = debitEntry ? Math.abs(debitEntry.amountCents) : 0;

  return {
    stripeDisputeId,
    status: hasReversal ? ('Won' as const) : ('Open' as const),
    totalDebitCents,
    userId: debitEntry?.userId ?? null,
    orderId: debitEntry?.orderId ?? null,
    entries,
  };
}
