/**
 * D3-S3: Subscription Management Page
 * F4-S4: Lister snapshot wired in
 *
 * Route: /my/selling/subscription (Page Registry #68)
 * Gate: OWNER_ONLY — must be authenticated seller
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@twicely/auth';
import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import {
  getSellerProfileIdByUserId,
  getSubscriptionSnapshot,
} from '@/lib/queries/subscriptions';
import { getListerSubscriptionSnapshot } from '@/lib/queries/lister-subscription';
import { SubscriptionOverview } from '@/components/subscription/subscription-overview';
import { ListerSubscriptionCard } from '@/components/subscription/lister-subscription-card';

export const metadata = { title: 'Subscription | Twicely' };

export default async function SubscriptionPage() {
  // 1. Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/auth/login');

  // 2. Get seller profile
  const sellerProfileId = await getSellerProfileIdByUserId(session.user.id);
  if (!sellerProfileId) redirect('/my');

  // 3. Load subscription snapshot
  const snapshot = await getSubscriptionSnapshot(sellerProfileId);
  if (!snapshot) redirect('/my');

  // 4. Load seller profile for business status check (lightweight query)
  const [profile] = await db
    .select({
      sellerType: sellerProfile.sellerType,
      stripeAccountId: sellerProfile.stripeAccountId,
      stripeOnboarded: sellerProfile.stripeOnboarded,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);

  if (!profile) redirect('/my');

  // 5. Load lister subscription snapshot
  const listerSnapshot = await getListerSubscriptionSnapshot(session.user.id);

  // 6. Render
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Subscription</h1>
        <p className="text-muted-foreground mt-1">
          Manage your Store, Crosslister, Finance, and Automation subscriptions.
        </p>
      </div>
      <SubscriptionOverview
        snapshot={snapshot}
        sellerType={profile.sellerType}
        hasStripeConnect={!!profile.stripeAccountId && profile.stripeOnboarded}
      />
      <ListerSubscriptionCard snapshot={listerSnapshot} />
    </div>
  );
}
