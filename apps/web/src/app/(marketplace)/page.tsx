import { Suspense } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { SearchBar } from '@/components/shared/search-bar';
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

/* ── Async sections ── */

async function RecentlyViewedSection() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  const items = await getRecentlyViewed(session.user.id);
  if (items.length === 0) return null;
  return <RecentlyViewedCarousel items={items} />;
}

/* ── Skeleton fallback ── */

function CardSkeleton({ count, columns }: { count: number; columns: string }) {
  return (
    <section aria-busy="true" aria-label="Loading listings">
      <div className="mb-6 h-7 w-40 animate-pulse rounded bg-muted" />
      <div className={`grid gap-4 ${columns}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="aspect-square rounded-lg bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Categories tab content ── */

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
            <h2 className="text-xl font-semibold">Shop by category</h2>
            <Link href="/s" className="text-sm text-muted-foreground hover:text-foreground">
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
          <h2 className="text-xl font-semibold">Recently listed</h2>
          <Link href="/s?sort=newest" className="text-sm text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>
        <ListingGrid listings={recentListings} emptyMessage="No listings yet" />
      </section>
      {featuredPicks.length > 0 && (
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Featured picks</h2>
            <Link href="/s" className="text-sm text-muted-foreground hover:text-foreground">
              Explore more
            </Link>
          </div>
          <ListingGrid listings={featuredPicks} emptyMessage="No featured items" />
        </section>
      )}
    </div>
  );
}

/* ── Tab data fetcher ── */

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

/* ── Page ── */

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
      <div className="flex flex-col gap-12">
        {/* Hero — renders instantly, no data needed */}
        <section className="flex flex-col items-center gap-6 py-12 text-center md:py-16">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            Buy and sell secondhand. Better.
          </h1>
          <p className="max-w-lg text-muted-foreground">
            The marketplace with built-in seller tools.
          </p>
          <div className="w-full max-w-xl">
            <SearchBar placeholder="Search for brands, items, or styles..." />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {TRENDING_SEARCHES.map((item) => (
              <Link
                key={item.query}
                href={`/s?q=${encodeURIComponent(item.query)}`}
                className="rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Recently viewed — above tabs, shown when logged in */}
        <Suspense>
          <RecentlyViewedSection />
        </Suspense>

        {/* Tab system: For You / Explore / Categories */}
        <Suspense fallback={<CardSkeleton count={12} columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />}>
          <HomeTabsSection />
        </Suspense>

        {/* Newsletter */}
        <section className="flex flex-col items-center gap-4 py-8 text-center">
          <h2 className="text-lg font-semibold">Stay in the loop</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Get seller tips, feature updates, and trending picks — straight to your inbox.
          </p>
          <NewsletterSignup source="HOMEPAGE_SECTION" />
        </section>
      </div>
    </>
  );
}
