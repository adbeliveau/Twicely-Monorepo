import type { Metadata } from 'next';
import {
  getTrendingListings,
  getStaffPickCollections,
  getSeasonalCollections,
  getRisingSellers,
  getExplorePromotedListings,
} from '@/lib/queries/explore';
import { ExplorePageContent } from '@/components/pages/explore/explore-page-content';

export const metadata: Metadata = {
  title: 'Explore | Twicely',
  description: 'Discover trending items, curated collections, and rising sellers on Twicely.',
};

/**
 * Standalone Explore page — PUBLIC, no auth required.
 * Mirrors the Explore tab on the homepage.
 * Per build tracker G3.9 and Personalization Canonical §5.
 */
export default async function ExplorePage() {
  const [
    trendingListings,
    staffPickCollections,
    seasonalCollections,
    risingSellers,
    promotedListings,
  ] = await Promise.all([
    getTrendingListings(),
    getStaffPickCollections(),
    getSeasonalCollections(),
    getRisingSellers(),
    getExplorePromotedListings(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Explore</h1>
        <p className="text-muted-foreground mt-1">
          Trending items, curated collections, and rising sellers.
        </p>
      </div>
      <ExplorePageContent
        trendingListings={trendingListings}
        staffPickCollections={staffPickCollections}
        seasonalCollections={seasonalCollections}
        risingSellers={risingSellers}
        promotedListings={promotedListings}
      />
    </div>
  );
}
