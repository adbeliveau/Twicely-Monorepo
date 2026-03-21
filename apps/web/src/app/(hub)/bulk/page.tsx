import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getBulkListingSummary, getBulkListings, getBulkUserSummary, getBulkUsers } from '@/lib/queries/admin-data-bulk';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BulkListingPanel } from '@/components/admin/bulk-listing-panel';
import { BulkUserPanel } from '@/components/admin/bulk-user-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';

export const metadata: Metadata = {
  title: 'Bulk Operations | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function BulkOperationsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [listingSummary, userSummary, listingData, userData] = await Promise.all([
    getBulkListingSummary(),
    getBulkUserSummary(),
    getBulkListings({ page: 1, pageSize: 50 }),
    getBulkUsers({ page: 1, pageSize: 50 }),
  ]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Bulk Operations"
        description="Apply status changes across multiple listings or users at once."
      />

      {/* Listing stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{listingSummary.totalListings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{listingSummary.activeListings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{listingSummary.draftListings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Removed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{listingSummary.removedListings}</p>
          </CardContent>
        </Card>
      </div>

      <BulkListingPanel
        initialListings={listingData.listings}
        initialTotal={listingData.total}
        summary={listingSummary}
      />

      {/* User stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{userSummary.totalUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{userSummary.activeUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Banned Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{userSummary.bannedUsers}</p>
          </CardContent>
        </Card>
      </div>

      <BulkUserPanel
        initialUsers={userData.users}
        initialTotal={userData.total}
        summary={userSummary}
      />
    </div>
  );
}
