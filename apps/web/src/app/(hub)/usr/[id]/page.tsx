// NAV_ENTRY: { label: 'Users', href: '/usr', icon: 'Users', roles: ['ADMIN', 'SUPPORT'] }

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminUserDetail } from '@/lib/queries/admin-users';
import {
  getAdminUserOrders, getAdminUserListings, getAdminUserCases,
  getAdminUserFinance, getAdminUserActivity, getAdminUserNotes,
} from '@/lib/queries/admin-user-tabs';
import { UserDetailHeader, UserInfoBar } from '@/components/admin/user-detail/user-detail-header';
import { UserActionsDropdown } from '@/components/admin/user-detail/user-actions-dropdown';
import { UserDetailTabs } from '@/components/admin/user-detail/user-detail-tabs';
import { UserOverviewTab } from '@/components/admin/user-detail/user-overview-tab';
import { UserOrdersTab } from '@/components/admin/user-detail/user-orders-tab';
import { UserListingsTab } from '@/components/admin/user-detail/user-listings-tab';
import { UserCasesTab } from '@/components/admin/user-detail/user-cases-tab';
import { UserFinanceTab } from '@/components/admin/user-detail/user-finance-tab';
import { UserActivityTab } from '@/components/admin/user-detail/user-activity-tab';
import { UserNotesTab } from '@/components/admin/user-detail/user-notes-tab';

export const metadata: Metadata = { title: 'User Detail | Twicely Hub' };

type Tab = 'overview' | 'orders' | 'listings' | 'cases' | 'finance' | 'activity' | 'notes';

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; orderPage?: string; listPage?: string }>;
}) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('read', 'User')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const sp = await searchParams;
  const tab = (sp.tab ?? 'overview') as Tab;
  const orderPage = Math.max(1, parseInt(sp.orderPage ?? '1', 10));
  const listPage = Math.max(1, parseInt(sp.listPage ?? '1', 10));

  const userDetail = await getAdminUserDetail(id);
  if (!userDetail) notFound();

  const canViewFinance = ability.can('read', 'Payout');
  const canViewNotes = ability.can('update', 'User');
  const canUpdateUser = ability.can('update', 'User');
  const canUpdateSeller = ability.can('update', 'SellerProfile');

  // Fetch only the active tab's data
  let tabContent: React.ReactNode = null;

  if (tab === 'overview') {
    tabContent = <UserOverviewTab user={userDetail} />;
  } else if (tab === 'orders') {
    const data = await getAdminUserOrders(id, orderPage, 20);
    tabContent = <UserOrdersTab userId={id} orders={data.orders} total={data.total} page={orderPage} />;
  } else if (tab === 'listings') {
    const data = await getAdminUserListings(id, listPage, 20);
    tabContent = <UserListingsTab userId={id} listings={data.listings} total={data.total} page={listPage} />;
  } else if (tab === 'cases') {
    const cases = await getAdminUserCases(id);
    tabContent = <UserCasesTab cases={cases} />;
  } else if (tab === 'finance' && canViewFinance) {
    const data = await getAdminUserFinance(id);
    tabContent = <UserFinanceTab balance={data.balance} payouts={data.payouts} ledgerEntries={data.ledgerEntries} />;
  } else if (tab === 'activity') {
    const events = await getAdminUserActivity(id);
    tabContent = <UserActivityTab events={events} />;
  } else if (tab === 'notes' && canViewNotes) {
    const allEvents = await getAdminUserNotes(id);
    const notes = allEvents.filter((e) => e.action === 'ADMIN_NOTE');
    tabContent = <UserNotesTab userId={id} notes={notes} />;
  } else {
    tabContent = <UserOverviewTab user={userDetail} />;
  }

  void session; // session available for future use

  return (
    <div className="p-6">
      <UserDetailHeader
        user={userDetail}
        actions={
          <UserActionsDropdown
            userId={id}
            isBanned={userDetail.isBanned}
            canImpersonate={ability.can('impersonate', 'User')}
            isSeller={userDetail.isSeller}
            payoutsEnabled={userDetail.seller?.payoutsEnabled ?? false}
            currentBand={userDetail.seller?.performanceBand}
            canUpdateUser={canUpdateUser}
            canUpdateSeller={canUpdateSeller}
          />
        }
      />

      <UserInfoBar user={userDetail} />

      <Suspense fallback={<div className="h-10 animate-pulse rounded bg-gray-100" />}>
        <UserDetailTabs
          userId={id}
          canViewFinance={canViewFinance}
          canViewNotes={canViewNotes}
        />
      </Suspense>

      <div className="mt-6">{tabContent}</div>
    </div>
  );
}
