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
import { ImportPageClient } from '@/components/crosslister/import-page-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Import Listings | Twicely',
  robots: 'noindex',
};

export default async function ImportPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=/my/selling/crosslist/import');
  }

  if (!session.user.isSeller) {
    redirect('/my/selling/onboarding');
  }

  const userId = session.user.id;

  const [accounts, batches] = await Promise.all([
    getConnectedAccounts(userId),
    getImportBatches(userId),
  ]);

  // Find the most recent in-progress batch (if any)
  const activeBatch = batches.find((b) =>
    ['CREATED', 'FETCHING', 'DEDUPLICATING', 'TRANSFORMING', 'IMPORTING'].includes(b.status),
  ) ?? null;

  const lastCompletedBatch = batches.find((b) =>
    ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'].includes(b.status),
  ) ?? null;

  return (
    <ImportPageClient
      accounts={accounts}
      activeBatchId={activeBatch?.id ?? null}
      lastCompletedBatch={lastCompletedBatch}
    />
  );
}
