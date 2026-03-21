'use client';

import { createContext, useContext } from 'react';
import type { ComponentConfig } from '@puckeditor/core';
import { formatPrice } from '@twicely/utils/format';

// ─── Listing data context (set by server component on public render) ────

export interface FeaturedListingData {
  id: string;
  title: string;
  priceCents: number;
  imageUrl: string | null;
  slug: string;
}

export const FeaturedListingsContext = createContext<
  Record<string, FeaturedListingData>
>({});

// ─── Props ──────────────────────────────────────────────────────────────

export interface FeaturedListingsBlockProps {
  listingIds: string;
  columns: '2' | '3' | '4';
}

// ─── Component ──────────────────────────────────────────────────────────

export function FeaturedListingsBlock({
  listingIds,
  columns,
}: FeaturedListingsBlockProps) {
  const listingsMap = useContext(FeaturedListingsContext);
  const ids = listingIds
    ? listingIds.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // If no context data is available (editor mode), show placeholder
  const hasContextData = Object.keys(listingsMap).length > 0;
  if (!hasContextData && ids.length > 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
        <p className="font-medium">{ids.length} listing{ids.length !== 1 ? 's' : ''} selected</p>
        <p className="mt-1 text-sm">Preview on published page</p>
      </div>
    );
  }

  if (ids.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center text-gray-400">
        Enter listing IDs (comma-separated) in the editor
      </div>
    );
  }

  const gridClass =
    columns === '4'
      ? 'grid grid-cols-2 md:grid-cols-4'
      : columns === '3'
        ? 'grid grid-cols-2 md:grid-cols-3'
        : 'grid grid-cols-1 md:grid-cols-2';

  const listings = ids
    .map((id) => listingsMap[id])
    .filter((l): l is FeaturedListingData => !!l);

  return (
    <div className={`${gridClass} gap-4`}>
      {listings.map((listing) => (
        <a
          key={listing.id}
          href={`/i/${listing.slug}`}
          className="group block overflow-hidden rounded-lg border border-gray-200 transition-shadow hover:shadow-md"
        >
          <div className="aspect-square bg-gray-100">
            {listing.imageUrl && (
              <img
                src={listing.imageUrl}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="p-3">
            <p className="truncate text-sm font-medium text-gray-900">
              {listing.title}
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatPrice(listing.priceCents)}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}

export const featuredListingsBlockConfig: ComponentConfig<FeaturedListingsBlockProps> = {
  label: 'Featured Listings',
  defaultProps: { listingIds: '', columns: '3' },
  fields: {
    listingIds: { type: 'textarea', label: 'Listing IDs (comma-separated)' },
    columns: {
      type: 'radio',
      label: 'Columns',
      options: [
        { label: '2', value: '2' },
        { label: '3', value: '3' },
        { label: '4', value: '4' },
      ],
    },
  },
  render: (props) => <FeaturedListingsBlock {...props} />,
};
