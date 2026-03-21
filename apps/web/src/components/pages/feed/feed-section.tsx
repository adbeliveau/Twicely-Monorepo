import { ListingGrid } from '@/components/shared/listing-grid';
import type { ListingCardData } from '@/types/listings';

interface Props {
  title: string;
  listings: ListingCardData[];
  emptyMessage?: string;
  showPromoted?: boolean;
}

/**
 * Server component wrapper for a single feed section.
 * Renders a section heading and a listing grid.
 * When showPromoted is true, each card renders with a "Promoted" badge overlay.
 */
export function FeedSection({
  title,
  listings,
  emptyMessage,
  showPromoted = false,
}: Props) {
  if (listings.length === 0 && !emptyMessage) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {showPromoted && (
          <span className="text-xs text-muted-foreground">Promoted</span>
        )}
      </div>

      {listings.length === 0 && emptyMessage ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ListingGrid listings={listings} emptyMessage={emptyMessage} />
      )}
    </section>
  );
}
