import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getSellerProfile } from '@/lib/queries/seller';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { ChevronLeft } from 'lucide-react';
import { SellerLocalSettingsForm } from '@/components/local/seller-local-settings-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Local Pickup Settings | Twicely',
  robots: 'noindex',
};

export default async function SellerLocalSettingsPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/settings/local');
  }

  if (!session.isSeller && !session.delegationId) {
    redirect('/my');
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  const [profile, defaultRadius, maxRadius] = await Promise.all([
    getSellerProfile(userId),
    getPlatformSetting<number>('commerce.local.defaultRadiusMiles', 25),
    getPlatformSetting<number>('commerce.local.maxRadiusMiles', 50),
  ]);

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Local Pickup Settings</h1>
        <p className="text-muted-foreground">
          Complete seller onboarding to access local pickup settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Link
          href="/my/selling"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Selling
        </Link>
        <h1 className="text-2xl font-bold">Local Pickup Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how far you&apos;re willing to drive for in-person meetups.
        </p>
      </div>

      <SellerLocalSettingsForm
        currentDistanceMiles={profile.maxMeetupDistanceMiles}
        defaultRadiusMiles={defaultRadius}
        maxRadiusMiles={maxRadius}
      />
    </div>
  );
}
