/**
 * Crosslister dashboard — /my/selling/crosslist
 * Page Registry Route #57: SELLER or DELEGATE(crosslister.read)
 * Source: H1.4 install prompt §2.1, §2.7; F1.3, F3 install prompts
 */

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl/authorize';
import { getCrosslisterDashboardData, getSellerQueueStatus } from '@/lib/queries/crosslister';
import { getPublishAllowance } from '@twicely/crosslister/services/publish-meter';
import { getExtensionStatus } from '@/lib/queries/extension-status';
import { CrosslisterDashboard } from '@/components/crosslister/crosslister-dashboard';
import { Skeleton } from '@twicely/ui/skeleton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Crosslister | Twicely',
  robots: 'noindex',
};

interface CrosslisterDashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function CrosslisterSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-full rounded-md" />
      <Skeleton className="h-6 w-2/3 rounded-md" />
    </div>
  );
}

export default async function CrosslisterDashboardPage({
  searchParams,
}: CrosslisterDashboardPageProps) {
  const { ability, session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/crosslist');
  }

  if (!ability.can('read', 'CrosslisterAccount')) {
    redirect('/my');
  }

  // Resolve userId: delegates act on behalf of the seller they represent
  const userId =
    session.delegationId && session.onBehalfOfSellerId
      ? session.onBehalfOfSellerId
      : session.userId;

  const resolvedSearchParams = await searchParams;
  const sourceRaw = resolvedSearchParams['source'];
  const sourceParam = typeof sourceRaw === 'string' ? sourceRaw : null;

  const [dashboardData, queueStatus, publishAllowance, extensionStatus] = await Promise.all([
    getCrosslisterDashboardData(userId),
    getSellerQueueStatus(userId),
    getPublishAllowance(userId),
    getExtensionStatus(userId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Crosslister</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your connected platforms and crosslisted items.
          </p>
        </div>
      </div>

      <Suspense fallback={<CrosslisterSkeleton />}>
        <CrosslisterDashboard
          dashboardData={dashboardData}
          queueStatus={queueStatus}
          publishAllowance={publishAllowance}
          extensionStatus={extensionStatus}
          sourceParam={sourceParam}
        />
      </Suspense>
    </div>
  );
}
