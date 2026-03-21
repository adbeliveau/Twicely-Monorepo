/**
 * Admin Dashboard Queries (E3.1)
 * KPI cards + chart data for the platform dashboard at /d
 */

import { db } from '@twicely/db';
import { order, user, listing, auditEvent } from '@twicely/db/schema';
import { sql, gte, desc, and, eq, count } from 'drizzle-orm';
import { helpdeskCase } from '@twicely/db/schema';

interface DashboardKPIs {
  ordersToday: number;
  revenueToday: number;
  openCases: number;
  activeListings: number;
  activeUsers: number;
  signupsToday: number;
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);

  const [ordersResult] = await db
    .select({ count: count() })
    .from(order)
    .where(gte(order.createdAt, todayStart));

  const [revenueResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${order.totalCents}), 0)` })
    .from(order)
    .where(gte(order.createdAt, todayStart));

  const [casesResult] = await db
    .select({ count: count() })
    .from(helpdeskCase)
    .where(eq(helpdeskCase.status, 'OPEN'));

  const [listingsResult] = await db
    .select({ count: count() })
    .from(listing)
    .where(eq(listing.status, 'ACTIVE'));

  const [activeResult] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${order.buyerId})` })
    .from(order)
    .where(gte(order.createdAt, yesterday));

  const [signupsResult] = await db
    .select({ count: count() })
    .from(user)
    .where(gte(user.createdAt, todayStart));

  return {
    ordersToday: ordersResult?.count ?? 0,
    revenueToday: Number(revenueResult?.total ?? 0),
    openCases: casesResult?.count ?? 0,
    activeListings: listingsResult?.count ?? 0,
    activeUsers: Number(activeResult?.count ?? 0),
    signupsToday: signupsResult?.count ?? 0,
  };
}

interface ChartDataPoint {
  date: string;
  value: number;
}

export async function getDashboardCharts(
  period: '7d' | '30d'
): Promise<{ gmv: ChartDataPoint[]; orders: ChartDataPoint[]; users: ChartDataPoint[] }> {
  const days = period === '7d' ? 7 : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const gmvRows = await db
    .select({
      date: sql<string>`DATE(${order.createdAt})`,
      value: sql<number>`COALESCE(SUM(${order.totalCents}), 0)`,
    })
    .from(order)
    .where(gte(order.createdAt, startDate))
    .groupBy(sql`DATE(${order.createdAt})`)
    .orderBy(sql`DATE(${order.createdAt})`);

  const orderRows = await db
    .select({
      date: sql<string>`DATE(${order.createdAt})`,
      value: count(),
    })
    .from(order)
    .where(gte(order.createdAt, startDate))
    .groupBy(sql`DATE(${order.createdAt})`)
    .orderBy(sql`DATE(${order.createdAt})`);

  const userRows = await db
    .select({
      date: sql<string>`DATE(${user.createdAt})`,
      value: count(),
    })
    .from(user)
    .where(gte(user.createdAt, startDate))
    .groupBy(sql`DATE(${user.createdAt})`)
    .orderBy(sql`DATE(${user.createdAt})`);

  return {
    gmv: gmvRows.map((r) => ({ date: String(r.date), value: Number(r.value) })),
    orders: orderRows.map((r) => ({ date: String(r.date), value: r.value })),
    users: userRows.map((r) => ({ date: String(r.date), value: r.value })),
  };
}

interface RecentActivity {
  id: string;
  action: string;
  subject: string;
  severity: string;
  createdAt: Date;
}

export async function getRecentAdminActivity(
  limit: number = 10
): Promise<RecentActivity[]> {
  const rows = await db
    .select({
      id: auditEvent.id,
      action: auditEvent.action,
      subject: auditEvent.subject,
      severity: auditEvent.severity,
      createdAt: auditEvent.createdAt,
    })
    .from(auditEvent)
    .where(
      and(
        sql`${auditEvent.severity} IN ('MEDIUM', 'HIGH', 'CRITICAL')`
      )
    )
    .orderBy(desc(auditEvent.createdAt))
    .limit(limit);

  return rows;
}
