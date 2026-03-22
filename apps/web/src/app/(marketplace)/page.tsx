import { Suspense } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { CategoryCard } from '@/components/shared/category-card';
import { ListingGrid } from '@/components/shared/listing-grid';
import { RecentlyViewedCarousel } from '@/components/listing/recently-viewed-carousel';
import { getRecentListings, getHomepageCategories } from '@/lib/queries/homepage';
import { getRecentlyViewed } from '@/lib/queries/browsing-history';
import {
  getTrendingListings,
  getStaffPickCollections,
  getSeasonalCollections,
  getRisingSellers,
  getExplorePromotedListings,
} from '@/lib/queries/explore';
import { getForYouFeed } from '@/lib/queries/feed';
import { auth } from '@twicely/auth';
import { HomeTabs } from '@/components/pages/home/home-tabs';
import { NewsletterSignup } from '@/components/shared/newsletter-signup';
import { HomepageHero } from '@/components/pages/home/homepage-hero';
import { HomepageCategoryRow } from '@/components/pages/home/homepage-category-row';
import { HomepageTrustBar } from '@/components/pages/home/homepage-trust-bar';
import { HomepageSellerSpotlight } from '@/components/pages/home/homepage-seller-spotlight';

export const metadata: Metadata = {
  title: 'Twicely — Buy & Sell Secondhand',
  description:
    'The marketplace with built-in seller tools. Buy and sell secondhand items easily.',
};

const TRENDING_SEARCHES = [
  { label: 'Nike Dunks', query: 'Nike Dunks' },
  { label: 'iPhone 15', query: 'iPhone 15' },
  { label: "Vintage Levi's", query: "Vintage Levi's" },
  { label: 'PS5', query: 'PS5' },
  { label: 'Air Jordan', query: 'Air Jordan' },
  { label: 'Birkin', query: 'Birkin' },
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://twicely.co';

/* -- Async sections -- */

async function RecentlyViewedSection() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  const items = await getRecentlyViewed(session.user.id);
  if (items.length === 0) return null;
  return <RecentlyViewedCarousel items={items} />;
}

/* -- Skeleton fallback -- */

function CardSkeleton({ count, columns }: { count: number; columns: string }) {
  return (
    <section aria-busy="true" aria-label="Loading listings">
      <div className="mb-6 h-7 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className={`grid gap-4 ${columns}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="aspect-square rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    </section>
  );
}

/* -- Categories tab content -- */

async function CategoriesTabContent() {
  const [categories, recentListings] = await Promise.all([
    getHomepageCategories(),
    getRecentListings(12),
  ]);
  const featuredPicks = [...recentListings].reverse().slice(0, 6);

  return (
    <div className="space-y-12">
      {categories.length > 0 && (
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[22px] font-bold text-gray-900 dark:text-white">Shop by category</h2>
            <Link href="/s" className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {categories.map((cat) => (
              <CategoryCard key={cat.id} name={cat.name} slug={cat.slug} listingCount={cat.listingCount} />
            ))}
          </div>
        </section>
      )}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-[22px] font-bold text-gray-900 dark:text-white">Recently listed</h2>
          <Link href="/s?sort=newest" className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400">
            View all
          </Link>
        </div>
        <ListingGrid listings={recentListings} emptyMessage="No listings yet" />
      </section>
      {featuredPicks.length > 0 && (
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[22px] font-bold text-gray-900 dark:text-white">Featured picks</h2>
            <Link href="/s" className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400">
              Explore more
            </Link>
          </div>
          <ListingGrid listings={featuredPicks} emptyMessage="No featured items" />
        </section>
      )}
    </div>
  );
}

/* -- Category row data fetcher -- */

async function CategoryRowSection() {
  const categories = await getHomepageCategories();
  if (categories.length === 0) return null;
  return <HomepageCategoryRow categories={categories} />;
}

/* -- Tab data fetcher -- */

async function HomeTabsSection() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ?? null;

  const [
    trendingListings,
    staffPickCollections,
    seasonalCollections,
    risingSellers,
    promotedListings,
    feedData,
  ] = await Promise.all([
    getTrendingListings(),
    getStaffPickCollections(),
    getSeasonalCollections(),
    getRisingSellers(),
    getExplorePromotedListings(),
    userId ? getForYouFeed(userId) : Promise.resolve(null),
  ]);

  const categoriesContent = (
    <Suspense fallback={<CardSkeleton count={12} columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />}>
      <CategoriesTabContent />
    </Suspense>
  );

  return (
    <HomeTabs
      isAuthenticated={!!userId}
      feedData={feedData}
      exploreData={{
        trendingListings,
        staffPickCollections,
        seasonalCollections,
        risingSellers,
        promotedListings,
      }}
      categoriesContent={categoriesContent}
    />
  );
}

/* -- Page -- */

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Twicely',
    url: APP_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${APP_URL}/s?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\//g, '<\\/') }}
      />

      {/* Hero + Quick Actions (V2 gradient style) */}
      <HomepageHero trendingSearches={TRENDING_SEARCHES} />

      {/* Category Row */}
      <Suspense fallback={
        <section className="border-b border-gray-200 dark:border-gray-700">
          <div className="mx-auto max-w-[1584px] px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex gap-6 overflow-x-auto sm:gap-8">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex flex-shrink-0 flex-col items-center gap-2 animate-pulse">
                  <div className="h-[88px] w-[88px] rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          </div>
        </section>
      }>
        <CategoryRowSection />
      </Suspense>

      {/* Recently viewed */}
      <Suspense>
        <RecentlyViewedSection />
      </Suspense>

      {/* Trust / Value Props Bar */}
      <HomepageTrustBar />

      {/* Tab system: For You / Explore / Categories */}
      <section className="mx-auto max-w-[1584px] px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={<CardSkeleton count={12} columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />}>
          <HomeTabsSection />
        </Suspense>
      </section>

      {/* Seller Spotlight Banner */}
      <HomepageSellerSpotlight />

      {/* Newsletter */}
      <section className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="mx-auto max-w-[1584px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Stay in the loop</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Get seller tips, feature updates, and trending picks -- straight to your inbox.
            </p>
            <div className="mt-4 flex justify-center">
              <NewsletterSignup source="HOMEPAGE_SECTION" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
