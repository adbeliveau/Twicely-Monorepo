import { eq, sql, desc, count } from 'drizzle-orm';
import { db } from '@twicely/db';
import { affiliate, referral, affiliateCommission, affiliatePayout, user } from '@twicely/db/schema';

/**
 * Get an affiliate record by userId.
 * Returns the full row or null if not found.
 */
export async function getAffiliateByUserId(userId: string) {
  const [row] = await db
    .select()
    .from(affiliate)
    .where(eq(affiliate.userId, userId))
    .limit(1);

  return row ?? null;
}

/**
 * Get an affiliate record by referral code.
 * Codes are stored uppercased — caller should uppercase before querying.
 */
export async function getAffiliateByReferralCode(code: string) {
  const [row] = await db
    .select()
    .from(affiliate)
    .where(eq(affiliate.referralCode, code))
    .limit(1);

  return row ?? null;
}

// ─── Dashboard Queries (G1.4) ────────────────────────────────────────────────

export interface AffiliateStats {
  thisMonth: {
    clicks: number;
    signups: number;
    conversions: number;
    earningsCents: number;
    conversionRate: number;
  };
  allTime: {
    clicks: number;
    signups: number;
    conversions: number;
    earningsCents: number;
    conversionRate: number;
  };
}

function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function calcRate(conversions: number, signups: number): number {
  return signups > 0 ? Math.round((conversions / signups) * 1000) / 10 : 0;
}

export async function getAffiliateStats(affiliateId: string): Promise<AffiliateStats> {
  const monthStart = getMonthStart();

  const [refStats, commStats] = await Promise.all([
    // Referral stats — all-time + this month in one query
    db.select({
      allClicks: count(),
      allSignups: count(referral.signedUpAt),
      allConversions: count(referral.convertedAt),
      monthClicks: sql<number>`count(*) filter (where ${referral.clickedAt} >= ${monthStart})`.as('month_clicks'),
      monthSignups: sql<number>`count(${referral.signedUpAt}) filter (where ${referral.signedUpAt} >= ${monthStart})`.as('month_signups'),
      monthConversions: sql<number>`count(${referral.convertedAt}) filter (where ${referral.convertedAt} >= ${monthStart})`.as('month_conversions'),
    })
      .from(referral)
      .where(eq(referral.affiliateId, affiliateId)),

    // Commission stats — all-time + this month
    db.select({
      allEarnings: sql<number>`coalesce(sum(${affiliateCommission.commissionCents}), 0)`.as('all_earnings'),
      monthEarnings: sql<number>`coalesce(sum(${affiliateCommission.commissionCents}) filter (where ${affiliateCommission.createdAt} >= ${monthStart}), 0)`.as('month_earnings'),
    })
      .from(affiliateCommission)
      .where(eq(affiliateCommission.affiliateId, affiliateId)),
  ]);

  const r = refStats[0];
  const c = commStats[0];

  return {
    thisMonth: {
      clicks: Number(r?.monthClicks ?? 0),
      signups: Number(r?.monthSignups ?? 0),
      conversions: Number(r?.monthConversions ?? 0),
      earningsCents: Number(c?.monthEarnings ?? 0),
      conversionRate: calcRate(Number(r?.monthConversions ?? 0), Number(r?.monthSignups ?? 0)),
    },
    allTime: {
      clicks: Number(r?.allClicks ?? 0),
      signups: Number(r?.allSignups ?? 0),
      conversions: Number(r?.allConversions ?? 0),
      earningsCents: Number(c?.allEarnings ?? 0),
      conversionRate: calcRate(Number(r?.allConversions ?? 0), Number(r?.allSignups ?? 0)),
    },
  };
}

export interface ReferralRow {
  id: string;
  status: string;
  clickedAt: Date;
  signedUpAt: Date | null;
  convertedAt: Date | null;
  churnedAt: Date | null;
  referredUsername: string | null;
  referredSignupDate: Date | null;
}

const ANONYMIZE_DAYS = 30;

export async function getAffiliateReferrals(
  affiliateId: string,
  options: { limit: number; offset: number },
): Promise<{ rows: ReferralRow[]; total: number }> {
  const [rows, totalResult] = await Promise.all([
    db.select({
      id: referral.id,
      status: referral.status,
      clickedAt: referral.clickedAt,
      signedUpAt: referral.signedUpAt,
      convertedAt: referral.convertedAt,
      churnedAt: referral.churnedAt,
      referredUsername: user.username,
      referredSignupDate: referral.signedUpAt,
    })
      .from(referral)
      .leftJoin(user, eq(referral.referredUserId, user.id))
      .where(eq(referral.affiliateId, affiliateId))
      .orderBy(desc(referral.clickedAt))
      .limit(options.limit)
      .offset(options.offset),

    db.select({ total: count() })
      .from(referral)
      .where(eq(referral.affiliateId, affiliateId)),
  ]);

  const cutoff = new Date(Date.now() - ANONYMIZE_DAYS * 24 * 60 * 60 * 1000);

  const anonymized: ReferralRow[] = rows.map((r) => ({
    ...r,
    referredUsername:
      r.signedUpAt && r.signedUpAt < cutoff ? null : r.referredUsername,
  }));

  return { rows: anonymized, total: totalResult[0]?.total ?? 0 };
}

export interface CommissionRow {
  id: string;
  subscriptionProduct: string;
  grossRevenueCents: number;
  netRevenueCents: number;
  commissionRateBps: number;
  commissionCents: number;
  status: string;
  holdExpiresAt: Date;
  createdAt: Date;
}

export async function getAffiliateCommissions(
  affiliateId: string,
  options: { limit: number; offset: number },
): Promise<{ rows: CommissionRow[]; total: number }> {
  const [rows, totalResult] = await Promise.all([
    db.select({
      id: affiliateCommission.id,
      subscriptionProduct: affiliateCommission.subscriptionProduct,
      grossRevenueCents: affiliateCommission.grossRevenueCents,
      netRevenueCents: affiliateCommission.netRevenueCents,
      commissionRateBps: affiliateCommission.commissionRateBps,
      commissionCents: affiliateCommission.commissionCents,
      status: affiliateCommission.status,
      holdExpiresAt: affiliateCommission.holdExpiresAt,
      createdAt: affiliateCommission.createdAt,
    })
      .from(affiliateCommission)
      .where(eq(affiliateCommission.affiliateId, affiliateId))
      .orderBy(desc(affiliateCommission.createdAt))
      .limit(options.limit)
      .offset(options.offset),

    db.select({ total: count() })
      .from(affiliateCommission)
      .where(eq(affiliateCommission.affiliateId, affiliateId)),
  ]);

  return { rows, total: totalResult[0]?.total ?? 0 };
}

export async function getAffiliatePayouts(
  affiliateId: string,
  options: { limit: number; offset: number },
): Promise<{ rows: typeof affiliatePayout.$inferSelect[]; total: number }> {
  const [rows, totalResult] = await Promise.all([
    db.select()
      .from(affiliatePayout)
      .where(eq(affiliatePayout.affiliateId, affiliateId))
      .orderBy(desc(affiliatePayout.createdAt))
      .limit(options.limit)
      .offset(options.offset),

    db.select({ total: count() })
      .from(affiliatePayout)
      .where(eq(affiliatePayout.affiliateId, affiliateId)),
  ]);

  return { rows, total: totalResult[0]?.total ?? 0 };
}
