import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { searchListings } from '@twicely/search/listings';
import { logSearchQuery, getActiveSearchEngine } from '@twicely/search/search-engine';
import { getCategoryTree } from '@/lib/queries/categories';
import { getCategoryBySlug } from '@/lib/queries/categories';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
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
    localPickup?: string;
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
  const pageSize = await getPlatformSetting<number>('discovery.search.defaultPageSize', 48);
  const filters: SearchFiltersType = {
    q: params.q,
    categoryId,
    condition: params.condition?.split(',').filter(Boolean) as SearchFiltersType['condition'],
    minPrice: params.minPrice ? parseInt(params.minPrice, 10) : undefined,
    maxPrice: params.maxPrice ? parseInt(params.maxPrice, 10) : undefined,
    freeShipping: params.freeShipping === 'true',
    localPickup: params.localPickup === 'true',
    brand: params.brand,
    sort: (params.sort as SearchFiltersType['sort']) ?? 'relevance',
    page: params.page ? parseInt(params.page, 10) : 1,
    limit: pageSize,
  };

  const searchStart = Date.now();
  const results = await searchListings(filters);
  const searchLatencyMs = Date.now() - searchStart;

  // Fire-and-forget: log search query for analytics (Decision #143)
  const engine = await getActiveSearchEngine();
  const normalizedQuery = params.q?.toLowerCase().trim() ?? null;
  const facetUsage: Record<string, unknown> = {};
  if (params.condition) facetUsage.condition = params.condition;
  if (params.brand) facetUsage.brand = params.brand;
  if (params.freeShipping === 'true') facetUsage.freeShipping = true;
  if (params.category) facetUsage.category = params.category;
  logSearchQuery({
    queryText: params.q ?? null,
    normalizedQuery,
    resultCount: results.totalCount,
    latencyMs: searchLatencyMs,
    engine,
    facetUsageJson: facetUsage,
  });

  const deals = params.sort === 'deals';

  return (
    <div className="tw-surface tw-fullwidth min-h-screen">
      <div className="mx-auto max-w-[1584px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="tw-eyebrow">
            <span className="tw-eyebrow-dot" />
            {deals ? 'Deals' : params.q ? 'Search' : 'Browse'}
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
            {deals ? (
              <>Deals &amp; <em className="not-italic text-[var(--mg)]">Discounts</em></>
            ) : params.q ? (
              <>Results for <em className="not-italic text-[var(--mg)]">&ldquo;{params.q}&rdquo;</em></>
            ) : (
              <>All <em className="not-italic text-[var(--mg)]">Listings</em></>
            )}
          </h1>
          <p className="mt-2 text-[var(--tw-muted)] font-bold">
            {results.totalCount.toLocaleString()} results found
          </p>
        </div>

        {/* Active Filters */}
        <ActiveFilters categoryName={categoryName} />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Filters Sidebar (Desktop) */}
          <aside className="hidden lg:col-span-1 lg:block">
            <div className="tw-card-shell">
              <h2 className="mb-4 text-lg font-extrabold text-[var(--tw-black)]">
                Filters
              </h2>
              <SearchFilters categories={filterCategories} />
            </div>
          </aside>

          {/* Mobile Filter Button */}
          <div className="flex items-center justify-between lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full border-[var(--tw-border)] text-[var(--tw-black)] font-extrabold">
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

          {/* Results */}
          <div className="lg:col-span-3">
            <div className="mb-6">
              <SearchResultsHeader
                query={params.q ?? null}
                totalCount={results.totalCount}
                sort={filters.sort ?? 'relevance'}
              />
            </div>

            <Suspense
              fallback={
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
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
                <div className="tw-empty-card">
                  <Search className="mx-auto mb-4 size-16 text-[var(--tw-muted-lt)]" strokeWidth={1.5} />
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
                </div>
              )}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
