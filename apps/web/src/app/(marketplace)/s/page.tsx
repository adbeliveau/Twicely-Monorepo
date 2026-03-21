import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { searchListings } from '@twicely/search/listings';
import { getCategoryTree } from '@/lib/queries/categories';
import { getCategoryBySlug } from '@/lib/queries/categories';
import { ListingGrid } from '@/components/shared/listing-grid';
import { ListingCardSkeleton } from '@/components/shared/listing-card-skeleton';
import { PagePagination } from '@/components/shared/page-pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { SearchResultsHeader } from '@/components/pages/search/search-results-header';
import { SearchFilters } from '@/components/pages/search/search-filters';
import { ActiveFilters } from '@/components/pages/search/active-filters';
import { Button } from '@twicely/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@twicely/ui/sheet';
import type { SearchFilters as SearchFiltersType } from '@/types/listings';

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    condition?: string;
    minPrice?: string;
    maxPrice?: string;
    freeShipping?: string;
    brand?: string;
    sort?: string;
    page?: string;
  }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = params.q;

  return {
    title: query ? `Search results for "${query}" | Twicely` : 'Search | Twicely',
    robots: 'noindex',
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;

  // Get categories for the filter sidebar
  const categoryTree = await getCategoryTree();
  const filterCategories = categoryTree.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    listingCount: cat.children?.reduce((sum, c) => sum + c.listingCount, 0) ?? 0,
  }));

  // Resolve category slug to ID if present
  let categoryId: string | undefined;
  let categoryName: string | undefined;
  if (params.category) {
    const cat = await getCategoryBySlug(params.category);
    if (cat) {
      categoryId = cat.id;
      categoryName = cat.name;
    }
  }

  // Build search filters
  const filters: SearchFiltersType = {
    q: params.q,
    categoryId,
    condition: params.condition?.split(',').filter(Boolean) as SearchFiltersType['condition'],
    minPrice: params.minPrice ? parseInt(params.minPrice, 10) : undefined,
    maxPrice: params.maxPrice ? parseInt(params.maxPrice, 10) : undefined,
    freeShipping: params.freeShipping === 'true',
    brand: params.brand,
    sort: (params.sort as SearchFiltersType['sort']) ?? 'relevance',
    page: params.page ? parseInt(params.page, 10) : 1,
    limit: 24,
  };

  const results = await searchListings(filters);

  return (
    <div className="flex flex-col gap-6">
      {/* Mobile Filter Button */}
      <div className="flex items-center justify-between md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <SearchFilters categories={filterCategories} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filters */}
      <ActiveFilters categoryName={categoryName} />

      {/* Main Content */}
      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden w-[280px] shrink-0 md:block">
          <SearchFilters categories={filterCategories} />
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="mb-6">
            <SearchResultsHeader
              query={params.q ?? null}
              totalCount={results.totalCount}
              sort={filters.sort ?? 'relevance'}
            />
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            }
          >
            {results.listings.length > 0 ? (
              <>
                <ListingGrid listings={results.listings} />
                {results.totalPages > 1 && (
                  <div className="mt-8">
                    <PagePagination
                      currentPage={results.page}
                      totalPages={results.totalPages}
                    />
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                title={
                  params.q
                    ? `No results for "${params.q}"`
                    : 'No listings found'
                }
                description="Try adjusting your filters or search terms"
                actionLabel="Browse all listings"
                actionHref="/s"
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
