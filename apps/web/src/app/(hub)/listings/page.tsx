import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { listing } from '@twicely/db/schema';
import { count, eq } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'Listings Admin | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function ListingsAdminPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Listing')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [totalResult, activeResult, flaggedResult] = await Promise.all([
    db.select({ count: count() }).from(listing),
    db.select({ count: count() }).from(listing)
      .where(eq(listing.status, 'ACTIVE')),
    db.select({ count: count() }).from(listing)
      .where(eq(listing.status, 'REMOVED')),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const active = activeResult[0]?.count ?? 0;
  const removed = flaggedResult[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Listings Admin</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse all listings, search, and perform bulk actions.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Listings</p>
          <p className="text-2xl font-bold">{total}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold">{active}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Removed</p>
          <p className="text-2xl font-bold">{removed}</p>
        </div>
      </div>
    </div>
  );
}
