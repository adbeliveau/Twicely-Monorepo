'use client';

import { Render } from '@puckeditor/core';
import type { Data } from '@puckeditor/core';
import { puckConfig } from '@/components/storefront/puck-config';
import {
  FeaturedListingsContext,
  type FeaturedListingData,
} from '@/components/storefront/puck-blocks/featured-listings-block';

interface PageRenderClientProps {
  puckData: unknown;
  listingsMap: Record<string, FeaturedListingData>;
}

export function PageRenderClient({
  puckData,
  listingsMap,
}: PageRenderClientProps) {
  return (
    <FeaturedListingsContext.Provider value={listingsMap}>
      <Render config={puckConfig} data={puckData as Data} />
    </FeaturedListingsContext.Provider>
  );
}
