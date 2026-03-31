'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Tag, Clock } from 'lucide-react';
import { acceptWatcherOfferAction } from '@/lib/actions/watcher-offers';
import { formatPrice } from '@twicely/utils/format';

interface WatcherOfferBannerProps {
  watcherOfferId: string;
  listingId: string;
  listingSlug: string;
  discountedPriceCents: number;
  originalPriceCents: number;
  expiresAt: Date;
  isWatcher: boolean;
  isLoggedIn: boolean;
  defaultAddressId?: string | null;
}

export function WatcherOfferBanner({
  watcherOfferId,
  listingId: _listingId,
  listingSlug,
  discountedPriceCents,
  originalPriceCents,
  expiresAt,
  isWatcher,
  isLoggedIn,
  defaultAddressId,
}: WatcherOfferBannerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [accepted, setAccepted] = useState(false);

  // Calculate savings
  const savingsCents = originalPriceCents - discountedPriceCents;
  const savingsPercent = Math.round((savingsCents / originalPriceCents) * 100);

  // Calculate time remaining
  const getTimeRemaining = () => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return null; // Expired
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
    }
    return `${hours}h ${minutes}m left`;
  };

  const timeRemaining = getTimeRemaining();
  if (!timeRemaining) return null; // Don't show expired offers

  const handleAccept = () => {
    if (!isLoggedIn) {
      router.push(`/auth/login?callbackUrl=/i/${listingSlug}`);
      return;
    }

    if (!isWatcher) {
      setError('You must be watching this listing to accept this offer');
      return;
    }

    if (!defaultAddressId) {
      setError('Please add a shipping address in your account settings first');
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await acceptWatcherOfferAction({
        watcherOfferId,
        shippingAddressId: defaultAddressId,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to accept offer');
      } else {
        setAccepted(true);
        // Redirect to offers page or show success
        router.push('/my/buying/offers');
      }
    });
  };

  if (accepted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
        <p className="font-medium text-green-800">Offer submitted! The seller will review your offer.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Tag className="h-5 w-5 text-primary" />
        <span className="font-semibold text-primary">Special Offer for You!</span>
      </div>

      <div className="mb-3 flex items-baseline gap-3">
        <span className="text-2xl font-bold">{formatPrice(discountedPriceCents)}</span>
        <span className="text-lg text-muted-foreground line-through">
          {formatPrice(originalPriceCents)}
        </span>
        <span className="rounded bg-green-100 px-2 py-0.5 text-sm font-medium text-green-700">
          Save {savingsPercent}%
        </span>
      </div>

      <div className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>{timeRemaining}</span>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isWatcher ? (
        <Button onClick={handleAccept} disabled={isPending} className="w-full">
          {isPending ? 'Submitting...' : `Accept Offer — ${formatPrice(discountedPriceCents)}`}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add this item to your watchlist to accept this special offer.
        </p>
      )}
    </div>
  );
}
