import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { syncAccountStatus } from '@twicely/stripe/connect';
import { getSellerProfile } from '@/lib/queries/seller';
import { getBusinessInfo } from '@/lib/queries/business-info';
import { OnboardingWizard } from './onboarding-wizard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Seller Setup | Twicely',
  robots: 'noindex',
};

interface OnboardingPageProps {
  searchParams: Promise<{ flow?: string }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/onboarding');
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  const [initialProfile, bizInfo] = await Promise.all([
    getSellerProfile(userId),
    getBusinessInfo(userId),
  ]);

  // Sync Stripe Connect status → DB before computing initialStep.
  // Without this, a seller who finished Stripe hosted onboarding and returned
  // before the account.updated webhook fires would still see the "Not Started"
  // state. syncAccountStatus is idempotent and safe to call on every load.
  let profile = initialProfile;
  if (profile?.stripeAccountId && !(profile.stripeOnboarded && profile.payoutsEnabled)) {
    try {
      await syncAccountStatus(profile.stripeAccountId);
      profile = await getSellerProfile(userId);
    } catch {
      // Non-fatal: fall back to cached DB values if Stripe is unreachable.
    }
  }

  const params = await searchParams;
  const flowParam = params.flow;
  const flow: 'activate' | 'business' =
    flowParam === 'business' ? 'business' : 'activate';

  // Determine current wizard step from existing data.
  // "Stripe done" requires BOTH details submitted AND payouts enabled — a
  // half-onboarded account still needs attention, so we should land on step 2.
  const hasBusinessInfo = !!bizInfo;
  const hasStripe = !!(profile?.stripeOnboarded && profile?.payoutsEnabled);
  const hasStoreName = !!(profile?.storeName && profile?.storeSlug);

  let initialStep: 1 | 2 | 3 | 4;
  if (!hasBusinessInfo) {
    initialStep = 1;
  } else if (!hasStripe) {
    initialStep = 2;
  } else if (!hasStoreName) {
    initialStep = 3;
  } else {
    initialStep = 4;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <OnboardingWizard
        flow={flow}
        isSeller={session.isSeller}
        initialStep={initialStep}
        businessInfo={bizInfo}
        stripeOnboarded={profile?.stripeOnboarded ?? false}
        payoutsEnabled={profile?.payoutsEnabled ?? false}
        storeName={profile?.storeName ?? null}
        storeSlug={profile?.storeSlug ?? null}
      />
    </div>
  );
}
