import { db } from '@twicely/db';
import { listing, order, sellerProfile, user } from '@twicely/db/schema';
import { sql, eq, count } from 'drizzle-orm';

export interface LandingStats {
  totalListings: number;
  totalSellers: number;
  totalBuyers: number;
  totalSold: number;
}

export async function getLandingStats(): Promise<LandingStats> {
  const [listings, sellers, buyers, sold] = await Promise.all([
    db
      .select({ count: count() })
      .from(listing)
      .where(eq(listing.status, 'ACTIVE')),
    db.select({ count: count() }).from(sellerProfile),
    db.select({ count: count() }).from(user),
    db
      .select({ count: count() })
      .from(order)
      .where(
        sql`${order.status} IN ('DELIVERED', 'COMPLETED')`,
      ),
  ]);

  return {
    totalListings: listings[0]?.count ?? 0,
    totalSellers: sellers[0]?.count ?? 0,
    totalBuyers: buyers[0]?.count ?? 0,
    totalSold: sold[0]?.count ?? 0,
  };
}
