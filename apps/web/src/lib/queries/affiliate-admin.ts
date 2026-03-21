import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db } from '@twicely/db';
import {
  affiliate,
  user,
  referral,
  promoCode,
} from '@twicely/db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AffiliateAdminRow {
  id: string;
  userId: string;
  username: string | null;
  email: string | null;
  displayName: string | null;
  tier: string;
  status: string;
  commissionRateBps: number;
  referralCode: string;
  totalEarnedCents: number;
  createdAt: Date;
}

export interface AffiliateAdminDetail {
  id: string;
  userId: string;
  username: string | null;
  email: string | null;
  displayName: string | null;
  tier: string;
  status: string;
  commissionRateBps: number;
  cookieDurationDays: number;
  commissionDurationMonths: number;
  referralCode: string;
  applicationNote: string | null;
  warningCount: number;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  pendingBalanceCents: number;
  availableBalanceCents: number;
  totalEarnedCents: number;
  totalPaidCents: number;
  referralCount: number;
  conversionCount: number;
  promoCodeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Query: getAffiliateApplications ─────────────────────────────────────────

export async function getAffiliateApplications(options: {
  status?: string;
  tier?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: AffiliateAdminRow[]; total: number }> {
  const conditions = [];

  if (options.status) {
    conditions.push(
      sql`${affiliate.status} = ${options.status}`
    );
  }

  if (options.tier) {
    conditions.push(
      sql`${affiliate.tier} = ${options.tier}`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: affiliate.id,
        userId: affiliate.userId,
        username: user.username,
        email: user.email,
        displayName: user.name,
        tier: affiliate.tier,
        status: affiliate.status,
        commissionRateBps: affiliate.commissionRateBps,
        referralCode: affiliate.referralCode,
        totalEarnedCents: affiliate.totalEarnedCents,
        createdAt: affiliate.createdAt,
      })
      .from(affiliate)
      .leftJoin(user, eq(affiliate.userId, user.id))
      .where(whereClause)
      .orderBy(
        // PENDING first, then by createdAt desc
        sql`case when ${affiliate.status} = 'PENDING' then 0 else 1 end`,
        desc(affiliate.createdAt)
      )
      .limit(options.limit)
      .offset(options.offset),

    db
      .select({ total: count() })
      .from(affiliate)
      .leftJoin(user, eq(affiliate.userId, user.id))
      .where(whereClause),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.username ?? null,
      email: r.email ?? null,
      displayName: r.displayName ?? null,
      tier: r.tier,
      status: r.status,
      commissionRateBps: r.commissionRateBps,
      referralCode: r.referralCode,
      totalEarnedCents: r.totalEarnedCents,
      createdAt: r.createdAt,
    })),
    total: totalResult[0]?.total ?? 0,
  };
}

// ─── Query: getAffiliateDetailForAdmin ───────────────────────────────────────

export async function getAffiliateDetailForAdmin(
  affiliateId: string
): Promise<AffiliateAdminDetail | null> {
  const [row] = await db
    .select({
      id: affiliate.id,
      userId: affiliate.userId,
      username: user.username,
      email: user.email,
      displayName: user.name,
      tier: affiliate.tier,
      status: affiliate.status,
      commissionRateBps: affiliate.commissionRateBps,
      cookieDurationDays: affiliate.cookieDurationDays,
      commissionDurationMonths: affiliate.commissionDurationMonths,
      referralCode: affiliate.referralCode,
      applicationNote: affiliate.applicationNote,
      warningCount: affiliate.warningCount,
      suspendedAt: affiliate.suspendedAt,
      suspendedReason: affiliate.suspendedReason,
      pendingBalanceCents: affiliate.pendingBalanceCents,
      availableBalanceCents: affiliate.availableBalanceCents,
      totalEarnedCents: affiliate.totalEarnedCents,
      totalPaidCents: affiliate.totalPaidCents,
      createdAt: affiliate.createdAt,
      updatedAt: affiliate.updatedAt,
    })
    .from(affiliate)
    .leftJoin(user, eq(affiliate.userId, user.id))
    .where(eq(affiliate.id, affiliateId))
    .limit(1);

  if (!row) return null;

  const [refCountResult, convCountResult, promoCountResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(referral)
      .where(eq(referral.affiliateId, affiliateId)),

    db
      .select({ total: count() })
      .from(referral)
      .where(
        and(
          eq(referral.affiliateId, affiliateId),
          sql`${referral.convertedAt} is not null`
        )
      ),

    db
      .select({ total: count() })
      .from(promoCode)
      .where(eq(promoCode.affiliateId, affiliateId)),
  ]);

  return {
    id: row.id,
    userId: row.userId,
    username: row.username ?? null,
    email: row.email ?? null,
    displayName: row.displayName ?? null,
    tier: row.tier,
    status: row.status,
    commissionRateBps: row.commissionRateBps,
    cookieDurationDays: row.cookieDurationDays,
    commissionDurationMonths: row.commissionDurationMonths,
    referralCode: row.referralCode,
    applicationNote: row.applicationNote ?? null,
    warningCount: row.warningCount,
    suspendedAt: row.suspendedAt ?? null,
    suspendedReason: row.suspendedReason ?? null,
    pendingBalanceCents: row.pendingBalanceCents,
    availableBalanceCents: row.availableBalanceCents,
    totalEarnedCents: row.totalEarnedCents,
    totalPaidCents: row.totalPaidCents,
    referralCount: refCountResult[0]?.total ?? 0,
    conversionCount: convCountResult[0]?.total ?? 0,
    promoCodeCount: promoCountResult[0]?.total ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
