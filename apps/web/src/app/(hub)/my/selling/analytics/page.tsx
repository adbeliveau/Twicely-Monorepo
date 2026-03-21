import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { authorize, sub } from '@twicely/casl';
import { db } from '@twicely/db';
import { order, listing } from '@twicely/db/schema';
import { eq, and, gte, count, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analytics | Twicely',
  robots: 'noindex',
};

export default async function SellerAnalyticsPage() {
  const { session, ability } = await authorize();
  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/analytics');
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('Analytics', { sellerId: userId }))) {
    return <p className="text-red-600">Access denied</p>;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [revenueResult, orderCount, activeListings] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${order.totalCents}), 0)` })
      .from(order)
      .where(
        and(
          eq(order.sellerId, userId),
          eq(order.status, 'COMPLETED'),
          gte(order.createdAt, thirtyDaysAgo),
        ),
      ),
    db
      .select({ count: count() })
      .from(order)
      .where(and(eq(order.sellerId, userId), gte(order.createdAt, thirtyDaysAgo))),
    db
      .select({ count: count() })
      .from(listing)
      .where(and(eq(listing.ownerUserId, userId), eq(listing.status, 'ACTIVE'))),
  ]);

  const revenueCents = Number(revenueResult[0]?.total ?? 0);
  const revenueFormatted = `$${(revenueCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Revenue, views, conversion, and top items over the last 30 days.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Revenue (30 days)</p>
          <p className="text-2xl font-bold">{revenueFormatted}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Orders (30 days)</p>
          <p className="text-2xl font-bold">{orderCount[0]?.count ?? 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Active Listings</p>
          <p className="text-2xl font-bold">{activeListings[0]?.count ?? 0}</p>
        </div>
      </div>
      <p className="text-sm text-gray-400">
        Detailed charts and conversion analytics coming in Phase I10.
      </p>
    </div>
  );
}
