/**
 * Admin Reserve Hold Queries (I3)
 * Holds are ledger entries with types RESERVE_HOLD / RESERVE_RELEASE.
 * A RESERVE_HOLD is "active" when no RESERVE_RELEASE has reversalOfEntryId = hold.id.
 */

import { db } from '@twicely/db';
import { ledgerEntry } from '@twicely/db/schema';
import { and, count, desc, eq, gte, or, sql } from 'drizzle-orm';

type HoldStatus = 'active' | 'released' | 'all';

interface HoldListOpts {
  status?: HoldStatus;
  page: number;
  pageSize: number;
}

export async function getHoldStats() {
  // Active holds: RESERVE_HOLD entries with no matching RESERVE_RELEASE
  const allHolds = await db
    .select({
      id: ledgerEntry.id,
      amountCents: ledgerEntry.amountCents,
    })
    .from(ledgerEntry)
    .where(eq(ledgerEntry.type, 'RESERVE_HOLD'));

  const releaseRows = await db
    .select({ reversalOfEntryId: ledgerEntry.reversalOfEntryId })
    .from(ledgerEntry)
    .where(
      and(eq(ledgerEntry.type, 'RESERVE_RELEASE'), sql`${ledgerEntry.reversalOfEntryId} IS NOT NULL`)
    );

  const releasedIds = new Set(releaseRows.map((r) => r.reversalOfEntryId).filter(Boolean));
  const activeHolds = allHolds.filter((h) => !releasedIds.has(h.id));

  const totalHeldCents = activeHolds.reduce((sum, h) => sum + Math.abs(h.amountCents), 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [releasedCount] = await db
    .select({ total: count() })
    .from(ledgerEntry)
    .where(and(eq(ledgerEntry.type, 'RESERVE_RELEASE'), gte(ledgerEntry.createdAt, thirtyDaysAgo)));

  return {
    activeCount: activeHolds.length,
    totalHeldCents,
    released30dCount: releasedCount?.total ?? 0,
  };
}

export async function getHoldList(opts: HoldListOpts) {
  const { status = 'all', page, pageSize } = opts;
  const offset = (page - 1) * pageSize;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (status === 'released') {
    const [totalResult] = await db
      .select({ total: count() })
      .from(ledgerEntry)
      .where(and(eq(ledgerEntry.type, 'RESERVE_RELEASE'), gte(ledgerEntry.createdAt, thirtyDaysAgo)));

    const rows = await db
      .select()
      .from(ledgerEntry)
      .where(and(eq(ledgerEntry.type, 'RESERVE_RELEASE'), gte(ledgerEntry.createdAt, thirtyDaysAgo)))
      .orderBy(desc(ledgerEntry.createdAt))
      .limit(pageSize)
      .offset(offset);

    return { holds: rows, total: totalResult?.total ?? 0, type: 'released' as const };
  }

  if (status === 'active') {
    // Get all RESERVE_HOLD entries
    const allHolds = await db
      .select()
      .from(ledgerEntry)
      .where(eq(ledgerEntry.type, 'RESERVE_HOLD'))
      .orderBy(desc(ledgerEntry.createdAt));

    // Get all release reversal IDs
    const releaseRows = await db
      .select({ reversalOfEntryId: ledgerEntry.reversalOfEntryId })
      .from(ledgerEntry)
      .where(
        and(eq(ledgerEntry.type, 'RESERVE_RELEASE'), sql`${ledgerEntry.reversalOfEntryId} IS NOT NULL`)
      );

    const releasedIds = new Set(releaseRows.map((r) => r.reversalOfEntryId).filter(Boolean));
    const activeHolds = allHolds.filter((h) => !releasedIds.has(h.id));
    const total = activeHolds.length;
    const paginated = activeHolds.slice(offset, offset + pageSize);

    return { holds: paginated, total, type: 'active' as const };
  }

  // All: return RESERVE_HOLD and RESERVE_RELEASE entries
  const conditions = or(eq(ledgerEntry.type, 'RESERVE_HOLD'), eq(ledgerEntry.type, 'RESERVE_RELEASE'));

  const [totalResult] = await db.select({ total: count() }).from(ledgerEntry).where(conditions);

  const rows = await db
    .select()
    .from(ledgerEntry)
    .where(conditions)
    .orderBy(desc(ledgerEntry.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { holds: rows, total: totalResult?.total ?? 0, type: 'all' as const };
}
