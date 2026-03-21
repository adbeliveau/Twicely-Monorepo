import { ListingCard } from '@/components/shared/listing-card';
import type { ListingCardData } from '@/types/listings';

interface Props {
  title: string;
  description: string | null;
  listings: ListingCardData[];
}

/**
 * Horizontal scrollable row for a curated collection.
 * Per Personalization Canonical §5 — Staff Picks / Seasonal sections.
 */
export function CollectionRow({ title, description, listings }: Props) {
  if (listings.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-4 pb-2">
          {listings.map((listing) => (
            <div key={listing.id} className="w-[200px] min-w-[200px]">
              <ListingCard listing={listing} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
