/**
 * Dead Stock card — Finance Intelligence Layer.
 * Data gate: >= 1 stale listing (active for > staleDaysThreshold days).
 * Returns null if gate not met.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { formatCentsToDollars } from '@twicely/finance/format';
import Link from 'next/link';

export interface StaleListing {
  id: string;
  title: string | null;
  slug: string | null;
  priceCents: number | null;
  activatedAt: Date;
  daysActive: number;
}

interface DeadStockCardProps {
  sellerProfileId: string;
  staleListings: StaleListing[];
}

export function DeadStockCard({ staleListings }: DeadStockCardProps) {
  // Data gate: at least 1 stale listing
  if (staleListings.length === 0) return null;

  const shown = staleListings.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Dead Stock Alert</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {staleListings.length} listing{staleListings.length !== 1 ? 's' : ''} active for
          {' '}60+ days without a sale.
        </p>
        <div className="space-y-2">
          {shown.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm">
              <div className="flex-1 min-w-0">
                {l.slug ? (
                  <Link
                    href={`/my/selling/listings/${l.id}`}
                    className="font-medium truncate text-primary underline-offset-2 hover:underline"
                  >
                    {l.title ?? 'Untitled'}
                  </Link>
                ) : (
                  <span className="font-medium truncate">{l.title ?? 'Untitled'}</span>
                )}
                <p className="text-xs text-muted-foreground">{l.daysActive} days active</p>
              </div>
              {l.priceCents != null && (
                <span className="ml-4 font-medium">{formatCentsToDollars(l.priceCents)}</span>
              )}
            </div>
          ))}
        </div>
        {staleListings.length > 5 && (
          <p className="text-xs text-muted-foreground">
            +{staleListings.length - 5} more stale listings
          </p>
        )}
      </CardContent>
    </Card>
  );
}
