import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getSellerShippingProfiles, getShippingProfileListingCount, getShippingProfileLimit } from '@/lib/queries/shipping-profiles';
import { ShippingProfilesClient } from './shipping-profiles-client';

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

  // Fetch shipping profiles and limit info
  const [profiles, limitInfo] = await Promise.all([
    getSellerShippingProfiles(session.user.id),
    getShippingProfileLimit(session.user.id),
  ]);

  // Fetch listing counts for each profile
  const profilesWithCounts = await Promise.all(
    profiles.map(async (profile) => ({
      ...profile,
      listingCount: await getShippingProfileListingCount(profile.id),
    }))
  );

  return (
    <ShippingProfilesClient
      profiles={profilesWithCounts}
      profileLimit={limitInfo.limit}
      currentCount={limitInfo.currentCount}
    />
  );
}
