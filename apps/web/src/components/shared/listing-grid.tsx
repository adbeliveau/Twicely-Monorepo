import { ListingCard } from './listing-card';
import { EmptyState } from './empty-state';
import type { ListingCardData } from '@/types/listings';

interface ListingGridProps {
  listings: ListingCardData[];
  emptyMessage?: string;
}

export function ListingGrid({
  listings,
  emptyMessage = 'No listings found',
}: ListingGridProps) {
  if (listings.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
