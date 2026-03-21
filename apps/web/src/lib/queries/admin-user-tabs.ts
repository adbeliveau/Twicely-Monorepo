/**
 * Admin User Detail Tab Queries (I2.1)
 * Per-tab data queries for /usr/[id] tab panels
 */

import { db } from '@twicely/db';
import { order, listing, helpdeskCase, auditEvent, sellerBalance, payout, ledgerEntry } from '@twicely/db/schema';
import { eq, or, count, desc } from 'drizzle-orm';

export async function getAdminUserOrders(userId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalCents: order.totalCents,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      createdAt: order.createdAt,
    })
    .from(order)
    .where(or(eq(order.buyerId, userId), eq(order.sellerId, userId)))
    .orderBy(desc(order.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [total] = await db
    .select({ count: count() })
    .from(order)
    .where(or(eq(order.buyerId, userId), eq(order.sellerId, userId)));

  return { orders: rows, total: total?.count ?? 0 };
}

export async function getAdminUserListings(userId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      status: listing.status,
      priceCents: listing.priceCents,
      slug: listing.slug,
      createdAt: listing.createdAt,
    })
    .from(listing)
    .where(eq(listing.ownerUserId, userId))
    .orderBy(desc(listing.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [total] = await db
    .select({ count: count() })
    .from(listing)
    .where(eq(listing.ownerUserId, userId));

  return { listings: rows, total: total?.count ?? 0 };
}

export async function getAdminUserCases(userId: string) {
  return db
    .select()
    .from(helpdeskCase)
    .where(eq(helpdeskCase.requesterId, userId))
    .orderBy(desc(helpdeskCase.createdAt))
    .limit(50);
}

export async function getAdminUserFinance(userId: string) {
  const [balance] = await db
    .select()
    .from(sellerBalance)
    .where(eq(sellerBalance.userId, userId))
    .limit(1);

  const payouts = await db
    .select()
    .from(payout)
    .where(eq(payout.userId, userId))
    .orderBy(desc(payout.createdAt))
    .limit(20);

  const ledgerEntries = await db
    .select()
    .from(ledgerEntry)
    .where(eq(ledgerEntry.userId, userId))
    .orderBy(desc(ledgerEntry.createdAt))
    .limit(20);

  return { balance: balance ?? null, payouts, ledgerEntries };
}

export async function getAdminUserActivity(userId: string) {
  return db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.actorId, userId))
    .orderBy(desc(auditEvent.createdAt))
    .limit(50);
}

export async function getAdminUserNotes(userId: string) {
  return db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.subjectId, userId))
    .orderBy(desc(auditEvent.createdAt))
    .limit(100);
}
