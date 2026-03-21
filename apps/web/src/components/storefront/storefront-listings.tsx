'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { BundleOfferBar } from './bundle-offer-bar';
import { BundleOfferModal } from './bundle-offer-modal';
import { ListingGridCard } from './listing-grid-card';
import { ListingListCard } from './listing-list-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@twicely/ui/button';
import type { ListingCardData } from '@/types/listings';

interface StorefrontListingsProps {
  listings: ListingCardData[];
  isLoggedIn: boolean;
  isOwnStore: boolean;
  viewMode?: 'GRID' | 'LIST';
}

export function StorefrontListings({
  listings,
  isLoggedIn,
  isOwnStore,
  viewMode = 'GRID',
}: StorefrontListingsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBundleModal, setShowBundleModal] = useState(false);

  const canSelectForBundle = isLoggedIn && !isOwnStore && listings.length >= 2;

  const selectedListings = useMemo(() => {
    return listings.filter((l) => selectedIds.has(l.id));
  }, [listings, selectedIds]);

  const totalPriceCents = useMemo(() => {
    return selectedListings.reduce((sum, l) => sum + l.priceCents, 0);
  }, [selectedListings]);

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBundleSuccess = () => {
    setSelectedIds(new Set());
  };

  if (listings.length === 0) {
    return (
      <EmptyState
        title="No listings yet"
        description={isOwnStore
          ? "You haven't listed any items yet. Start selling!"
          : "This seller doesn't have any active listings right now."
        }
        actionLabel={isOwnStore ? 'Create Listing' : undefined}
        actionHref={isOwnStore ? '/my/selling/listings/new' : undefined}
      />
    );
  }

  return (
    <>
      {/* Bundle selection hint */}
      {canSelectForBundle && selectedIds.size === 0 && (
        <div className="mb-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-center text-sm">
          <span className="text-muted-foreground">
            Select 2 or more items to request a bundle price
          </span>
        </div>
      )}

      {/* Not logged in hint */}
      {!isLoggedIn && listings.length >= 2 && (
        <div className="mb-4 rounded-lg border border-dashed bg-muted/50 p-3 text-center text-sm">
          <span className="text-muted-foreground">
            <Button variant="link" asChild className="h-auto p-0">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            {' '}to request bundle pricing on multiple items
          </span>
        </div>
      )}

      {/* Listings */}
      {viewMode === 'LIST' ? (
        <div className="flex flex-col gap-3">
          {listings.map((listing) => (
            <ListingListCard
              key={listing.id}
              listing={listing}
              selectable={canSelectForBundle}
              selected={selectedIds.has(listing.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {listings.map((listing) => (
            <ListingGridCard
              key={listing.id}
              listing={listing}
              selectable={canSelectForBundle}
              selected={selectedIds.has(listing.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {/* Bundle offer bar (fixed at bottom when 2+ selected) */}
      {canSelectForBundle && (
        <BundleOfferBar
          selectedCount={selectedIds.size}
          totalPriceCents={totalPriceCents}
          onRequestBundle={() => setShowBundleModal(true)}
          onClear={handleClearSelection}
        />
      )}

      {/* Bundle offer modal */}
      <BundleOfferModal
        open={showBundleModal}
        onOpenChange={setShowBundleModal}
        selectedListings={selectedListings}
        onSuccess={handleBundleSuccess}
      />

      {/* Spacer for fixed bottom bar */}
      {selectedIds.size >= 2 && <div className="h-24" />}
    </>
  );
}
