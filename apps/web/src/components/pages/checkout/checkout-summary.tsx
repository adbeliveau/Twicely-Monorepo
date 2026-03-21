import Image from 'next/image';
import { formatPrice } from '@twicely/utils/format';
import type { CartWithItems } from '@/lib/queries/cart';
import type { AddressData } from '@/lib/queries/address';

interface CheckoutSummaryProps {
  cart: CartWithItems;
  selectedAddress?: AddressData;
  discountCents?: number;
  authFeeCents?: number;
  isLocalPickup?: boolean;
}

export function CheckoutSummary({
  cart,
  selectedAddress,
  discountCents = 0,
  authFeeCents = 0,
  isLocalPickup = false,
}: CheckoutSummaryProps) {
  const effectiveShippingCents = isLocalPickup ? 0 : cart.shippingCents;
  const totalCents = Math.max(
    0,
    cart.subtotalCents + effectiveShippingCents + authFeeCents - discountCents
  );

  return (
    <div className="rounded-lg border bg-white p-6 sticky top-4">
      <h2 className="font-semibold mb-4">Order Summary</h2>

      {/* Items */}
      <div className="space-y-3 mb-4">
        {cart.groups.map((group) =>
          group.items.map((item) => (
            <div key={item.cartItemId} className="flex gap-3">
              <div className="relative h-12 w-12 rounded-md overflow-hidden bg-muted shrink-0">
                {item.primaryImageUrl ? (
                  <Image
                    src={item.primaryImageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                    No img
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  Qty: {item.quantity} × {formatPrice(item.unitPriceCents)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      <div className="border-t pt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatPrice(cart.subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shipping</span>
          <span>{effectiveShippingCents === 0 ? 'Free' : formatPrice(effectiveShippingCents)}</span>
        </div>
        {cart.totalShippingSavingsCents > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Combined shipping discount</span>
            <span>-{formatPrice(cart.totalShippingSavingsCents)}</span>
          </div>
        )}
        {discountCents > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Coupon discount</span>
            <span>-{formatPrice(discountCents)}</span>
          </div>
        )}
        {authFeeCents > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Authentication</span>
            <span>{formatPrice(authFeeCents)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t font-semibold text-base">
          <span>Total</span>
          <span>{formatPrice(totalCents)}</span>
        </div>
      </div>

      {/* Shipping Address Preview */}
      {selectedAddress && (
        <div className="border-t mt-4 pt-4">
          <h3 className="text-sm font-medium mb-2">Ship to</h3>
          <p className="text-sm text-muted-foreground">{selectedAddress.name}</p>
          <p className="text-sm text-muted-foreground">
            {selectedAddress.address1}
            {selectedAddress.address2 && `, ${selectedAddress.address2}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {selectedAddress.city}, {selectedAddress.state} {selectedAddress.zip}
          </p>
        </div>
      )}
    </div>
  );
}
