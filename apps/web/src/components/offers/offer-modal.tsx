'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CardElement, useStripe, useElements, Elements } from '@stripe/react-stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@twicely/ui/dialog';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { createOfferAction } from '@/lib/actions/offers';
import { getStripePromise } from '@twicely/stripe/client';
import { formatPrice } from '@twicely/utils/format';
import { toast } from 'sonner';
import { Package, Loader2, CheckCircle, AlertCircle, Info, Lock } from 'lucide-react';

interface ListingData {
  id: string;
  title: string;
  priceCents: number;
  images: Array<{ url: string }>;
  allowOffers: boolean;
  autoAcceptOfferCents: number | null;
  autoDeclineOfferCents: number | null;
}

interface AddressOption {
  id: string;
  label: string | null;
  name: string;
  isDefault: boolean;
}

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: ListingData;
  addresses: AddressOption[];
}

export function OfferModal({ isOpen, onClose, listing, addresses }: OfferModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Make an Offer</DialogTitle>
        </DialogHeader>
        <Elements stripe={getStripePromise()}>
          <OfferForm listing={listing} addresses={addresses} onClose={onClose} />
        </Elements>
      </DialogContent>
    </Dialog>
  );
}

interface OfferFormProps {
  listing: ListingData;
  addresses: AddressOption[];
  onClose: () => void;
}

function OfferForm({ listing, addresses, onClose }: OfferFormProps) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [offerAmount, setOfferAmount] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? ''
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offerCents = Math.round(parseFloat(offerAmount || '0') * 100);
  const thumbnail = listing.images[0]?.url ?? null;

  const getValidationMessage = () => {
    if (!offerAmount || offerCents <= 0) return null;
    if (offerCents >= listing.priceCents) {
      return { type: 'info' as const, msg: 'Consider buying directly.' };
    }
    if (listing.autoAcceptOfferCents && offerCents >= listing.autoAcceptOfferCents) {
      return { type: 'success' as const, msg: 'Auto-accepted!' };
    }
    if (listing.autoDeclineOfferCents && offerCents <= listing.autoDeclineOfferCents) {
      return { type: 'error' as const, msg: "Below seller's minimum." };
    }
    return null;
  };

  const validationMsg = getValidationMessage();
  const canSubmit = offerCents > 0 && offerCents < listing.priceCents && selectedAddressId && stripe && elements;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsProcessing(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      setIsProcessing(false);
      return;
    }

    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (pmError) {
      setError(pmError.message ?? 'Failed to process card');
      setIsProcessing(false);
      return;
    }

    const result = await createOfferAction({
      listingId: listing.id,
      offerCents,
      shippingAddressId: selectedAddressId,
      paymentMethodId: paymentMethod.id,
    });

    setIsProcessing(false);

    if (result.success) {
      onClose();
      if (result.autoAccepted && result.orderId) {
        toast.success('Offer auto-accepted! Order created.', {
          action: { label: 'View Order', onClick: () => router.push(`/my/buying/orders/${result.orderId}`) },
        });
      } else {
        toast.success('Offer submitted!');
      }
      router.refresh();
    } else {
      setError(result.error || 'Failed to submit offer');
    }
  };

  const IconMap = { error: AlertCircle, success: CheckCircle, info: Info };
  const colorMap = { error: 'text-destructive', success: 'text-green-600', info: 'text-blue-600' };

  if (addresses.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground mb-4">Add an address in Settings first.</p>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Listing summary */}
      <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
        <div className="relative h-16 w-16 rounded overflow-hidden bg-background shrink-0">
          {thumbnail ? (
            <Image src={thumbnail} alt={listing.title} fill className="object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium line-clamp-1">{listing.title}</p>
          <p className="text-sm text-muted-foreground">Listed at {formatPrice(listing.priceCents)}</p>
        </div>
      </div>

      {/* Offer amount */}
      <div className="space-y-2">
        <Label htmlFor="offer-amount">Your Offer</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="offer-amount"
            type="text"
            inputMode="decimal"
            value={offerAmount}
            onChange={(e) => { if (/^\d*\.?\d{0,2}$/.test(e.target.value)) setOfferAmount(e.target.value); }}
            placeholder="0.00"
            className="pl-7"
          />
        </div>
        {validationMsg && (
          <div className={`flex items-center gap-2 text-sm ${colorMap[validationMsg.type]}`}>
            {(() => { const Icon = IconMap[validationMsg.type]; return <Icon className="h-4 w-4" />; })()}
            {validationMsg.msg}
          </div>
        )}
      </div>

      {/* Shipping address */}
      <div className="space-y-2">
        <Label htmlFor="shipping-address">Ship To</Label>
        <select
          id="shipping-address"
          value={selectedAddressId}
          onChange={(e) => setSelectedAddressId(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {addresses.map((addr) => (
            <option key={addr.id} value={addr.id}>
              {addr.label || addr.name}{addr.isDefault ? ' (Default)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Card input */}
      <div className="space-y-2">
        <Label>Card Details</Label>
        <div className="rounded-md border border-input bg-white p-3">
          <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
        </div>
        <p className="text-xs text-muted-foreground">A hold will be placed. Charged only if accepted.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || isProcessing} className="flex-1">
          {isProcessing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
          ) : (
            <><Lock className="mr-2 h-4 w-4" />Submit Offer</>
          )}
        </Button>
      </div>
    </form>
  );
}
