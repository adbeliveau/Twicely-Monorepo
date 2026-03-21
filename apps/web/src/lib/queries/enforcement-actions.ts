/**
 * Enforcement Action Queries (G4)
 */

import { db } from '@twicely/db';
import { enforcementAction, user } from '@twicely/db/schema';
import { eq, count, desc, and, inArray, isNull, gt, asc, sql } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

type EnforcementActionStatus = 'ACTIVE' | 'EXPIRED' | 'LIFTED' | 'APPEALED' | 'APPEAL_APPROVED';

export interface EnforcementActionRow {
  id: string;
  userId: string;
  userName: string;
  actionType: string;
  trigger: string;
  status: EnforcementActionStatus;
  reason: string;
  issuedByStaffId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export async function getEnforcementActions(
  filterUserId: string | null,
  filterStatus: EnforcementActionStatus | null,
  page: number,
  pageSize: number
): Promise<{ actions: EnforcementActionRow[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filterUserId) conditions.push(eq(enforcementAction.userId, filterUserId));
  if (filterStatus) conditions.push(eq(enforcementAction.status, filterStatus));

  const whereClause = conditions.length > 1
    ? and(...conditions as [ReturnType<typeof eq>, ReturnType<typeof eq>])
    : conditions[0];

  const [totalResult] = await db
    .select({ count: count() })
    .from(enforcementAction)
    .where(whereClause);

  const rows = await db
    .select({
      id: enforcementAction.id,
      userId: enforcementAction.userId,
      actionType: enforcementAction.actionType,
      trigger: enforcementAction.trigger,
      status: enforcementAction.status,
      reason: enforcementAction.reason,
      issuedByStaffId: enforcementAction.issuedByStaffId,
      expiresAt: enforcementAction.expiresAt,
      createdAt: enforcementAction.createdAt,
    })
    .from(enforcementAction)
    .where(whereClause)
    .orderBy(desc(enforcementAction.createdAt))
    .limit(pageSize)
    .offset(offset);

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = userIds.length > 0
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, userIds))
    : [];
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  return {
    actions: rows.map((r) => ({
      ...r,
      userName: nameMap.get(r.userId) ?? 'Unknown',
    })) as EnforcementActionRow[],
    total: totalResult?.count ?? 0,
  };
}

export async function getEnforcementActionById(actionId: string) {
  const [row] = await db
    .select()
    .from(enforcementAction)
    .where(eq(enforcementAction.id, actionId))
    .limit(1);
  return row ?? null;
}

export async function getActiveEnforcementForUser(userId: string) {
  return db
    .select()
    .from(enforcementAction)
    .where(
      and(
        eq(enforcementAction.userId, userId),
        eq(enforcementAction.status, 'ACTIVE')
      )
    )
    .orderBy(desc(enforcementAction.createdAt));
}

export async function getEnforcementHistory(userId: string) {
  return db
    .select()
    .from(enforcementAction)
    .where(eq(enforcementAction.userId, userId))
    .orderBy(desc(enforcementAction.createdAt));
}

export interface EnforcementKPIs {
  activeWarnings: number;
  activeRestrictions: number;
  activeSuspensions: number;
  pendingReports: number;
}

export async function getEnforcementKPIs(): Promise<EnforcementKPIs> {
  const [warnings, restrictions, suspensions] = await Promise.all([
    db.select({ count: count() }).from(enforcementAction).where(
      and(eq(enforcementAction.actionType, 'WARNING'), eq(enforcementAction.status, 'ACTIVE'))
    ),
    db.select({ count: count() }).from(enforcementAction).where(
      and(eq(enforcementAction.actionType, 'RESTRICTION'), eq(enforcementAction.status, 'ACTIVE'))
    ),
    db.select({ count: count() }).from(enforcementAction).where(
      and(eq(enforcementAction.actionType, 'SUSPENSION'), eq(enforcementAction.status, 'ACTIVE'))
    ),
  ]);

  return {
    activeWarnings: warnings[0]?.count ?? 0,
    activeRestrictions: restrictions[0]?.count ?? 0,
    activeSuspensions: suspensions[0]?.count ?? 0,
    pendingReports: 0, // Populated by getModerationKPIs in admin-moderation.ts
  };
}

export interface AppealableActionRow {
  id: string;
  userId: string;
  actionType: string;
  reason: string;
  status: string;
  appealedAt: Date | null;
  createdAt: Date;
}

/** Returns ACTIVE enforcement actions for a user that are within the appeal window and not yet appealed. */
export async function getAppealableActionsForUser(userId: string): Promise<AppealableActionRow[]> {
  const [appealWindowDays, appealableTypes] = await Promise.all([
    getPlatformSetting<number>('score.enforcement.appealWindowDays', 30),
    getPlatformSetting<string[]>('score.enforcement.appealableActionTypes', [
      'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION',
      'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION',
    ]),
  ]);

  const windowMs = Number(appealWindowDays) * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - windowMs);

  const rows = await db
    .select({
      id: enforcementAction.id,
      userId: enforcementAction.userId,
      actionType: enforcementAction.actionType,
      reason: enforcementAction.reason,
      status: enforcementAction.status,
      appealedAt: enforcementAction.appealedAt,
      createdAt: enforcementAction.createdAt,
    })
    .from(enforcementAction)
    .where(
      and(
        eq(enforcementAction.userId, userId),
        eq(enforcementAction.status, 'ACTIVE'),
        isNull(enforcementAction.appealedAt),
        gt(enforcementAction.createdAt, cutoff)
      )
    )
    .orderBy(desc(enforcementAction.createdAt));

  const typesSet = new Set(appealableTypes as string[]);
  return rows.filter((r) => typesSet.has(r.actionType));
}

export interface AppealedActionRow {
  id: string;
  userId: string;
  userName: string;
  actionType: string;
  reason: string;
  appealNote: string | null;
  appealedAt: Date | null;
  appealedByUserId: string | null;
}

/** Returns all APPEALED enforcement actions ordered oldest-first (for SLA review queue). */
export async function getAppealedEnforcementActions(
  page: number,
  pageSize: number
): Promise<{ actions: AppealedActionRow[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const [totalResult] = await db
    .select({ count: count() })
    .from(enforcementAction)
    .where(eq(enforcementAction.status, 'APPEALED'));

  const rows = await db
    .select({
      id: enforcementAction.id,
      userId: enforcementAction.userId,
      actionType: enforcementAction.actionType,
      reason: enforcementAction.reason,
      appealNote: enforcementAction.appealNote,
      appealedAt: enforcementAction.appealedAt,
      appealedByUserId: enforcementAction.appealedByUserId,
    })
    .from(enforcementAction)
    .where(eq(enforcementAction.status, 'APPEALED'))
    .orderBy(asc(enforcementAction.appealedAt))
    .limit(pageSize)
    .offset(offset);

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = userIds.length > 0
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, userIds))
    : [];
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  return {
    actions: rows.map((r) => ({ ...r, userName: nameMap.get(r.userId) ?? 'Unknown' })),
    total: totalResult?.count ?? 0,
  };
}

export interface AppealKPIs {
  pendingAppeals: number;
  avgReviewHours: number;
}

/** Returns pending appeal count and average review time for recently resolved appeals. */
export async function getAppealKPIs(): Promise<AppealKPIs> {
  const [pendingResult, avgResult] = await Promise.all([
    db.select({ count: count() }).from(enforcementAction)
      .where(eq(enforcementAction.status, 'APPEALED')),
    db.select({
      avgMs: sql<number>`AVG(EXTRACT(EPOCH FROM (${enforcementAction.appealResolvedAt} - ${enforcementAction.appealedAt})) * 1000)`,
    }).from(enforcementAction)
      .where(
        and(
          sql`${enforcementAction.appealResolvedAt} IS NOT NULL`,
          sql`${enforcementAction.appealedAt} IS NOT NULL`
        )
      ),
  ]);

  const avgMs = avgResult[0]?.avgMs ?? 0;
  const avgReviewHours = avgMs > 0 ? Math.round(Number(avgMs) / 3600000) : 0;

  return {
    pendingAppeals: pendingResult[0]?.count ?? 0,
    avgReviewHours,
  };
}
