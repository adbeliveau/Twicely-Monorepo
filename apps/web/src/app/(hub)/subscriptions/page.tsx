import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { storeSubscription, listerSubscription } from '@twicely/db/schema';
import { count, eq } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'Subscriptions | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function SubscriptionsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Subscription')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [storeResult, listerResult] = await Promise.all([
    db.select({ count: count() }).from(storeSubscription)
      .where(eq(storeSubscription.status, 'ACTIVE')),
    db.select({ count: count() }).from(listerSubscription)
      .where(eq(listerSubscription.status, 'ACTIVE')),
  ]);

  const activeStore = storeResult[0]?.count ?? 0;
  const activeLister = listerResult[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="mt-1 text-sm text-gray-500">
          View active subscriber counts by tier.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Active Store Subscriptions</p>
          <p className="text-2xl font-bold">{activeStore}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Active Lister Subscriptions</p>
          <p className="text-2xl font-bold">{activeLister}</p>
        </div>
      </div>
    </div>
  );
}
