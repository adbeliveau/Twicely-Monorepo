import { cache } from 'react';
import { getStorefrontBySlug } from '@/lib/queries/storefront';
import { StoreAbout } from '@/components/storefront/store-about';

const getCachedStorefront = cache(getStorefrontBySlug);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function StorefrontAboutPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getCachedStorefront(slug);
  if (!data) return null; // layout handles notFound

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        About {data.seller.storeName ?? 'This Seller'}
      </h2>
      <StoreAbout seller={data.seller} stats={data.stats} />
    </div>
  );
}
