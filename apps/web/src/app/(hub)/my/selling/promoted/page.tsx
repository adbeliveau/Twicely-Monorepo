import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getSellerPromotedListings } from '@/lib/queries/boosting';
import { getSellerInfoForGates } from '@/lib/queries/storefront';
import { canUseFeature, getMinTierForFeature } from '@twicely/utils/tier-gates';
import { TierGateCTA } from '@/components/storefront/tier-gate-cta';
import { PromotedListClient } from './promoted-list-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Promoted Listings | Twicely',
  robots: 'noindex',
};

export default async function PromotedListingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/auth/login');

  const userId = session.user.id;
  const gates = await getSellerInfoForGates(userId);
  const storeTier = gates?.storeTier ?? 'NONE';

  if (!canUseFeature(storeTier, 'boosting')) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Promoted Listings</h1>
          <p className="text-muted-foreground">
            Boost your listings to reach more buyers.
          </p>
        </div>
        <div className="relative rounded-lg border p-8">
          <TierGateCTA
            feature="boosting"
            requiredTier={getMinTierForFeature('boosting')}
            currentTier={storeTier}
          />
        </div>
      </div>
    );
  }

  const promotedListings = await getSellerPromotedListings(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Promoted Listings</h1>
        <p className="text-muted-foreground">
          Boost your listings to appear higher in search results. You only pay when you make a sale.
        </p>
      </div>

      <PromotedListClient promotedListings={promotedListings} />
    </div>
  );
}
