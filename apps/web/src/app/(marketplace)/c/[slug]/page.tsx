import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getCategoryBySlug } from '@/lib/queries/categories';
import { searchListings } from '@twicely/search/listings';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { ListingGrid } from '@/components/shared/listing-grid';
import { PagePagination } from '@/components/shared/page-pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { SubcategoryNav } from '@/components/pages/category/subcategory-nav';
import { SortSelect } from '@/components/pages/search/sort-select';
import { SetAlertButton } from '@/components/category/set-alert-button';
import type { SearchFilters } from '@/types/listings';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string; action?: string }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return { title: 'Category Not Found | Twicely' };
  }

  const title = `${category.name} | Twicely`;
  const description =
    category.description ??
    `Shop ${category.name} on Twicely. Find great deals on secondhand items.`;
  const canonicalUrl = `https://twicely.co/c/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Twicely',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const { sort, page, action } = await searchParams;

  // Run auth and category lookup in parallel (independent)
  const [session, category] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getCategoryBySlug(slug),
  ]);

  const isLoggedIn = !!session?.user?.id;
  const autoSetAlert = action === 'alert';

  if (!category) {
    notFound();
  }

  // Build search filters for this category
  const filters: SearchFilters = {
    categoryId: category.id,
    sort: (sort as SearchFilters['sort']) ?? 'newest',
    page: page ? parseInt(page, 10) : 1,
    limit: 24,
  };

  const results = await searchListings(filters);

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: category.name },
  ];

  // Build subcategory nav items
  const subcategoryItems =
    category.children?.map((child) => ({
      name: child.name,
      slug: child.slug,
      active: false,
    })) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbItems} />

      {/* Category Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="tw-eyebrow">
            <span className="tw-eyebrow-dot" />
            Category
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
            <em className="not-italic text-[var(--mg)]">{category.name}</em>
          </h1>
          {category.description && (
            <p className="mt-2 text-[17px] text-[var(--tw-muted)]">{category.description}</p>
          )}
        </div>
        <SetAlertButton
          categoryId={category.id}
          categoryName={category.name}
          categorySlug={slug}
          isLoggedIn={isLoggedIn}
          autoSetAlert={autoSetAlert}
        />
      </div>

      {/* Subcategory Navigation */}
      {subcategoryItems.length > 0 && (
        <SubcategoryNav categories={subcategoryItems} parentSlug={slug} />
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--tw-muted)]">
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
          title={`No listings in ${category.name} yet`}
          description="Check back later or browse other categories"
          actionLabel="Browse all listings"
          actionHref="/s"
        />
      )}
    </div>
  );
}
