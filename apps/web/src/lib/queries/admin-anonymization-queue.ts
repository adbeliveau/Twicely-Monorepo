/**
 * Admin Anonymization Queue Queries (I13)
 * Queries for users pending deletion/anonymization.
 */

import { db } from '@twicely/db';
import { user } from '@twicely/db/schema';
import { isNotNull, isNull, desc, count, ilike, or, and, SQL } from 'drizzle-orm';

export type AnonymizationRow = {
  userId: string;
  email: string | null;
  name: string | null;
  deletionRequestedAt: Date;
  anonymizedAt: Date | null;
};

export interface AnonymizationQueueSummary {
  pendingDeletions: number;
  processed: number;
  total: number;
}

export async function getAnonymizationQueueSummary(): Promise<AnonymizationQueueSummary> {
  const [pendingRow, processedRow, totalRow] = await Promise.all([
    db
      .select({ c: count() })
      .from(user)
      .where(
        and(
          isNotNull(user.deletionRequestedAt),
          isNull(user.anonymizedAt)
        )
      ),
    db
      .select({ c: count() })
      .from(user)
      .where(
        and(
          isNotNull(user.deletionRequestedAt),
          isNotNull(user.anonymizedAt)
        )
      ),
    db
      .select({ c: count() })
      .from(user)
      .where(isNotNull(user.deletionRequestedAt)),
  ]);

  const total = totalRow[0]?.c ?? 0;
  const processed = processedRow[0]?.c ?? 0;
  const pendingDeletions = pendingRow[0]?.c ?? 0;

  return {
    pendingDeletions,
    processed,
    total,
  };
}

function buildQueueWhere(opts: {
  status?: string;
  search?: string;
}): SQL | undefined {
  let base: SQL | undefined = isNotNull(user.deletionRequestedAt);

  if (opts.status === 'pending') {
    base = and(
      isNotNull(user.deletionRequestedAt),
      isNull(user.anonymizedAt),
    );
  } else if (opts.status === 'processed') {
    base = and(
      isNotNull(user.deletionRequestedAt),
      isNotNull(user.anonymizedAt),
    );
  }

  if (opts.search) {
    return and(
      base,
      or(
        ilike(user.email, `%${opts.search}%`),
        ilike(user.name, `%${opts.search}%`)
      )
    );
  }

  return base;
}

export async function getAnonymizationQueueAdmin(opts: {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}): Promise<{ queue: AnonymizationRow[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, opts.pageSize ?? 25);
  const offset = (page - 1) * pageSize;

  const whereClause = buildQueueWhere({ status: opts.status, search: opts.search });

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        userId: user.id,
        email: user.email,
        name: user.name,
        deletionRequestedAt: user.deletionRequestedAt,
        anonymizedAt: user.anonymizedAt,
      })
      .from(user)
      .where(whereClause)
      .orderBy(desc(user.deletionRequestedAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ c: count() })
      .from(user)
      .where(whereClause),
  ]);

  return {
    queue: rows
      .filter((r): r is typeof r & { deletionRequestedAt: Date } =>
        r.deletionRequestedAt !== null
      )
      .map((r) => ({
        userId: r.userId,
        email: r.email,
        name: r.name,
        deletionRequestedAt: r.deletionRequestedAt,
        anonymizedAt: r.anonymizedAt,
      })),
    total: totalRows[0]?.c ?? 0,
  };
}
