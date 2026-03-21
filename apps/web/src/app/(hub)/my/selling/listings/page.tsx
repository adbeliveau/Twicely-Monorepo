import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getSellerListings, getSellerListingCounts } from '@/lib/queries/seller-listings';
import { ListingsTable } from '@/components/pages/selling/listings-table';
import { Button } from '@twicely/ui/button';
import { Plus } from 'lucide-react';
import type { ListingStatus } from '@/lib/queries/seller-listings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Listings | Twicely',
  robots: 'noindex',
};

interface ListingsPageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
  }>;
}

const VALID_STATUSES: ListingStatus[] = ['ACTIVE', 'DRAFT', 'PAUSED', 'SOLD', 'ENDED'];

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  const userId = session.user.id;

  const params = await searchParams;

  // Parse and validate status param
  const statusParam = params.status?.toUpperCase();
  const status = VALID_STATUSES.includes(statusParam as ListingStatus)
    ? (statusParam as ListingStatus)
    : null;

  // Parse search param
  const search = params.search?.trim() ?? '';

  // Parse page param
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  // Fetch data in parallel
  const [listingsResult, counts] = await Promise.all([
    getSellerListings(userId, { status: status ?? undefined, search: search || undefined, page }),
    getSellerListingCounts(userId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Listings</h1>
          <p className="text-muted-foreground">
            Manage your listings and track their status.
          </p>
        </div>
        <Button asChild>
          <Link href="/my/selling/listings/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Listing
          </Link>
        </Button>
      </div>

      <ListingsTable
        listings={listingsResult.listings}
        counts={counts}
        currentStatus={status}
        currentSearch={search}
        page={listingsResult.page}
        totalPages={listingsResult.totalPages}
      />
    </div>
  );
}
