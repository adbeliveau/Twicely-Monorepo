import { Suspense } from 'react';
import type { UserDetailFull } from '@/lib/queries/admin-users';
import { OverviewStatCards } from './overview-stat-cards';
import { OverviewInfoCards } from './overview-info-cards';
import { OverviewStaffSection } from './overview-staff-section';
import { OverviewVerificationSection } from './overview-verification-section';
import { OverviewAddressesSection } from './overview-addresses-section';
import { OverviewAuditLog } from './overview-audit-log';

interface Props {
  user: UserDetailFull;
}

export function UserOverviewTab({ user: u }: Props) {
  return (
    <div className="space-y-6">
      <OverviewStatCards user={u} />
      <OverviewInfoCards user={u} />
      {u.seller && u.business && <OverviewStaffSection user={u} />}
      {u.seller && <OverviewVerificationSection user={u} />}
      <OverviewAddressesSection user={u} />
      <Suspense fallback={
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
          <div className="h-8 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
        </div>
      }>
        <OverviewAuditLog userId={u.id} />
      </Suspense>
    </div>
  );
}
