'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@twicely/ui/dialog';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { formatPrice } from '@twicely/utils/format';
import { createBundleOfferAction } from '@/lib/actions/offers';
import type { ListingCardData } from '@/types/listings';

interface BundleOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedListings: ListingCardData[];
  onSuccess?: () => void;
}

export function BundleOfferModal({
  open,
  onOpenChange,
  selectedListings,
  onSuccess,
}: BundleOfferModalProps) {
  const router = useRouter();
  const [offerAmount, setOfferAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPriceCents = selectedListings.reduce((sum, l) => sum + l.priceCents, 0);
  const suggestedDiscount = Math.round(totalPriceCents * 0.85); // Default suggestion: 15% off (actual max set by seller)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const offerCents = Math.round(parseFloat(offerAmount) * 100);
    if (isNaN(offerCents) || offerCents <= 0) {
      setError('Please enter a valid offer amount');
      return;
    }

    if (offerCents > totalPriceCents) {
      setError('Offer cannot exceed the total price');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createBundleOfferAction({
        listingIds: selectedListings.map(l => l.id),
        offeredPriceCents: offerCents,
        shippingAddressId: '', // TODO: Address selector
        paymentMethodId: '', // TODO: Payment method selector
        message: message || undefined,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to create bundle offer');
        return;
      }

      onOpenChange(false);
      onSuccess?.();
      router.push('/my/buying/offers');
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Request Bundle Price
          </DialogTitle>
          <DialogDescription>
            Make an offer on {selectedListings.length} items from this seller
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selected items preview */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium">Selected items:</p>
            <div className="flex flex-wrap gap-2">
              {selectedListings.slice(0, 4).map((listing) => (
                <div
                  key={listing.id}
                  className="relative h-12 w-12 overflow-hidden rounded border"
                >
                  {listing.primaryImageUrl ? (
                    <Image
                      src={listing.primaryImageUrl}
                      alt={listing.title}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted text-xs">
                      ?
                    </div>
                  )}
                </div>
              ))}
              {selectedListings.length > 4 && (
                <div className="flex h-12 w-12 items-center justify-center rounded border bg-muted text-sm font-medium">
                  +{selectedListings.length - 4}
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Total list price: {formatPrice(totalPriceCents)}
            </p>
          </div>

          {/* Offer amount */}
          <div className="space-y-2">
            <Label htmlFor="offerAmount">Your offer</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="offerAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                placeholder={(suggestedDiscount / 100).toFixed(2)}
                className="pl-7"
                disabled={isSubmitting}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Suggested: {formatPrice(suggestedDiscount)} (10% off)
            </p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message to the seller..."
              rows={3}
              maxLength={500}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <p className="text-xs text-muted-foreground">
            Note: You&apos;ll need to select a shipping address and payment method to complete your offer.
          </p>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !offerAmount}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
