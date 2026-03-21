/**
 * Import issues page — /my/selling/crosslist/import/issues
 * Page Registry Row 59: SELLER or DELEGATE(crosslister.import)
 * Source: F1.3 install prompt §2.9 Page 4
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getImportBatches, getImportRecords } from '@/lib/queries/crosslister';
import { ImportIssuesTable } from '@/components/crosslister/import-issues-table';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Import Issues | Twicely',
  robots: 'noindex',
};

export default async function ImportIssuesPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=/my/selling/crosslist/import/issues');
  }

  if (!session.user.isSeller) {
    redirect('/my/selling/onboarding');
  }

  const userId = session.user.id;

  // Get the most recent batch for this seller
  const batches = await getImportBatches(userId);
  const latestBatch = batches[0] ?? null;

  const { records } = latestBatch
    ? await getImportRecords(latestBatch.id, userId, { status: 'failed' })
    : { records: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/my/selling/crosslist/import"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          Import
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Import Issues</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {records.length > 0
            ? `${records.length} listing${records.length !== 1 ? 's' : ''} could not be imported. You can retry each item after fixing the issue.`
            : 'No import issues to display.'}
        </p>
      </div>

      {latestBatch && (
        <div className="text-xs text-muted-foreground">
          Import batch from {new Date(latestBatch.createdAt).toLocaleDateString()}
          {' · '}
          {latestBatch.createdItems} created, {latestBatch.failedItems} failed
        </div>
      )}

      <ImportIssuesTable records={records} />
    </div>
  );
}
