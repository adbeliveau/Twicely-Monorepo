import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublishedPageBySlug } from '@/lib/queries/storefront-pages';
import { PageRenderClient } from './page-render-client';
import { extractFeaturedListingIds } from './utils';
import { getFeaturedListingsForPage } from './data';

interface PageProps {
  params: Promise<{ slug: string; pageSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const result = await getPublishedPageBySlug(slug, pageSlug);

  if (!result || result.upgradeRequired) {
    return { title: 'Page Not Found | Twicely' };
  }

  return {
    title: `${result.page.title} — ${result.page.storeName ?? 'Store'} | Twicely`,
  };
}

export default async function StorefrontCustomPage({ params }: PageProps) {
  const { slug, pageSlug } = await params;
  const result = await getPublishedPageBySlug(slug, pageSlug);

  if (!result) notFound();

  if (result.upgradeRequired) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Page Temporarily Unavailable
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            This page is not currently available. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  // Extract featured listing IDs from puckData and pre-fetch server-side
  const listingIds = extractFeaturedListingIds(result.page.puckData);
  const listingsMap = await getFeaturedListingsForPage(listingIds);

  return (
    <PageRenderClient
      puckData={result.page.puckData}
      listingsMap={listingsMap}
    />
  );
}
