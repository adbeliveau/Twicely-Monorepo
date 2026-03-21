/**
 * Admin Finance Detail Queries (I3/I4)
 * Payout detail, finance overview enriched, payout KPIs
 */

import { db } from '@twicely/db';
import { ledgerEntry, payout, payoutBatch, user } from '@twicely/db/schema';
import { count, desc, eq, gte, sql, and, lte, inArray } from 'drizzle-orm';

// I4 enrichment: additional KPIs and revenue breakdown
export async function getFinanceOverviewEnriched(days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const REVENUE_TYPES = [
    'ORDER_TF_FEE',
    'ORDER_BOOST_FEE',
    'SUBSCRIPTION_CHARGE',
    'INSERTION_FEE',
    'OVERAGE_CHARGE',
  ] as const;

  const [revenueRows, stripeFees, pendingAmount, chargebackCount] = await Promise.all([
    db
      .select({
        type: ledgerEntry.type,
        total: sql<number>`COALESCE(SUM(${ledgerEntry.amountCents}), 0)`,
      })
      .from(ledgerEntry)
      .where(
        and(
          inArray(ledgerEntry.type, [...REVENUE_TYPES]),
          gte(ledgerEntry.createdAt, since)
        )
      )
      .groupBy(ledgerEntry.type),
    db
      .select({ total: sql<number>`COALESCE(SUM(ABS(${ledgerEntry.amountCents})), 0)` })
      .from(ledgerEntry)
      .where(
        and(eq(ledgerEntry.type, 'ORDER_STRIPE_PROCESSING_FEE'), gte(ledgerEntry.createdAt, since))
      ),
    db
      .select({ total: sql<number>`COALESCE(SUM(${ledgerEntry.amountCents}), 0)` })
      .from(ledgerEntry)
      .where(and(eq(ledgerEntry.status, 'PENDING'), gte(ledgerEntry.createdAt, since))),
    db
      .select({ total: count() })
      .from(ledgerEntry)
      .where(
        and(eq(ledgerEntry.type, 'CHARGEBACK_DEBIT'), gte(ledgerEntry.createdAt, since))
      ),
  ]);

  const revenueMap = Object.fromEntries(revenueRows.map((r) => [r.type, Number(r.total)]));
  const grandTotal = Object.values(revenueMap).reduce((s, v) => s + v, 0);

  const revenueBreakdown = [
    { label: 'Transaction Fees', type: 'ORDER_TF_FEE', amountCents: revenueMap['ORDER_TF_FEE'] ?? 0 },
    { label: 'Boost Fees', type: 'ORDER_BOOST_FEE', amountCents: revenueMap['ORDER_BOOST_FEE'] ?? 0 },
    { label: 'Subscription Revenue', type: 'SUBSCRIPTION_CHARGE', amountCents: revenueMap['SUBSCRIPTION_CHARGE'] ?? 0 },
    { label: 'Insertion Fees', type: 'INSERTION_FEE', amountCents: revenueMap['INSERTION_FEE'] ?? 0 },
    { label: 'Overage Packs', type: 'OVERAGE_CHARGE', amountCents: revenueMap['OVERAGE_CHARGE'] ?? 0 },
  ].map((row) => ({
    ...row,
    percentOfTotal: grandTotal > 0 ? Math.round((row.amountCents / grandTotal) * 1000) / 10 : 0,
  }));

  return {
    revenueBreakdown,
    stripeProcessingFeesCents: Number(stripeFees[0]?.total ?? 0),
    pendingReleaseCents: Number(pendingAmount[0]?.total ?? 0),
    chargebackCount30d: chargebackCount[0]?.total ?? 0,
  };
}

// I4 enrichment: payout KPIs for the payouts list page
export async function getPayoutKPIs(days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [paidOut, pendingCount, failedCount, avgResult] = await Promise.all([
    db
      .select({ total: sql<number>`COALESCE(SUM(${payout.amountCents}), 0)` })
      .from(payout)
      .where(and(eq(payout.status, 'COMPLETED'), gte(payout.createdAt, since))),
    db
      .select({ total: count() })
      .from(payout)
      .where(eq(payout.status, 'PENDING')),
    db
      .select({ total: count() })
      .from(payout)
      .where(and(eq(payout.status, 'FAILED'), gte(payout.createdAt, since))),
    db
      .select({ avg: sql<number>`COALESCE(AVG(${payout.amountCents}), 0)` })
      .from(payout)
      .where(and(eq(payout.status, 'COMPLETED'), gte(payout.createdAt, since))),
  ]);

  return {
    paidOutCents: Number(paidOut[0]?.total ?? 0),
    pendingCount: pendingCount[0]?.total ?? 0,
    failedCount: failedCount[0]?.total ?? 0,
    avgPayoutCents: Math.round(Number(avgResult[0]?.avg ?? 0)),
  };
}

// I3: payout detail with seller info, batch info, related ledger entries
export async function getPayoutDetail(id: string) {
  const [payoutRow] = await db.select().from(payout).where(eq(payout.id, id)).limit(1);
  if (!payoutRow) return null;

  const [sellerUser, batchRow, relatedEntries] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, payoutRow.userId))
      .limit(1),
    payoutRow.batchId
      ? db.select().from(payoutBatch).where(eq(payoutBatch.id, payoutRow.batchId)).limit(1)
      : Promise.resolve([]),
    (() => {
      const oneHour = 60 * 60 * 1000;
      const from = new Date(payoutRow.createdAt.getTime() - oneHour);
      const to = new Date(payoutRow.createdAt.getTime() + oneHour);
      return db
        .select()
        .from(ledgerEntry)
        .where(
          and(
            eq(ledgerEntry.userId, payoutRow.userId),
            inArray(ledgerEntry.type, ['PAYOUT_SENT', 'PAYOUT_FAILED', 'PAYOUT_REVERSED']),
            gte(ledgerEntry.createdAt, from),
            lte(ledgerEntry.createdAt, to)
          )
        )
        .orderBy(desc(ledgerEntry.createdAt));
    })(),
  ]);

  return {
    payout: payoutRow,
    seller: sellerUser[0] ?? { id: payoutRow.userId, name: 'Unknown', email: '' },
    batch: batchRow[0] ?? null,
    relatedLedgerEntries: relatedEntries,
  };
}
