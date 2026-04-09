/**
 * Import progress page — /my/selling/crosslist/import
 * Page Registry Row 58: SELLER or DELEGATE(crosslister.import)
 * Source: F1.3 install prompt §2.9 Page 3
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getConnectedAccounts, getImportBatches } from '@/lib/queries/crosslister';
import { getImportOnboardingState } from '@/lib/queries/import-onboarding';
import { ImportPageClient } from '@/components/crosslister/import-page-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Import Listings | Twicely',
  robots: 'noindex',
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ImportPage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=/my/selling/crosslist/import');
  }

  if (!session.user.isSeller) {
    redirect('/my/selling/onboarding');
  }

  const userId = session.user.id;
  const params = await searchParams;
  const initialAccountId = params['accountId'] ?? null;

  const [accounts, batches, onboardingState] = await Promise.all([
    getConnectedAccounts(userId),
    getImportBatches(userId),
    getImportOnboardingState(userId),
  ]);

  // Find the most recent in-progress batch (if any)
  const activeBatch = batches.find((b) =>
    ['CREATED', 'FETCHING', 'DEDUPLICATING', 'TRANSFORMING', 'IMPORTING'].includes(b.status),
  ) ?? null;

  const lastCompletedBatch = batches.find((b) =>
    ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'].includes(b.status),
  ) ?? null;

  const isFirstTimeUser = !onboardingState.hasConnectedAccounts || !onboardingState.hasCompletedImport;

  return (
    <div className="space-y-4">
      {isFirstTimeUser && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-blue-900">
            {onboardingState.hasConnectedAccounts
              ? 'Complete your first import'
              : 'Connect a platform to import listings'}
          </p>
          <p className="text-xs text-blue-700">
            Lister tier: <span className="font-medium">{onboardingState.listerTier}</span>
            {onboardingState.connectedChannels.length > 0 && (
              <> · Connected: {onboardingState.connectedChannels.join(', ')}</>
            )}
          </p>
        </div>
      )}
      <ImportPageClient
        accounts={accounts}
        activeBatchId={activeBatch?.id ?? null}
        lastCompletedBatch={lastCompletedBatch}
        initialAccountId={initialAccountId}
      />
    </div>
  );
}
