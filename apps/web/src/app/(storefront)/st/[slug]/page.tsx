import { cache } from 'react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@twicely/auth';
import { getStorefrontBySlug } from '@/lib/queries/storefront';
import { FeaturedRow } from '@/components/storefront/featured-row';
import { ListingGridCard } from '@/components/storefront/listing-grid-card';
import { ListingListCard } from '@/components/storefront/listing-list-card';
import { ViewToggle } from '@/components/storefront/view-toggle';
import { SortSelect } from '@/components/storefront/sort-select';
import { PagePagination } from '@/components/shared/page-pagination';

const getCachedStorefront = cache(getStorefrontBySlug);

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    sort?: string;
    view?: string;
    q?: string;
  }>;
}

export default async function StorefrontShopPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam, sort, view, q } = await searchParams;

  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const sortBy = (sort === 'price_low' || sort === 'price_high') ? sort : 'newest';
  const viewMode = view === 'list' ? 'list' : 'grid';
  const searchQuery = q?.trim() || undefined;

  const session = await auth.api.getSession({ headers: await headers() });
  const currentUserId = session?.user?.id ?? null;

  const data = await getCachedStorefront(slug, { page, pageSize: 24, sortBy, searchQuery });
  if (!data) return null; // layout handles notFound

  const isOwnStore = currentUserId === data.seller.userId;
  const accentColor = data.seller.branding.accentColor ?? '#7C3AED';

  return (
    <div className="space-y-6">
      {/* Featured items */}
      {data.featuredListings.length > 0 && (
        <FeaturedRow listings={data.featuredListings} accentColor={accentColor} />
      )}

      {/* Toolbar: Sort + View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {data.totalListings} {data.totalListings === 1 ? 'item' : 'items'}
          </span>
          <SortSelect />
        </div>
        <ViewToggle defaultView={data.seller.branding.defaultStoreView === 'list' ? 'list' : 'grid'} />
      </div>

      {/* Listings grid/list */}
      {data.listings.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-500">
            {searchQuery
              ? `No items found for "${searchQuery}".`
              : isOwnStore
                ? "You haven't listed any items yet."
                : 'This seller has no active listings.'}
          </p>
          {searchQuery ? (
            <Link
              href={`/st/${slug}`}
              className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              Clear search
            </Link>
          ) : isOwnStore ? (
            <Link
              href="/my/selling/listings/new"
              className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              Create your first listing
            </Link>
          ) : null}
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex flex-col gap-3">
          {data.listings.map((listing) => (
            <ListingListCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {data.listings.map((listing) => (
            <ListingGridCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <PagePagination currentPage={data.page} totalPages={data.totalPages} />
      )}
    </div>
  );
}
