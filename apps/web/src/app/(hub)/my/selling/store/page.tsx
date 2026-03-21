import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import {
  getStorefrontForOwner,
  getSellerInfoForGates,
  getActiveListingsForPicker,
} from '@/lib/queries/storefront';
import { getUnfulfilledOrderCount, getSellerPendingOffersCount } from '@/lib/queries/vacation';
import { StoreSettingsForm } from '@/components/storefront/store-settings-form';
import { PublishToggle } from '@/components/storefront/publish-toggle';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';
import { VerifiedSellerSection } from '@/components/seller/verified-seller-section';
import { getSellerVerificationStatus } from '@/lib/queries/authentication';
import { VacationSettings } from '@/components/storefront/vacation-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Store Settings | Twicely',
  robots: 'noindex',
};

export default async function StoreSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/auth/login');

  const userId = session.user.id;
  const sellerInfo = await getSellerInfoForGates(userId);

  // Gate: Must be a BUSINESS seller
  if (!sellerInfo || sellerInfo.sellerType !== 'BUSINESS') {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader>
          <CardTitle>Business Account Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Store settings are available for business sellers.</p>
          <Button asChild><Link href="/my/selling/onboarding">Upgrade to Business</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const [storefront, availableListings, verificationStatus, unfulfilledOrderCount, pendingOffersCount] =
    await Promise.all([
      getStorefrontForOwner(userId),
      getActiveListingsForPicker(userId),
      getSellerVerificationStatus(userId),
      getUnfulfilledOrderCount(userId),
      getSellerPendingOffersCount(userId),
    ]);

  if (!storefront) redirect('/my/selling');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Customize your storefront appearance and settings.
          </p>
        </div>
        <PublishToggle
          isPublished={storefront.branding.isStorePublished}
          sellerType={sellerInfo.sellerType}
          storeName={storefront.storeName}
          storeSlug={storefront.storeSlug}
          activeListingCount={availableListings.length}
        />
      </div>

      <VerifiedSellerSection isAuthenticatedSeller={verificationStatus.isVerified} />

      <VacationSettings
        vacationMode={storefront.vacationMode}
        vacationModeType={storefront.vacationModeType}
        vacationMessage={storefront.vacationMessage}
        vacationAutoReplyMessage={storefront.vacationAutoReplyMessage}
        vacationStartAt={storefront.vacationStartAt}
        vacationEndAt={storefront.vacationEndAt}
        unfulfilledOrderCount={unfulfilledOrderCount}
        pendingOffersCount={pendingOffersCount}
      />

      <StoreSettingsForm
        storefront={{
          storeName: storefront.storeName,
          storeSlug: storefront.storeSlug,
          storeDescription: storefront.storeDescription,
          returnPolicy: storefront.returnPolicy,
          bannerUrl: storefront.branding.bannerUrl,
          logoUrl: storefront.branding.logoUrl,
          accentColor: storefront.branding.accentColor,
          announcement: storefront.branding.announcement,
          aboutHtml: storefront.branding.aboutHtml,
          socialLinks: storefront.branding.socialLinks,
          featuredListingIds: storefront.branding.featuredListingIds,
          isStorePublished: storefront.branding.isStorePublished,
          defaultStoreView: storefront.branding.defaultStoreView,
        }}
        categories={storefront.customCategories}
        availableListings={availableListings}
        storeTier={sellerInfo.storeTier}
      />
    </div>
  );
}
