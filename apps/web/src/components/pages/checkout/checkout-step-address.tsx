'use client';

import { Button } from '@twicely/ui/button';
import { AddressSelector } from '@/components/shared/address-selector';
import { FulfillmentSelector } from './fulfillment-selector';
import { AuthenticationOffer } from './authentication-offer';
import { CouponInput } from '@/components/checkout/coupon-input';
import type { CartWithItems } from '@/lib/queries/cart';
import type { AddressData } from '@/lib/queries/address';
import type { SafeMeetupLocationRow } from '@/lib/queries/safe-meetup-locations';
import { Loader2, MapPin, ShieldCheck } from 'lucide-react';

interface AppliedDiscount {
  promotionId: string;
  promotionName: string;
  discountCents: number;
  freeShipping: boolean;
  couponCode: string;
  appliedToSellerId: string;
}

interface CheckoutStepAddressProps {
  cart: CartWithItems;
  addresses: AddressData[];
  selectedAddressId: string | null;
  onSelectAddress: (id: string | null) => void;
  fulfillmentChoice: 'shipping' | 'local_pickup';
  onSelectFulfillment: (choice: 'shipping' | 'local_pickup') => void;
  authenticationRequested: boolean;
  onAuthenticationChange: (checked: boolean) => void;
  onDiscountApplied: (discount: AppliedDiscount | null) => void;
  onContinue: () => void;
  onAddressAdded: () => void;
  isProcessing: boolean;
  authBuyerFeeCents: number;
  authOfferThresholdCents: number;
  nearbyMeetupLocations: Array<SafeMeetupLocationRow & { distanceMiles: number }>;
}

export function CheckoutStepAddress({
  cart,
  addresses,
  selectedAddressId,
  onSelectAddress,
  fulfillmentChoice,
  onSelectFulfillment,
  authenticationRequested,
  onAuthenticationChange,
  onDiscountApplied,
  onContinue,
  onAddressAdded,
  isProcessing,
  authBuyerFeeCents,
  authOfferThresholdCents,
  nearbyMeetupLocations,
}: CheckoutStepAddressProps) {
  const isLocalPickup = fulfillmentChoice === 'local_pickup';

  // B3.5: Show auth offer if any cart item meets the threshold (e.g. $500+)
  const showAuthOffer = cart.groups.some((group) =>
    group.items.some((item) => item.unitPriceCents >= authOfferThresholdCents)
  );

  return (
    <div className="space-y-6">
      {/* B3.4: Fulfillment selector (only if cart supports local pickup) */}
      {cart.supportsLocalPickup && (
        <FulfillmentSelector
          fulfillmentType="SHIP_AND_LOCAL"
          selected={fulfillmentChoice}
          onSelect={onSelectFulfillment}
          shippingCents={cart.shippingCents}
          itemSubtotalCents={cart.subtotalCents}
          disabled={isProcessing}
        />
      )}

      {/* Nearby safe meetup locations (shown when local pickup is selected) */}
      {isLocalPickup && nearbyMeetupLocations.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-sm">Safe Meetup Spots</h3>
          </div>
          <div className="space-y-2">
            {nearbyMeetupLocations.slice(0, 5).map((location) => (
              <div key={location.id} className="flex items-start justify-between gap-2 text-sm py-2 border-b last:border-b-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-gray-900 truncate">{location.name}</p>
                    {location.verifiedSafe && (
                      <ShieldCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {location.address}, {location.city}, {location.state}
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {location.distanceMiles.toFixed(1)} mi
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* B3.5: Authentication offer for $500+ items */}
      {showAuthOffer && (
        <AuthenticationOffer
          checked={authenticationRequested}
          onChange={onAuthenticationChange}
          disabled={isProcessing}
          authBuyerFeeCents={authBuyerFeeCents}
        />
      )}

      {/* D2.3: Coupon code input */}
      <CouponInput
        cartItems={cart.groups.flatMap((group) =>
          group.items.map((item) => ({
            listingId: item.listingId,
            categoryId: item.categoryId ?? '',
            sellerId: group.sellerId,
            priceCents: item.unitPriceCents,
            quantity: item.quantity,
          }))
        )}
        onDiscountApplied={onDiscountApplied}
      />

      <div className="rounded-lg border bg-white p-6">
        <h2 className="font-semibold mb-4">
          {isLocalPickup ? 'Your Contact Address' : 'Select Shipping Address'}
        </h2>
        <AddressSelector
          addresses={addresses}
          selectedAddressId={selectedAddressId}
          onSelect={onSelectAddress}
          onAddressAdded={onAddressAdded}
        />
        <div className="mt-6">
          <Button
            onClick={onContinue}
            disabled={!selectedAddressId || isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
