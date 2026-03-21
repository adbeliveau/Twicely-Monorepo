import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategoryBySlug, getSubcategory } from '@/lib/queries/categories';
import { searchListings } from '@twicely/search/listings';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { ListingGrid } from '@/components/shared/listing-grid';
import { PagePagination } from '@/components/shared/page-pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { SubcategoryNav } from '@/components/pages/category/subcategory-nav';
import { SortSelect } from '@/components/pages/search/sort-select';
import type { SearchFilters } from '@/types/listings';

interface SubcategoryPageProps {
  params: Promise<{ slug: string; subslug: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}

export async function generateMetadata({
  params,
}: SubcategoryPageProps): Promise<Metadata> {
  const { slug, subslug } = await params;
  const subcategory = await getSubcategory(slug, subslug);

  if (!subcategory) {
    return { title: 'Category Not Found | Twicely' };
  }

  return {
    title: `${subcategory.name} | Twicely`,
    description:
      subcategory.description ??
      `Shop ${subcategory.name} on Twicely. Find great deals on secondhand items.`,
  };
}

export default async function SubcategoryPage({
  params,
  searchParams,
}: SubcategoryPageProps) {
  const { slug: parentSlug, subslug } = await params;
  const { sort, page } = await searchParams;

  // Get both parent and subcategory
  const [parentCategory, subcategory] = await Promise.all([
    getCategoryBySlug(parentSlug),
    getSubcategory(parentSlug, subslug),
  ]);

  if (!parentCategory || !subcategory) {
    notFound();
  }

  // Build search filters for this subcategory
  const filters: SearchFilters = {
    categoryId: subcategory.id,
    sort: (sort as SearchFilters['sort']) ?? 'newest',
    page: page ? parseInt(page, 10) : 1,
    limit: 24,
  };

  const results = await searchListings(filters);

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: parentCategory.name, href: `/c/${parentSlug}` },
    { label: subcategory.name },
  ];

  // Build sibling subcategory nav items (children field contains siblings for subcategory)
  const siblingItems =
    subcategory.children?.map((sibling) => ({
      name: sibling.name,
      slug: sibling.slug,
      active: sibling.slug === subslug,
    })) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbItems} />

      {/* Category Header */}
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{subcategory.name}</h1>
        {subcategory.description && (
          <p className="mt-2 text-muted-foreground">{subcategory.description}</p>
        )}
      </div>

      {/* Sibling Subcategory Navigation */}
      {siblingItems.length > 1 && (
        <SubcategoryNav categories={siblingItems} parentSlug={parentSlug} />
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {results.totalCount.toLocaleString()} listings
        </p>
        <SortSelect currentSort={filters.sort ?? 'newest'} />
      </div>

      {/* Listings Grid */}
      {results.listings.length > 0 ? (
        <>
          <ListingGrid listings={results.listings} />
          {results.totalPages > 1 && (
            <div className="mt-4">
              <PagePagination
                currentPage={results.page}
                totalPages={results.totalPages}
              />
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title={`No listings in ${subcategory.name} yet`}
          description="Check back later or browse other categories"
          actionLabel="Browse all listings"
          actionHref="/s"
        />
      )}
    </div>
  );
}
