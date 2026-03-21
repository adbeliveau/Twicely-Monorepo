import { cache } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getStorefrontBySlug } from '@/lib/queries/storefront';
import { ListingGridCard } from '@/components/storefront/listing-grid-card';
import { ListingListCard } from '@/components/storefront/listing-list-card';
import { ViewToggle } from '@/components/storefront/view-toggle';
import { SortSelect } from '@/components/storefront/sort-select';
import { PagePagination } from '@/components/shared/page-pagination';

const getCachedStorefront = cache(getStorefrontBySlug);

interface PageProps {
  params: Promise<{ slug: string; category: string }>;
  searchParams: Promise<{ page?: string; sort?: string; view?: string }>;
}

export default async function StorefrontCategoryPage({ params, searchParams }: PageProps) {
  const { slug, category: categorySlug } = await params;
  const { page: pageParam, sort, view } = await searchParams;

  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const sortBy = (sort === 'price_low' || sort === 'price_high') ? sort : 'newest';
  const viewMode = view === 'list' ? 'list' : 'grid';

  const data = await getCachedStorefront(slug, { page, pageSize: 24, sortBy, categorySlug });
  if (!data) return null; // layout handles notFound

  // Find category name for title
  const matchedCategory = data.customCategories.find((c) => c.slug === categorySlug);
  const categoryName = matchedCategory?.name ?? categorySlug;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={`/st/${slug}`}
          className="flex items-center gap-1 text-gray-600 hover:text-violet-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to all items
        </Link>
      </div>

      {/* Category Title */}
      <h2 className="text-xl font-bold text-gray-900">{categoryName}</h2>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {data.totalListings} {data.totalListings === 1 ? 'item' : 'items'}
          </span>
          <SortSelect />
        </div>
        <ViewToggle defaultView="grid" />
      </div>

      {/* Listings */}
      {data.listings.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-500">No items found in this category.</p>
          <Link
            href={`/st/${slug}`}
            className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            Browse all items
          </Link>
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex flex-col gap-3">
          {data.listings.map((listing) => (
            <ListingListCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 md:gap-6">
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
