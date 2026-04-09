import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getBulkListingSummary, getBulkListings } from '@/lib/queries/admin-data-bulk';
import { getActiveBoostedListingIds } from '@/lib/queries/boosting';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BulkListingPanel } from '@/components/admin/bulk-listing-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';

export const metadata: Metadata = {
  title: 'Listings Admin | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function ListingsAdminPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Listing')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [summary, listingData] = await Promise.all([
    getBulkListingSummary(),
    getBulkListings({ page: 1, pageSize: 50 }),
  ]);

  const listingIds = listingData.listings.map((l) => l.id);
  const boostedMap = await getActiveBoostedListingIds(listingIds);
  const boostedCount = boostedMap.size;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Listings Admin"
        description="Browse all listings, search, and perform bulk actions."
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalListings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.activeListings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.draftListings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Removed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.removedListings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Boosted (page 1)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{boostedCount}</p>
          </CardContent>
        </Card>
      </div>

      <BulkListingPanel
        initialListings={listingData.listings}
        initialTotal={listingData.total}
        summary={summary}
      />
    </div>
  );
}
