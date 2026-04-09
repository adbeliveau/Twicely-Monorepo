/**
 * generateMetadata for the listing detail page.
 * Split from page.tsx to stay under 300 lines.
 */

import type { Metadata } from 'next';
import { getListingBySlug } from '@/lib/queries/listings';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { formatPrice, truncate } from '@twicely/utils/format';
import { CONDITION_LABELS } from './constants';

interface ListingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ action?: string }>;
}

export async function generateListingMetadata({ params }: Pick<ListingPageProps, 'params'>): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);

  if (!listing) {
    return { title: 'Listing Not Found | Twicely' };
  }

  const title = `${listing.title} — ${formatPrice(listing.priceCents)} | Twicely`;
  const conditionLabel = CONDITION_LABELS[listing.condition] ?? listing.condition;
  const description = truncate(
    `${formatPrice(listing.priceCents)} · ${conditionLabel} · ${listing.description || listing.title}`,
    160
  );
  const canonicalUrl = `https://twicely.co/i/${slug}`;
  const imageUrl = listing.images[0]?.url;
  const priceAmount = (listing.priceCents / 100).toFixed(2);

  // Decision #71 / Buyer Acquisition Addendum §B.4: SOLD listings index for 90 days,
  // then noindex. ENDED and RESERVED stay noindex always.
  let robotsDirective: string | undefined = undefined;
  if (listing.status === 'ENDED' || listing.status === 'RESERVED') {
    robotsDirective = 'noindex';
  } else if (listing.status === 'SOLD') {
    const indexEnabled = await getPlatformSetting<boolean>('seo.soldListingIndexEnabled', true);
    const indexDays = await getPlatformSetting<number>('seo.soldListingIndexDays', 90);
    if (!indexEnabled || !listing.soldAt) {
      robotsDirective = 'noindex';
    } else {
      const ageMs = Date.now() - new Date(listing.soldAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > indexDays) {
        robotsDirective = 'noindex';
      }
      // else: leave undefined (default = indexable) per Decision #71
    }
  }

  return {
    title,
    description,
    robots: robotsDirective,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Twicely',
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: listing.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    other: {
      'og:type': 'product',
      'product:price:amount': priceAmount,
      'product:price:currency': 'USD',
    },
  };
}
