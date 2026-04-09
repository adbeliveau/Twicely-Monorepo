import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getSellerShippingProfiles, getShippingProfileListingCount, getShippingProfileLimit } from '@/lib/queries/shipping-profiles';
import { getPendingQuotesForSeller, getExpiredQuotes } from '@/lib/queries/shipping-quote';
import { ShippingProfilesClient } from './shipping-profiles-client';
import { formatPrice, formatDate } from '@twicely/utils/format';
import Link from 'next/link';
import { Clock, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shipping Profiles | Twicely',
  robots: 'noindex',
};

export default async function ShippingProfilesPage() {
  // Layout guarantees authenticated seller
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/auth/login');
  }

  const userId = session.user.id;

  // Fetch shipping profiles, limit info, pending quotes, and expired quotes in parallel
  const [profiles, limitInfo, pendingQuotes, allExpiredQuotes] = await Promise.all([
    getSellerShippingProfiles(userId),
    getShippingProfileLimit(userId),
    getPendingQuotesForSeller(userId),
    getExpiredQuotes(),
  ]);

  // Filter expired quotes to only this seller's
  const expiredQuotes = allExpiredQuotes.filter((q) => q.sellerId === userId);

  // Fetch listing counts for each profile
  const profilesWithCounts = await Promise.all(
    profiles.map(async (profile) => ({
      ...profile,
      listingCount: await getShippingProfileListingCount(profile.id),
    }))
  );

  return (
    <div className="space-y-8">
      {/* Pending Quotes */}
      {pendingQuotes.length > 0 && (
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-gray-900">Pending Quotes</h2>
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {pendingQuotes.length} awaiting response
            </span>
          </div>
          <div className="divide-y">
            {pendingQuotes.map((quote) => (
              <div key={quote.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <Link
                    href={`/my/selling/orders/${quote.orderId}`}
                    className="text-sm font-medium text-primary hover:text-primary/80"
                  >
                    Order #{quote.orderNumber}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Max: {formatPrice(quote.maxShippingCents)}
                    {quote.sellerDeadline && ` · Deadline: ${formatDate(quote.sellerDeadline)}`}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  quote.status === 'PENALTY_APPLIED'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {quote.status === 'PENALTY_APPLIED' ? 'Penalty Applied' : 'Awaiting Quote'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expired Quotes */}
      {expiredQuotes.length > 0 && (
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h2 className="font-semibold text-gray-900">Expired Quotes</h2>
            <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {expiredQuotes.length} expired
            </span>
          </div>
          <div className="divide-y">
            {expiredQuotes.map((quote) => (
              <div key={quote.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <Link
                    href={`/my/selling/orders/${quote.orderId}`}
                    className="text-sm font-medium text-primary hover:text-primary/80"
                  >
                    Order
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Deadline: {quote.sellerDeadline ? formatDate(quote.sellerDeadline) : '—'}
                    {quote.maxShippingCents ? ` · Max: ${formatPrice(quote.maxShippingCents)}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  Expired
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ShippingProfilesClient
        profiles={profilesWithCounts}
        profileLimit={limitInfo.limit}
        currentCount={limitInfo.currentCount}
      />
    </div>
  );
}
