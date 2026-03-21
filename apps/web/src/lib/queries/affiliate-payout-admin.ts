import { eq, desc, count, sql, and } from 'drizzle-orm';
import { db } from '@twicely/db';
import { affiliate, affiliatePayout, affiliateCommission, user } from '@twicely/db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AffiliatePayoutAdminRow {
  payoutId: string;
  affiliateId: string;
  affiliateUsername: string | null;
  affiliateEmail: string | null;
  amountCents: number;
  method: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  failedReason: string | null;
  createdAt: Date;
  completedAt: Date | null;
  externalPayoutId: string | null;
}

export interface AffiliatePayoutStats {
  totalPayoutsCents: number;
  totalPayoutsCount: number;
  pendingPayoutsCents: number;
  failedPayoutsCount: number;
  activeAffiliatesCount: number;
  totalCommissionsPendingCents: number;
}

export interface CommissionAdminRow {
  commissionId: string;
  subscriptionProduct: string;
  grossRevenueCents: number;
  netRevenueCents: number;
  commissionRateBps: number;
  commissionCents: number;
  status: string;
  holdExpiresAt: Date;
  paidAt: Date | null;
  reversedAt: Date | null;
  reversalReason: string | null;
  createdAt: Date;
}

export interface PayoutAdminRow {
  id: string;
  affiliateId: string;
  amountCents: number;
  method: string;
  externalPayoutId: string | null;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  failedReason: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

// ─── Query 1: getAffiliatePayoutList ─────────────────────────────────────────

export async function getAffiliatePayoutList(options: {
  status?: string;
  affiliateId?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: AffiliatePayoutAdminRow[]; total: number }> {
  const conditions = [];

  if (options.status) {
    conditions.push(sql`${affiliatePayout.status} = ${options.status}`);
  }

  if (options.affiliateId) {
    conditions.push(eq(affiliatePayout.affiliateId, options.affiliateId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        payoutId: affiliatePayout.id,
        affiliateId: affiliatePayout.affiliateId,
        affiliateUsername: user.username,
        affiliateEmail: user.email,
        amountCents: affiliatePayout.amountCents,
        method: affiliatePayout.method,
        status: affiliatePayout.status,
        periodStart: affiliatePayout.periodStart,
        periodEnd: affiliatePayout.periodEnd,
        failedReason: affiliatePayout.failedReason,
        createdAt: affiliatePayout.createdAt,
        completedAt: affiliatePayout.completedAt,
        externalPayoutId: affiliatePayout.externalPayoutId,
      })
      .from(affiliatePayout)
      .leftJoin(affiliate, eq(affiliatePayout.affiliateId, affiliate.id))
      .leftJoin(user, eq(affiliate.userId, user.id))
      .where(whereClause)
      .orderBy(desc(affiliatePayout.createdAt))
      .limit(options.limit)
      .offset(options.offset),

    db
      .select({ total: count() })
      .from(affiliatePayout)
      .where(whereClause),
  ]);

  return {
    rows: rows.map((r) => ({
      payoutId: r.payoutId,
      affiliateId: r.affiliateId,
      affiliateUsername: r.affiliateUsername ?? null,
      affiliateEmail: r.affiliateEmail ?? null,
      amountCents: r.amountCents,
      method: r.method,
      status: r.status,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      failedReason: r.failedReason ?? null,
      createdAt: r.createdAt,
      completedAt: r.completedAt ?? null,
      externalPayoutId: r.externalPayoutId ?? null,
    })),
    total: totalResult[0]?.total ?? 0,
  };
}

// ─── Query 2: getAffiliatePayoutStats ────────────────────────────────────────

export async function getAffiliatePayoutStats(): Promise<AffiliatePayoutStats> {
  const [payoutStats, affiliateStats, commissionStats] = await Promise.all([
    db
      .select({
        totalPayoutsCents: sql<number>`coalesce(sum(case when ${affiliatePayout.status} = 'COMPLETED' then ${affiliatePayout.amountCents} else 0 end), 0)`,
        totalPayoutsCount: sql<number>`count(case when ${affiliatePayout.status} = 'COMPLETED' then 1 end)`,
        failedPayoutsCount: sql<number>`count(case when ${affiliatePayout.status} = 'FAILED' then 1 end)`,
      })
      .from(affiliatePayout),

    db
      .select({
        pendingPayoutsCents: sql<number>`coalesce(sum(${affiliate.availableBalanceCents}), 0)`,
        activeAffiliatesCount: sql<number>`count(*)`,
      })
      .from(affiliate)
      .where(eq(affiliate.status, 'ACTIVE')),

    db
      .select({
        totalCommissionsPendingCents: sql<number>`coalesce(sum(${affiliateCommission.commissionCents}), 0)`,
      })
      .from(affiliateCommission)
      .where(eq(affiliateCommission.status, 'PENDING')),
  ]);

  const ps = payoutStats[0];
  const as = affiliateStats[0];
  const cs = commissionStats[0];

  return {
    totalPayoutsCents: Number(ps?.totalPayoutsCents ?? 0),
    totalPayoutsCount: Number(ps?.totalPayoutsCount ?? 0),
    pendingPayoutsCents: Number(as?.pendingPayoutsCents ?? 0),
    failedPayoutsCount: Number(ps?.failedPayoutsCount ?? 0),
    activeAffiliatesCount: Number(as?.activeAffiliatesCount ?? 0),
    totalCommissionsPendingCents: Number(cs?.totalCommissionsPendingCents ?? 0),
  };
}

// ─── Query 3: getCommissionsForAdmin ─────────────────────────────────────────

export async function getCommissionsForAdmin(options: {
  affiliateId: string;
  status?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: CommissionAdminRow[]; total: number }> {
  const conditions = [eq(affiliateCommission.affiliateId, options.affiliateId)];

  if (options.status) {
    conditions.push(sql`${affiliateCommission.status} = ${options.status}`);
  }

  const whereClause = and(...conditions);

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        commissionId: affiliateCommission.id,
        subscriptionProduct: affiliateCommission.subscriptionProduct,
        grossRevenueCents: affiliateCommission.grossRevenueCents,
        netRevenueCents: affiliateCommission.netRevenueCents,
        commissionRateBps: affiliateCommission.commissionRateBps,
        commissionCents: affiliateCommission.commissionCents,
        status: affiliateCommission.status,
        holdExpiresAt: affiliateCommission.holdExpiresAt,
        paidAt: affiliateCommission.paidAt,
        reversedAt: affiliateCommission.reversedAt,
        reversalReason: affiliateCommission.reversalReason,
        createdAt: affiliateCommission.createdAt,
      })
      .from(affiliateCommission)
      .where(whereClause)
      .orderBy(desc(affiliateCommission.createdAt))
      .limit(options.limit)
      .offset(options.offset),

    db
      .select({ total: count() })
      .from(affiliateCommission)
      .where(whereClause),
  ]);

  return {
    rows: rows.map((r) => ({
      commissionId: r.commissionId,
      subscriptionProduct: r.subscriptionProduct,
      grossRevenueCents: r.grossRevenueCents,
      netRevenueCents: r.netRevenueCents,
      commissionRateBps: r.commissionRateBps,
      commissionCents: r.commissionCents,
      status: r.status,
      holdExpiresAt: r.holdExpiresAt,
      paidAt: r.paidAt ?? null,
      reversedAt: r.reversedAt ?? null,
      reversalReason: r.reversalReason ?? null,
      createdAt: r.createdAt,
    })),
    total: totalResult[0]?.total ?? 0,
  };
}

// ─── Query 4: getPayoutsForAdmin ──────────────────────────────────────────────

export async function getPayoutsForAdmin(options: {
  affiliateId: string;
  limit: number;
  offset: number;
}): Promise<{ rows: PayoutAdminRow[]; total: number }> {
  const whereClause = eq(affiliatePayout.affiliateId, options.affiliateId);

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: affiliatePayout.id,
        affiliateId: affiliatePayout.affiliateId,
        amountCents: affiliatePayout.amountCents,
        method: affiliatePayout.method,
        externalPayoutId: affiliatePayout.externalPayoutId,
        status: affiliatePayout.status,
        periodStart: affiliatePayout.periodStart,
        periodEnd: affiliatePayout.periodEnd,
        failedReason: affiliatePayout.failedReason,
        createdAt: affiliatePayout.createdAt,
        completedAt: affiliatePayout.completedAt,
      })
      .from(affiliatePayout)
      .where(whereClause)
      .orderBy(desc(affiliatePayout.createdAt))
      .limit(options.limit)
      .offset(options.offset),

    db
      .select({ total: count() })
      .from(affiliatePayout)
      .where(whereClause),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      affiliateId: r.affiliateId,
      amountCents: r.amountCents,
      method: r.method,
      externalPayoutId: r.externalPayoutId ?? null,
      status: r.status,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      failedReason: r.failedReason ?? null,
      createdAt: r.createdAt,
      completedAt: r.completedAt ?? null,
    })),
    total: totalResult[0]?.total ?? 0,
  };
}
