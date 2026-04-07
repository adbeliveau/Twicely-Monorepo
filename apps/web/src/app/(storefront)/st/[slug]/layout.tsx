import { notFound } from 'next/navigation';
import { cache, Suspense } from 'react';
import { getStorefrontBySlug } from '@/lib/queries/storefront';
import { getPublishedPagesNav } from '@/lib/queries/storefront-pages';
import { getIsFollowing } from '@/lib/actions/follow';
import { StorefrontHeader } from '@/components/storefront/storefront-header';
import { StorefrontTabs } from '@/components/storefront/storefront-tabs';
import { VacationBanner } from '@/components/storefront/vacation-banner';
import { StoreSearchBar } from '@/components/storefront/store-search-bar';
import { SkipNav } from '@/components/shared/skip-nav';
import type { Metadata } from 'next';

// Cache per-request dedup
const getCachedStorefront = cache(getStorefrontBySlug);

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCachedStorefront(slug);
  if (!data) return { title: 'Store Not Found | Twicely' };

  const description = data.seller.branding.aboutHtml
    ? data.seller.branding.aboutHtml.replace(/<[^>]*>/g, '').slice(0, 160)
    : `Shop ${data.seller.storeName} on Twicely`;

  return {
    title: `${data.seller.storeName} | Twicely Seller`,
    description,
    openGraph: {
      title: `${data.seller.storeName} | Twicely Seller`,
      description,
      images: data.seller.branding.logoUrl ? [data.seller.branding.logoUrl] : [],
      type: 'website',
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co'}/st/${slug}`,
    },
  };
}

export default async function StorefrontLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const data = await getCachedStorefront(slug);
  if (!data) notFound();

  const [isFollowing, customPages] = await Promise.all([
    getIsFollowing(data.seller.userId),
    getPublishedPagesNav(slug),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <SkipNav />
      {data.seller.vacationMode && (
        <VacationBanner
          message={data.seller.vacationMessage}
          returnDate={data.seller.vacationEndAt}
          modeType={data.seller.vacationModeType}
        />
      )}
      <StorefrontHeader
        seller={data.seller}
        stats={data.stats}
        isFollowing={isFollowing}
        accentColor={data.seller.branding.accentColor}
      />
      <StorefrontTabs slug={slug} customPages={customPages} />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Search bar */}
        <div className="mb-6 max-w-md">
          <Suspense fallback={null}>
            <StoreSearchBar slug={slug} />
          </Suspense>
        </div>
        {children}
      </main>
    </div>
  );
}
