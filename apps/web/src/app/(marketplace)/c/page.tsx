import type { Metadata } from 'next';
import { getHomepageCategories } from '@/lib/queries/homepage';
import { CategoryCard } from '@/components/shared/category-card';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';

export const metadata: Metadata = {
  title: 'All Categories | Twicely',
  description:
    'Browse all categories on Twicely. Find great deals on secondhand items across every category.',
  alternates: { canonical: 'https://twicely.co/c' },
  openGraph: {
    title: 'All Categories | Twicely',
    description:
      'Browse all categories on Twicely. Find great deals on secondhand items across every category.',
    url: 'https://twicely.co/c',
    siteName: 'Twicely',
    type: 'website',
  },
};

export default async function CategoriesIndexPage() {
  const categories = await getHomepageCategories();

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Categories' }]} />

      <div>
        <div className="tw-eyebrow">
          <span className="tw-eyebrow-dot" />
          Shop by category
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
          All <em className="not-italic text-[var(--mg)]">categories</em>
        </h1>
        <p className="mt-2 text-[17px] text-[var(--tw-muted)]">
          Browse {categories.length} categories on Twicely
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.id}
            name={cat.name}
            slug={cat.slug}
            listingCount={cat.listingCount}
          />
        ))}
      </div>
    </div>
  );
}
