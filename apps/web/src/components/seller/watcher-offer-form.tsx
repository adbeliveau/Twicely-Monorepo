'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Users, Send, X, Check } from 'lucide-react';
import { createWatcherOffer, cancelWatcherOffer } from '@twicely/commerce/watcher-offers';
import { formatPrice } from '@twicely/utils/format';

interface WatcherOfferFormProps {
  listingId: string;
  sellerId: string;
  currentPriceCents: number;
  watcherCount: number;
  activeOffer?: {
    id: string;
    discountedPriceCents: number;
    expiresAt: Date;
    watchersNotifiedCount: number;
  } | null;
}

export function WatcherOfferForm({
  listingId,
  currentPriceCents,
  watcherCount,
  activeOffer,
}: WatcherOfferFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [localActiveOffer, setLocalActiveOffer] = useState(activeOffer);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const discountedPriceCents = Math.round(parseFloat(priceInput) * 100);
    if (isNaN(discountedPriceCents) || discountedPriceCents <= 0) {
      setError('Please enter a valid price');
      return;
    }
    if (discountedPriceCents >= currentPriceCents) {
      setError('Discounted price must be less than current price');
      return;
    }

    startTransition(async () => {
      const result = await createWatcherOffer({
        listingId,
        discountedPriceCents,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to create offer');
      } else {
        setSuccess(`Offer sent to ${result.watchersNotified} watchers!`);
        setShowForm(false);
        setPriceInput('');
        setLocalActiveOffer({
          id: result.watcherOfferId!,
          discountedPriceCents,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          watchersNotifiedCount: result.watchersNotified!,
        });
        setTimeout(() => setSuccess(null), 3000);
      }
    });
  };

  const handleCancel = () => {
    if (!localActiveOffer) return;
    setError(null);

    startTransition(async () => {
      const result = await cancelWatcherOffer(localActiveOffer.id);
      if (!result.success) {
        setError(result.error ?? 'Failed to cancel offer');
      } else {
        setLocalActiveOffer(null);
        setSuccess('Offer cancelled');
        setTimeout(() => setSuccess(null), 3000);
      }
    });
  };

  // Calculate time remaining for active offer
  const getTimeRemaining = (expiresAt: Date) => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  if (watcherCount === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        <Users className="mx-auto mb-2 h-5 w-5" />
        No watchers yet
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{watcherCount} watching</span>
        </div>
        {!localActiveOffer && !showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Send className="mr-1 h-4 w-4" />
            Send Offer
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-3 flex items-center gap-2 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {localActiveOffer && (
        <div className="rounded border border-primary/20 bg-primary/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Active Watcher Offer</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
              className="h-7 px-2 text-muted-foreground hover:text-destructive"
            >
              <X className="mr-1 h-3 w-3" />
              Cancel
            </Button>
          </div>
          <p className="text-lg font-semibold text-primary">
            {formatPrice(localActiveOffer.discountedPriceCents)}
            <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
              {formatPrice(currentPriceCents)}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sent to {localActiveOffer.watchersNotifiedCount} watchers
            {' '}&bull;{' '}
            {getTimeRemaining(new Date(localActiveOffer.expiresAt))}
          </p>
        </div>
      )}

      {showForm && !localActiveOffer && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="discounted-price" className="text-sm">
              Discounted Price
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <Input
                id="discounted-price"
                type="number"
                step="0.01"
                min="0.01"
                max={(currentPriceCents / 100 - 0.01).toFixed(2)}
                placeholder={(currentPriceCents / 100 * 0.9).toFixed(2)}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="flex-1"
                disabled={isPending}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Current price: {formatPrice(currentPriceCents)}. Offer expires in 24 hours.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending || !priceInput}>
              {isPending ? 'Sending...' : `Send to ${watcherCount} watchers`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setPriceInput('');
                setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
