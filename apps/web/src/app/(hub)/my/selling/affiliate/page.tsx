import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authorize } from '@twicely/casl';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getAffiliateByUserId, getAffiliateStats, getAffiliateCommissions } from '@/lib/queries/affiliate';
import { getAffiliatePromoCodes } from '@/lib/queries/promo-codes';
import { db } from '@twicely/db';
import { user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { AffiliateSignupForm } from '@/components/affiliate/affiliate-signup-form';
import { AffiliateDashboard } from '@/components/affiliate/affiliate-dashboard';
import { AffiliatePromoCodes } from '@/components/affiliate/affiliate-promo-codes';
import { InfluencerApplicationForm } from '@/components/affiliate/influencer-application-form';
import { SellerAffiliateSettings } from '@/components/affiliate/seller-affiliate-settings';
import { sellerProfile } from '@twicely/db/schema';

export const metadata = { title: 'Affiliate Program | Twicely' };

export default async function AffiliatePage() {
  const { session } = await authorize();
  if (!session) redirect('/auth/login?callbackUrl=/my/selling/affiliate');

  if (!session.isSeller) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Affiliate Program</h1>
        <p className="text-muted-foreground">
          You need to be a seller to join the affiliate program.{' '}
          <Link href="/my/selling/onboarding" className="underline">
            Become a seller
          </Link>
        </p>
      </div>
    );
  }

  const [enabled, communityEnabled, influencerEnabled, listingLinkEnabled, platformDefaultBps, minBps, maxBps] = await Promise.all([
    getPlatformSetting('affiliate.enabled', true),
    getPlatformSetting('affiliate.community.enabled', true),
    getPlatformSetting('affiliate.influencer.enabled', true),
    getPlatformSetting('affiliate.listingLinkEnabled', true),
    getPlatformSetting<number>('affiliate.listingCommissionBps', 300),
    getPlatformSetting<number>('affiliate.listingCommissionMinBps', 200),
    getPlatformSetting<number>('affiliate.listingCommissionMaxBps', 1000),
  ]);

  if (!enabled || !communityEnabled) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Affiliate Program</h1>
        <p className="text-muted-foreground">
          The affiliate program is not currently available.
        </p>
      </div>
    );
  }

  const existingAffiliate = await getAffiliateByUserId(session.userId);

  // Fetch seller profile for affiliate opt-in settings
  const [spRow] = await db
    .select({
      affiliateOptIn: sellerProfile.affiliateOptIn,
      affiliateCommissionBps: sellerProfile.affiliateCommissionBps,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, session.userId))
    .limit(1);

  const sellerOptIn = spRow?.affiliateOptIn ?? true;
  const sellerCommissionBps = spRow?.affiliateCommissionBps ?? null;

  if (existingAffiliate) {
    const [stats, commissions, promoCodes] = await Promise.all([
      getAffiliateStats(existingAffiliate.id),
      getAffiliateCommissions(existingAffiliate.id, { limit: 5, offset: 0 }),
      getAffiliatePromoCodes(existingAffiliate.id),
    ]);

    const showInfluencerSection =
      influencerEnabled &&
      existingAffiliate.tier === 'COMMUNITY' &&
      existingAffiliate.status === 'ACTIVE';

    const isPendingInfluencer =
      existingAffiliate.tier === 'INFLUENCER' &&
      existingAffiliate.status === 'PENDING';

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Affiliate Program</h1>
        <AffiliateDashboard
          referralCode={existingAffiliate.referralCode}
          status={existingAffiliate.status}
          tier={existingAffiliate.tier}
          commissionRateBps={existingAffiliate.commissionRateBps}
          pendingBalanceCents={existingAffiliate.pendingBalanceCents}
          availableBalanceCents={existingAffiliate.availableBalanceCents}
          totalEarnedCents={existingAffiliate.totalEarnedCents}
          totalPaidCents={existingAffiliate.totalPaidCents}
          stats={stats}
          recentCommissions={commissions.rows}
        />
        <AffiliatePromoCodes
          promoCodes={promoCodes}
          isActive={existingAffiliate.status === 'ACTIVE' || existingAffiliate.status === 'PENDING'}
          affiliateId={existingAffiliate.id}
        />
        {isPendingInfluencer && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <h2 className="text-sm font-semibold text-yellow-800">Application Under Review</h2>
            <p className="mt-1 text-sm text-yellow-700">
              Your influencer application has been submitted and is being reviewed by our team.
              We will notify you once a decision has been made.
            </p>
          </div>
        )}
        {showInfluencerSection && (
          <InfluencerApplicationForm />
        )}

        {listingLinkEnabled && (
          <>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              You can generate affiliate links by visiting any listing page. Look for the
              &quot;Get Affiliate Link&quot; button next to the share button.
            </div>
            <SellerAffiliateSettings
              initialOptIn={sellerOptIn}
              initialCommissionBps={sellerCommissionBps}
              platformDefaultBps={platformDefaultBps}
              minBps={minBps}
              maxBps={maxBps}
            />
          </>
        )}
      </div>
    );
  }

  // Get username for default referral code
  const [userRow] = await db
    .select({ username: user.username })
    .from(user)
    .where(eq(user.id, session.userId))
    .limit(1);

  const defaultCode = userRow?.username?.toUpperCase() ?? '';

  const showInfluencerForNew = influencerEnabled;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Affiliate Program</h1>
      <AffiliateSignupForm defaultCode={defaultCode} />
      {showInfluencerForNew && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-semibold text-gray-700">Influencer Program</h2>
          <p className="mt-1 text-sm text-gray-600">
            Already have an audience? Apply to our influencer program for higher commission rates (20–30%)
            and a 60-day cookie window. Join the community affiliate program first, then apply.
          </p>
        </div>
      )}
    </div>
  );
}
