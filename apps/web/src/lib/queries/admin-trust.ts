/**
 * Admin Trust & Safety Queries (I7)
 * Trust overview KPIs, seller trust profiles, band transitions.
 * Risk + security queries: admin-trust-security.ts
 */

import { db } from '@twicely/db';
import {
  sellerProfile,
  sellerPerformance,
  sellerScoreSnapshot,
  user,
} from '@twicely/db/schema';
import { eq, desc, avg, count, sql, and, gte } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrustOverviewKPIs {
  totalSellers: number;
  avgTrustScore: number;
  avgSellerScore: number;
  bandDistribution: Array<{ band: string; count: number }>;
  enforcementCounts: {
    coaching: number;
    warning: number;
    restriction: number;
    preSuspension: number;
  };
  activeOverrides: number;
}

export interface BandTransition {
  userId: string;
  userName: string;
  previousBand: string;
  newBand: string;
  sellerScore: number;
  changedAt: Date;
}

export interface SellerTrustProfile {
  userId: string;
  name: string;
  email: string;
  trustScore: number;
  sellerScore: number;
  performanceBand: string;
  enforcementLevel: string | null;
  enforcementStartedAt: Date | null;
  warningExpiresAt: Date | null;
  bandOverride: string | null;
  bandOverrideExpiresAt: Date | null;
  bandOverrideReason: string | null;
  bandOverrideBy: string | null;
  isNew: boolean;
  defectRate: number;
  inadRate: number;
  chargebackRate: number;
  lateShipmentRate: number;
  cancelRate: number;
  returnRate: number;
  onTimeShippingPct: number | null;
  avgResponseTimeHours: number | null;
  currentBand: string;
  totalOrders: number;
  completedOrders: number;
  averageRating: number | null;
}

export interface SellerScoreSnapshot {
  id: string;
  snapshotDate: string | null;
  overallScore: number;
  performanceBand: string;
  searchMultiplier: number | null;
  shippingScore: number | null;
  inadScore: number | null;
  reviewScore: number | null;
  responseScore: number | null;
  returnScore: number | null;
  cancellationScore: number | null;
  trendModifier: number | null;
  orderCount: number;
  previousBand: string | null;
  bandChangedAt: Date | null;
}

// ─── Trust Overview Dashboard ─────────────────────────────────────────────────

export async function getTrustOverviewKPIs(): Promise<TrustOverviewKPIs> {
  const [totals, bandDist, enfDist, overrides] = await Promise.all([
    db.select({ totalSellers: count(), avgTrustScore: avg(sellerProfile.trustScore), avgSellerScore: avg(sellerProfile.sellerScore) }).from(sellerProfile),
    getTrustBandDistribution(),
    getEnforcementDistribution(),
    db.select({ cnt: count() }).from(sellerProfile).where(sql`${sellerProfile.bandOverride} IS NOT NULL`),
  ]);

  const row = totals[0];
  const enfMap: Record<string, number> = {};
  for (const e of enfDist) enfMap[e.level] = e.count;

  return {
    totalSellers: Number(row?.totalSellers ?? 0),
    avgTrustScore: Number(row?.avgTrustScore ?? 0),
    avgSellerScore: Number(row?.avgSellerScore ?? 0),
    bandDistribution: bandDist,
    enforcementCounts: {
      coaching: enfMap['COACHING'] ?? 0,
      warning: enfMap['WARNING'] ?? 0,
      restriction: enfMap['RESTRICTION'] ?? 0,
      preSuspension: enfMap['PRE_SUSPENSION'] ?? 0,
    },
    activeOverrides: Number(overrides[0]?.cnt ?? 0),
  };
}

export async function getTrustBandDistribution(): Promise<Array<{ band: string; count: number }>> {
  const rows = await db.select({ band: sellerProfile.performanceBand, cnt: count() }).from(sellerProfile).groupBy(sellerProfile.performanceBand);
  return rows.map((r) => ({ band: r.band, count: Number(r.cnt) }));
}

export async function getEnforcementDistribution(): Promise<Array<{ level: string; count: number }>> {
  const rows = await db.select({ level: sellerProfile.enforcementLevel, cnt: count() }).from(sellerProfile).where(sql`${sellerProfile.enforcementLevel} IS NOT NULL`).groupBy(sellerProfile.enforcementLevel);
  return rows.map((r) => ({ level: r.level ?? '', count: Number(r.cnt) }));
}

export async function getRecentBandTransitions(limit = 20): Promise<BandTransition[]> {
  const rows = await db
    .select({
      userId: sellerScoreSnapshot.userId,
      userName: user.name,
      previousBand: sellerScoreSnapshot.previousBand,
      performanceBand: sellerScoreSnapshot.performanceBand,
      sellerScore: sellerScoreSnapshot.overallScore,
      bandChangedAt: sellerScoreSnapshot.bandChangedAt,
    })
    .from(sellerScoreSnapshot)
    .innerJoin(user, eq(sellerScoreSnapshot.userId, user.id))
    .where(and(sql`${sellerScoreSnapshot.previousBand} IS NOT NULL`, sql`${sellerScoreSnapshot.bandChangedAt} IS NOT NULL`))
    .orderBy(desc(sellerScoreSnapshot.bandChangedAt))
    .limit(limit);

  return rows
    .filter((r) => r.userId !== null && r.previousBand !== null && r.bandChangedAt !== null)
    .map((r) => ({
      userId: r.userId!,
      userName: r.userName,
      previousBand: r.previousBand!,
      newBand: r.performanceBand,
      sellerScore: r.sellerScore,
      changedAt: r.bandChangedAt!,
    }));
}

export async function getTrustScoreTimeline(days = 90): Promise<Array<{ date: string; avgScore: number }>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const rows = await db.select({ date: sellerScoreSnapshot.snapshotDate, avgScore: avg(sellerScoreSnapshot.overallScore) }).from(sellerScoreSnapshot).where(gte(sellerScoreSnapshot.createdAt, cutoff)).groupBy(sellerScoreSnapshot.snapshotDate).orderBy(sellerScoreSnapshot.snapshotDate);
  return rows.filter((r) => r.date !== null).map((r) => ({ date: r.date!, avgScore: Number(r.avgScore ?? 0) }));
}

// ─── Seller Trust Profile ─────────────────────────────────────────────────────

export async function getSellerTrustProfile(userId: string): Promise<SellerTrustProfile | null> {
  const rows = await db
    .select({
      userId: sellerProfile.userId, name: user.name, email: user.email,
      trustScore: sellerProfile.trustScore, sellerScore: sellerProfile.sellerScore,
      performanceBand: sellerProfile.performanceBand, enforcementLevel: sellerProfile.enforcementLevel,
      enforcementStartedAt: sellerProfile.enforcementStartedAt, warningExpiresAt: sellerProfile.warningExpiresAt,
      bandOverride: sellerProfile.bandOverride, bandOverrideExpiresAt: sellerProfile.bandOverrideExpiresAt,
      bandOverrideReason: sellerProfile.bandOverrideReason, bandOverrideBy: sellerProfile.bandOverrideBy,
      isNew: sellerProfile.isNew, defectRate: sellerPerformance.defectRate, inadRate: sellerPerformance.inadRate,
      chargebackRate: sellerPerformance.chargebackRate, lateShipmentRate: sellerPerformance.lateShipmentRate,
      cancelRate: sellerPerformance.cancelRate, returnRate: sellerPerformance.returnRate,
      onTimeShippingPct: sellerPerformance.onTimeShippingPct, avgResponseTimeHours: sellerPerformance.avgResponseTimeHours,
      currentBand: sellerPerformance.currentBand, totalOrders: sellerPerformance.totalOrders,
      completedOrders: sellerPerformance.completedOrders, averageRating: sellerPerformance.averageRating,
    })
    .from(sellerProfile)
    .innerJoin(user, eq(sellerProfile.userId, user.id))
    .leftJoin(sellerPerformance, eq(sellerPerformance.sellerProfileId, sellerProfile.id))
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    userId: row.userId, name: row.name, email: row.email,
    trustScore: row.trustScore, sellerScore: row.sellerScore,
    performanceBand: row.performanceBand, enforcementLevel: row.enforcementLevel ?? null,
    enforcementStartedAt: row.enforcementStartedAt ?? null, warningExpiresAt: row.warningExpiresAt ?? null,
    bandOverride: row.bandOverride ?? null, bandOverrideExpiresAt: row.bandOverrideExpiresAt ?? null,
    bandOverrideReason: row.bandOverrideReason ?? null, bandOverrideBy: row.bandOverrideBy ?? null,
    isNew: row.isNew,
    defectRate: row.defectRate ?? 0, inadRate: row.inadRate ?? 0, chargebackRate: row.chargebackRate ?? 0,
    lateShipmentRate: row.lateShipmentRate ?? 0, cancelRate: row.cancelRate ?? 0, returnRate: row.returnRate ?? 0,
    onTimeShippingPct: row.onTimeShippingPct ?? null, avgResponseTimeHours: row.avgResponseTimeHours ?? null,
    currentBand: row.currentBand ?? 'EMERGING', totalOrders: row.totalOrders ?? 0,
    completedOrders: row.completedOrders ?? 0, averageRating: row.averageRating ?? null,
  };
}

export async function getSellerScoreHistory(userId: string, days = 90): Promise<SellerScoreSnapshot[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const rows = await db.select().from(sellerScoreSnapshot).where(and(eq(sellerScoreSnapshot.userId, userId), gte(sellerScoreSnapshot.createdAt, cutoff))).orderBy(desc(sellerScoreSnapshot.snapshotDate));
  return rows.map((r) => ({
    id: r.id, snapshotDate: r.snapshotDate ?? null, overallScore: r.overallScore,
    performanceBand: r.performanceBand, searchMultiplier: r.searchMultiplier ?? null,
    shippingScore: r.shippingScore ?? null, inadScore: r.inadScore ?? null,
    reviewScore: r.reviewScore ?? null, responseScore: r.responseScore ?? null,
    returnScore: r.returnScore ?? null, cancellationScore: r.cancellationScore ?? null,
    trendModifier: r.trendModifier ?? null, orderCount: r.orderCount,
    previousBand: r.previousBand ?? null, bandChangedAt: r.bandChangedAt ?? null,
  }));
}

// ─── Seller Trust List (paginated) ───────────────────────────────────────────

export interface SellerTrustListItem {
  userId: string;
  name: string;
  email: string;
  sellerScore: number;
  performanceBand: string;
  enforcementLevel: string | null;
}

export async function getSellerTrustList(
  page = 1,
  pageSize = 50
): Promise<{ rows: SellerTrustListItem[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        userId: sellerProfile.userId,
        name: sql<string>`coalesce(${user.name}, ${user.email})`,
        email: user.email,
        sellerScore: sellerProfile.sellerScore,
        performanceBand: sellerProfile.performanceBand,
        enforcementLevel: sellerProfile.enforcementLevel,
      })
      .from(sellerProfile)
      .innerJoin(user, eq(user.id, sellerProfile.userId))
      .orderBy(desc(sellerProfile.sellerScore))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(sellerProfile),
  ]);

  return {
    rows: rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      email: r.email,
      sellerScore: r.sellerScore,
      performanceBand: r.performanceBand,
      enforcementLevel: r.enforcementLevel,
    })),
    total: totalResult[0]?.count ?? 0,
  };
}
