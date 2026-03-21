'use client';

import { FeedSection } from '@/components/pages/feed/feed-section';
import { CollectionRow } from './collection-row';
import { RisingSellersRow } from './rising-sellers-row';
import type { ListingCardData } from '@/types/listings';
import type { ExploreCollection, RisingSellerData } from '@/lib/queries/explore';

interface Props {
  trendingListings: ListingCardData[];
  staffPickCollections: ExploreCollection[];
  seasonalCollections: ExploreCollection[];
  risingSellers: RisingSellerData[];
  promotedListings: ListingCardData[];
}

/**
 * Client component orchestrating Explore page sections.
 * Sections per Personalization Canonical §5:
 *   1. Trending Now
 *   2. Staff Picks
 *   3. Seasonal
 *   4. Rising Sellers
 *   5. Promoted (Explore — not interest-filtered)
 */
export function ExplorePageContent({
  trendingListings,
  staffPickCollections,
  seasonalCollections,
  risingSellers,
  promotedListings,
}: Props) {
  return (
    <div className="space-y-10">
      {/* Section 1 — Trending Now */}
      {trendingListings.length > 0 && (
        <FeedSection
          title="Trending Now"
          listings={trendingListings}
        />
      )}

      {/* Section 2 — Staff Picks */}
      {staffPickCollections.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Staff Picks</h2>
          <div className="space-y-8">
            {staffPickCollections.map((collection) => (
              <CollectionRow
                key={collection.id}
                title={collection.title}
                description={collection.description}
                listings={collection.listings}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 3 — Seasonal */}
      {seasonalCollections.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Seasonal</h2>
          <div className="space-y-8">
            {seasonalCollections.map((collection) => (
              <CollectionRow
                key={collection.id}
                title={collection.title}
                description={collection.description}
                listings={collection.listings}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 4 — Rising Sellers */}
      {risingSellers.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Rising Sellers</h2>
          <RisingSellersRow sellers={risingSellers} />
        </section>
      )}

      {/* Section 5 — Promoted (not interest-filtered per Personalization Canonical §10) */}
      {promotedListings.length > 0 && (
        <FeedSection
          title="Promoted"
          listings={promotedListings}
          showPromoted
        />
      )}
    </div>
  );
}
