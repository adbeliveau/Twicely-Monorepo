import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { user as userTable } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getAccountDeletionBlockers } from '@/lib/actions/account-deletion';
import { getMyDataExportRequests } from '@/lib/actions/data-export';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { DataExportSection } from '@/components/pages/privacy/data-export-section';
import { AccountDeletionSection } from '@/components/pages/privacy/account-deletion-section';
import { MarketingPreferences } from '@/components/pages/privacy/marketing-preferences';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Privacy | Twicely',
  robots: 'noindex',
};

export default async function PrivacySettingsPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/settings/privacy');
  }

  const [userRow, blockers, exportRequests, gracePeriodDays, exportFormats] =
    await Promise.all([
      db
        .select({
          marketingOptIn: userTable.marketingOptIn,
          deletionRequestedAt: userTable.deletionRequestedAt,
        })
        .from(userTable)
        .where(eq(userTable.id, session.userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      getAccountDeletionBlockers(),
      getMyDataExportRequests(),
      getPlatformSetting<number>('privacy.gdpr.deletionGracePeriodDays', 30),
      getPlatformSetting<string[]>('privacy.gdpr.exportFormats', ['json', 'csv']),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Privacy &amp; Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your privacy preferences, data exports, and account deletion.
        </p>
      </div>

      <DataExportSection
        initialRequests={exportRequests}
        exportFormats={exportFormats}
      />

      <MarketingPreferences initialOptIn={userRow?.marketingOptIn ?? false} />

      <AccountDeletionSection
        deletionRequestedAt={userRow?.deletionRequestedAt ?? null}
        blockers={blockers}
        gracePeriodDays={gracePeriodDays}
      />
    </div>
  );
}
