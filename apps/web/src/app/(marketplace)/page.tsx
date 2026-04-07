import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { auth } from '@twicely/auth/server';
import './landing.css';
import { LandingHero } from '@/components/pages/landing/landing-hero';
import { LandingValueStrip } from '@/components/pages/landing/landing-value-strip';
import { LandingCategories } from '@/components/pages/landing/landing-categories';
import { LandingTrending } from '@/components/pages/landing/landing-trending';
import { LandingDrops } from '@/components/pages/landing/landing-drops';
import { LandingTicker } from '@/components/pages/landing/landing-ticker';
import { LandingWhy } from '@/components/pages/landing/landing-why';
import { LandingPricingTools } from '@/components/pages/landing/landing-pricing-tools';
import { LandingSellers } from '@/components/pages/landing/landing-sellers';
import { LandingTrust } from '@/components/pages/landing/landing-trust';
import { LandingCta } from '@/components/pages/landing/landing-cta';
import { LandingReveal } from '@/components/pages/landing/landing-reveal';
import { getTrendingListings, getRisingSellers, getStaffPickCollections } from '@/lib/queries/explore';
import { getRecentListings, getRecentlySoldListings, getHomepageCategories } from '@/lib/queries/homepage';
import { getLandingStats } from '@/lib/queries/landing-stats';

export const metadata: Metadata = {
  title: 'Twicely — Buy & Sell Premium Secondhand',
  description:
    'The marketplace with built-in seller tools. Buy cleaner secondhand listings. Sell once, reach everywhere.',
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://twicely.co';

// Force dynamic rendering so random sold items refresh on every page load
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [trending, recent, soldItems, sellers, categories, collections, stats, session] = await Promise.all([
    getTrendingListings(10),
    getRecentListings(8),
    getRecentlySoldListings(12),
    getRisingSellers(3),
    getHomepageCategories(),
    getStaffPickCollections(),
    getLandingStats(),
    auth.api.getSession({ headers: await headers() }).catch(() => null),
  ]);
  const isLoggedIn = !!session;

  // Hero uses recently sold items; fallback to trending+recent if no sold items yet
  const heroSoldItems = soldItems.length > 0 ? soldItems : [...trending, ...recent].slice(0, 12);
  // Trending section uses trending+recent
  const allListings = [...trending, ...recent];
  const trendingListings = allListings.slice(0, 5);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Twicely',
    url: APP_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${APP_URL}/s?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <div className="landing">
      <LandingReveal />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/<\//g, '<\\/'),
        }}
      />
      <LandingHero listings={heroSoldItems} stats={stats} />
      <LandingValueStrip />
      <LandingCategories categories={categories} />
      <LandingTrending listings={trendingListings} isLoggedIn={isLoggedIn} />
      <LandingDrops collections={collections} />
      <LandingTicker />
      <LandingWhy />
      <LandingPricingTools />
      <LandingSellers sellers={sellers} />
      <LandingTrust />
      <LandingCta />
    </div>
  );
}
