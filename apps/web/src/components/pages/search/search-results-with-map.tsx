'use client';

import { useState, lazy, Suspense } from 'react';
import { ListingGrid } from '@/components/shared/listing-grid';
import { SearchViewToggle, type SearchViewMode } from './search-view-toggle';
import type { ListingCardData } from '@/types/listings';

const SearchMapView = lazy(() =>
  import('./search-map-view').then((mod) => ({ default: mod.SearchMapView })),
);

interface SearchResultsWithMapProps {
  listings: ListingCardData[];
  buyerLat?: number;
  buyerLng?: number;
  /** Whether any listings have geo coordinates for map pins. */
  hasGeoListings: boolean;
}

export function SearchResultsWithMap({
  listings,
  buyerLat,
  buyerLng,
  hasGeoListings,
}: SearchResultsWithMapProps) {
  const [viewMode, setViewMode] = useState<SearchViewMode>('grid');

  // Only show toggle when there are mappable listings
  if (!hasGeoListings) {
    return <ListingGrid listings={listings} />;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <SearchViewToggle mode={viewMode} onModeChange={setViewMode} />
      </div>

      {viewMode === 'grid' ? (
        <ListingGrid listings={listings} />
      ) : (
        <Suspense
          fallback={
            <div className="flex h-[500px] items-center justify-center rounded-lg border bg-muted">
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          }
        >
          <SearchMapView
            listings={listings}
            buyerLat={buyerLat}
            buyerLng={buyerLng}
          />
        </Suspense>
      )}
    </div>
  );
}
