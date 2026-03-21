import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { ListingFormWrapper } from '@/components/pages/listing/listing-form-wrapper';
import { getMonthlyUsage } from '@/lib/services/ai-autofill-service';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create Listing | Twicely',
  robots: 'noindex',
};

export default async function NewListingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Fetch AI autofill usage if feature is enabled
  const aiEnabled = await getPlatformSetting<boolean>('ai.autofill.enabled', true);
  let aiAutofillRemaining: number | undefined;
  if (aiEnabled) {
    const usage = await getMonthlyUsage(session.user.id);
    aiAutofillRemaining = usage.remaining;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Listing</h1>
        <p className="text-muted-foreground">
          Add photos and details to list your item for sale.
        </p>
      </div>

      <ListingFormWrapper mode="create" aiAutofillRemaining={aiAutofillRemaining} />
    </div>
  );
}
