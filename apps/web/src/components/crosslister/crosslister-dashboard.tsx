'use client';

/**
 * CrosslisterDashboard — client wrapper composing all crosslister dashboard sub-components.
 * Source: H1.4 install prompt §2.8
 *
 * Renders:
 * - ExtensionStatusBanner (when Tier C channels exist or ?source=extension)
 * - PlatformCard per connected account
 * - QueueStatusCard
 * - PublishMeterDisplay
 * - CrosslisterOnboardingEmpty (when no accounts)
 * - "Connect more platforms" link
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlatformCard } from './platform-card';
import { QueueStatusCard } from './queue-status-card';
import { PublishMeterDisplay } from './publish-meter-display';
import { CrosslisterOnboardingEmpty } from './crosslister-onboarding-empty';
import { ExtensionStatusBanner } from './extension-status-banner';
import type { CrosslisterDashboardData } from '@/lib/queries/crosslister';
import type { QueueStatusSummary } from '@/lib/queries/crosslister';
import type { PublishAllowance } from '@twicely/crosslister/services/publish-meter';
import type { ExtensionStatusData } from '@/lib/queries/extension-status';

interface CrosslisterDashboardProps {
  dashboardData: CrosslisterDashboardData;
  queueStatus: QueueStatusSummary;
  publishAllowance: PublishAllowance;
  extensionStatus: ExtensionStatusData;
  sourceParam: string | null;
}

export function CrosslisterDashboard({
  dashboardData,
  queueStatus,
  publishAllowance,
  extensionStatus,
  sourceParam,
}: CrosslisterDashboardProps) {
  const router = useRouter();
  const { accounts } = dashboardData;
  const { hasExtension, lastHeartbeatAt, tierCAccounts } = extensionStatus;
  const tierCAccountCount = tierCAccounts.length;

  const handleImportClick = (accountId: string) => {
    router.push(`/my/selling/crosslist/import?accountId=${accountId}`);
  };

  const handleDisconnected = () => {
    router.refresh();
  };

  const handleConnected = () => {
    router.refresh();
  };

  // Show extension banner when Tier C accounts exist or extension source param is set
  const showExtensionBanner = tierCAccountCount > 0 || sourceParam === 'extension';

  return (
    <div className="space-y-6">
      {showExtensionBanner && (
        <ExtensionStatusBanner
          hasExtension={hasExtension}
          lastHeartbeatAt={lastHeartbeatAt}
          tierCAccountCount={tierCAccountCount}
          sourceParam={sourceParam}
        />
      )}

      {accounts.length === 0 ? (
        <CrosslisterOnboardingEmpty />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <PlatformCard
                key={account.id}
                account={account}
                onImportClick={handleImportClick}
                onDisconnected={handleDisconnected}
              />
            ))}
          </div>

          <div className="space-y-4">
            <QueueStatusCard status={queueStatus} />
            <PublishMeterDisplay publishAllowance={publishAllowance} />
          </div>
        </>
      )}

      <div className="pt-2 border-t">
        <Link
          href="/my/selling/crosslist/connect"
          onClick={handleConnected}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Connect more platforms
        </Link>
      </div>
    </div>
  );
}
